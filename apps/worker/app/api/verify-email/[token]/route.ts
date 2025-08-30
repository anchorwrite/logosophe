import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// GET /api/verify-email/[token] - Verify email with token
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Find the subscriber with this verification token
    const subscriber = await db.prepare(`
      SELECT Email, VerificationToken, VerificationExpires, EmailVerified, Active
      FROM Subscribers 
      WHERE VerificationToken = ? AND VerificationExpires > CURRENT_TIMESTAMP AND Active = TRUE
    `).bind(token).first() as {
      Email: string;
      VerificationToken: string;
      VerificationExpires: string;
      EmailVerified: string | null;
      Active: boolean;
    } | undefined;

    if (!subscriber) {
      return NextResponse.json({ 
        error: 'Invalid or expired verification token',
        message: 'This verification link is invalid or has expired. Please request a new verification email.'
      }, { status: 400 });
    }

    if (subscriber.EmailVerified) {
      return NextResponse.json({ 
        error: 'Email already verified',
        message: 'This email has already been verified.',
        email: subscriber.Email
      }, { status: 400 });
    }

    // Mark email as verified and clear verification token
    const updateResult = await db.prepare(`
      UPDATE Subscribers 
      SET EmailVerified = CURRENT_TIMESTAMP, 
          VerificationToken = NULL, 
          VerificationExpires = NULL,
          UpdatedAt = CURRENT_TIMESTAMP 
      WHERE Email = ?
    `).bind(subscriber.Email).run();

    if ((updateResult as any).changes === 0) {
      return NextResponse.json({ error: 'Failed to verify email' }, { status: 500 });
    }

    // Send welcome email after successful verification
    try {
      const emailWorkerUrl = env.EMAIL_WORKER_URL || 'https://email-worker.logosophe.workers.dev';
      const welcomeResponse = await fetch(`${emailWorkerUrl}/api/welcome-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: subscriber.Email,
          name: subscriber.Email.split('@')[0], // Use email prefix as name
          type: 'welcome'
        }),
      });

      if (!welcomeResponse.ok) {
        console.error('Failed to send welcome email:', await welcomeResponse.text());
        // Don't fail verification if welcome email fails
      } else {
        console.log('Welcome email sent successfully');
      }
    } catch (welcomeError) {
      console.error('Error sending welcome email:', welcomeError);
      // Don't fail verification if welcome email fails
    }

    return NextResponse.json({ 
      success: true,
      message: 'Email verified successfully!',
      email: subscriber.Email,
      verifiedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error verifying email:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/verify-email/[token] - Alternative verification method
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  // Same logic as GET for flexibility
  return GET(request, { params });
}
