import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';

interface WelcomeEmailRequest {
  email: string;
  name: string;
}

export async function POST(request: NextRequest) {
  try {
    const { email, name } = await request.json() as WelcomeEmailRequest;
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Validate input
    if (!email || !name) {
      return NextResponse.json({ 
        error: 'Missing required fields: email and name' 
      }, { status: 400 });
    }

    // Verify that the user is a verified subscriber
    const subscriber = await db.prepare(`
      SELECT EmailVerified FROM Subscribers WHERE Email = ? AND EmailVerified IS NOT NULL
    `).bind(email).first() as { EmailVerified: string } | undefined;

    if (!subscriber) {
      return NextResponse.json({ 
        error: 'Subscriber not found or email not verified' 
      }, { status: 404 });
    }

    // Send welcome email via email worker
    const emailWorkerUrl = env.EMAIL_WORKER_URL || 'https://email-worker.logosophe.workers.dev';
    const welcomeResponse = await fetch(`${emailWorkerUrl}/api/welcome-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        name,
        type: 'welcome'
      }),
    });

    if (!welcomeResponse.ok) {
      console.error('Failed to send welcome email:', await welcomeResponse.text());
      return NextResponse.json({ 
        error: 'Failed to send welcome email' 
      }, { status: 500 });
    }

    // Log the welcome email request
    try {
      const { ipAddress, userAgent } = extractRequestContext(request);
      const normalizedLogging = new NormalizedLogging(db);
      
      await normalizedLogging.logUserManagement({
        userEmail: email,
        tenantId: 'system',
        activityType: 'send_welcome_email',
        accessType: 'write',
        targetId: email,
        targetName: `Welcome email for ${email}`,
        ipAddress,
        userAgent,
        metadata: { emailType: 'welcome', verifiedAt: subscriber.EmailVerified }
      });
    } catch (loggingError) {
      console.error('Failed to log welcome email request:', loggingError);
      // Don't fail the main operation if logging fails
    }

    return NextResponse.json({ 
      success: true,
      message: 'Welcome email sent successfully',
      email
    });

  } catch (error) {
    console.error('Error sending welcome email:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
