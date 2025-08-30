import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';

interface VerificationEmailRequest {
  email: string;
  name: string;
}

export async function POST(request: NextRequest) {
  try {
    const { email, name } = await request.json() as VerificationEmailRequest;
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Validate input
    if (!email || !name) {
      return NextResponse.json({ 
        error: 'Missing required fields: email and name' 
      }, { status: 400 });
    }

    // Check if user is already a verified subscriber
    const existingSubscriber = await db.prepare(`
      SELECT EmailVerified FROM Subscribers WHERE Email = ?
    `).bind(email).first() as { EmailVerified: string | null } | undefined;

    if (existingSubscriber?.EmailVerified) {
      return NextResponse.json({ 
        error: 'Email is already verified' 
      }, { status: 400 });
    }

    // Generate verification token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store verification token in Subscribers table
    const updateResult = await db.prepare(`
      UPDATE Subscribers 
      SET VerificationToken = ?, VerificationExpires = ?, UpdatedAt = CURRENT_TIMESTAMP 
      WHERE Email = ?
    `).bind(token, expiresAt.toISOString(), email).run();

    if ((updateResult as any).changes === 0) {
      return NextResponse.json({ 
        error: 'Subscriber not found' 
      }, { status: 404 });
    }

    // Send verification email via email worker
    const emailWorkerUrl = env.EMAIL_WORKER_URL || 'https://email-worker.logosophe.workers.dev';
    const verificationResponse = await fetch(`${emailWorkerUrl}/api/verification-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        name,
        type: 'subscription_verification'
      }),
    });

    if (!verificationResponse.ok) {
      console.error('Failed to send verification email:', await verificationResponse.text());
      return NextResponse.json({ 
        error: 'Failed to send verification email' 
      }, { status: 500 });
    }

    // Log the verification email request
    try {
      const { ipAddress, userAgent } = extractRequestContext(request);
      const normalizedLogging = new NormalizedLogging(db);
      
      await normalizedLogging.logUserManagement({
        userEmail: email,
        tenantId: 'system',
        activityType: 'send_verification_email',
        accessType: 'write',
        targetId: email,
        targetName: `Verification email for ${email}`,
        ipAddress,
        userAgent,
        metadata: { emailType: 'verification', expiresAt: expiresAt.toISOString() }
      });
    } catch (loggingError) {
      console.error('Failed to log verification email request:', loggingError);
      // Don't fail the main operation if logging fails
    }

    return NextResponse.json({ 
      success: true,
      message: 'Verification email sent successfully. Please check your email and click the verification link.',
      email
    });

  } catch (error) {
    console.error('Error sending verification email:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
