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

    // Send welcome email after successful verification via Resend
    try {
      const welcomeContent = `
Hello ${subscriber.Email.split('@')[0].charAt(0).toUpperCase() + subscriber.Email.split('@')[0].slice(1)},

Welcome to Logosophe! 🎉

Your email address has been successfully verified, and you're now a confirmed subscriber. Here's what you can do next:

**Explore Harbor**
- Access your personalized workspace
- Manage your email preferences
- Connect with other subscribers

**Email Preferences**
You can manage which types of emails you receive by going to your Harbor profile:
- Newsletters: Regular updates and content
- Announcements: Important system updates
- Tenant Updates: Updates about your tenant activities

**Getting Started**
- Visit https://www.logosophe.com/harbor to access your workspace
- Customize your email preferences in your profile
- Explore the platform and discover new features

If you have any questions or need assistance, feel free to reach out to our support team.

Welcome aboard!

Best regards,
The Logosophe Team
      `;

      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.AUTH_RESEND_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'info@logosophe.com',
          to: subscriber.Email,
          subject: 'Welcome to Logosophe! 🎉',
          html: welcomeContent.replace(/\n/g, '<br>'),
          text: welcomeContent
        }),
      });

      if (!resendResponse.ok) {
        const errorText = await resendResponse.text();
        console.error('Failed to send welcome email via Resend:', errorText);
        // Don't fail verification if welcome email fails
      } else {
        console.log('Welcome email sent successfully via Resend');
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
