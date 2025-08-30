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

    // Find the verification record
    const verification = await db.prepare(`
      SELECT Id, Email, Token, CreatedAt, ExpiresAt, VerifiedAt, Attempts
      FROM EmailVerifications 
      WHERE Token = ? AND ExpiresAt > CURRENT_TIMESTAMP
    `).bind(token).first() as {
      Id: number;
      Email: string;
      Token: string;
      CreatedAt: string;
      ExpiresAt: string;
      VerifiedAt: string | null;
      Attempts: number;
    } | undefined;

    if (!verification) {
      return NextResponse.json({ 
        error: 'Invalid or expired verification token',
        message: 'This verification link is invalid or has expired. Please request a new verification email.'
      }, { status: 400 });
    }

    if (verification.VerifiedAt) {
      return NextResponse.json({ 
        error: 'Email already verified',
        message: 'This email has already been verified.',
        email: verification.Email
      }, { status: 400 });
    }

    if (verification.Attempts >= 5) {
      return NextResponse.json({ 
        error: 'Too many verification attempts',
        message: 'Too many verification attempts. Please request a new verification email.'
      }, { status: 400 });
    }

    // Mark email as verified
    const updateResult = await db.prepare(`
      UPDATE EmailVerifications 
      SET VerifiedAt = CURRENT_TIMESTAMP 
      WHERE Id = ?
    `).bind(verification.Id).run();

    if ((updateResult as any).changes === 0) {
      return NextResponse.json({ error: 'Failed to verify email' }, { status: 500 });
    }

    // Update subscriber's EmailVerified status
    const subscriberResult = await db.prepare(`
      UPDATE Subscribers 
      SET EmailVerified = CURRENT_TIMESTAMP, UpdatedAt = CURRENT_TIMESTAMP 
      WHERE Email = ?
    `).bind(verification.Email).run();

    if ((subscriberResult as any).changes === 0) {
      // Log warning but don't fail the verification
      console.warn(`Subscriber not found for verified email: ${verification.Email}`);
    } else {
      // Send welcome email after successful verification
      try {
        const emailWorkerUrl = env.EMAIL_WORKER_URL || 'https://email-worker.logosophe.workers.dev';
        const welcomeResponse = await fetch(`${emailWorkerUrl}/api/welcome-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: verification.Email,
            name: verification.Email.split('@')[0], // Use email prefix as name
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
    }

    return NextResponse.json({ 
      success: true,
      message: 'Email verified successfully!',
      email: verification.Email,
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
