import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { detectLanguageFromHeaders, getEmailTemplate, renderWelcomeEmail } from '@/lib/email-templates';
import { loadTranslation } from '@/lib/translation-loader';

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
      WHERE VerificationToken = ? AND VerificationExpires > CURRENT_TIMESTAMP
    `).bind(token).first() as {
      Email: string;
      VerificationToken: string;
      VerificationExpires: string;
      EmailVerified: string | null;
      Active: boolean;
    } | undefined;

    if (!subscriber) {
      // Detect language from Accept-Language header for error messages
      const acceptLanguage = request.headers.get('accept-language');
      const detectedLanguage = detectLanguageFromHeaders(acceptLanguage);
      
      // Load translations for the detected language
      const translations = await loadTranslation(detectedLanguage);
      
      return NextResponse.json({ 
        error: 'invalid_or_expired_token',
        message: translations.verifyEmail?.invalidToken || 'This verification link is invalid or has expired. Please request a new verification email.',
        language: detectedLanguage
      }, { status: 400 });
    }

    if (subscriber.EmailVerified) {
      // Detect language from Accept-Language header for error messages
      const acceptLanguage = request.headers.get('accept-language');
      const detectedLanguage = detectLanguageFromHeaders(acceptLanguage);
      
      // Load translations for the detected language
      const translations = await loadTranslation(detectedLanguage);
      
      return NextResponse.json({ 
        error: 'email_already_verified',
        message: translations.verifyEmail?.alreadyVerifiedMessage || 'This email has already been verified.',
        email: subscriber.Email,
        language: detectedLanguage
      }, { status: 400 });
    }

    // Mark email as verified, activate subscriber, and clear verification token
    const updateResult = await db.prepare(`
      UPDATE Subscribers 
      SET EmailVerified = CURRENT_TIMESTAMP, 
          Active = true,
          VerificationToken = NULL, 
          VerificationExpires = NULL,
          UpdatedAt = CURRENT_TIMESTAMP 
      WHERE Email = ?
    `).bind(subscriber.Email).run();

    if ((updateResult as any).changes === 0) {
      return NextResponse.json({ error: 'Failed to verify email' }, { status: 500 });
    }

    // NOW add the subscriber role after successful verification
    try {
      // Get the user's tenant from TenantUsers
      const userTenant = await db.prepare(`
        SELECT TenantId FROM TenantUsers WHERE Email = ?
      `).bind(subscriber.Email).first() as { TenantId: string } | undefined;

      if (userTenant) {
        // Add subscriber role for the user's tenant
        await db.prepare(`
          INSERT OR IGNORE INTO UserRoles (TenantId, Email, RoleId)
          VALUES (?, ?, 'subscriber')
        `).bind(userTenant.TenantId, subscriber.Email).run();
      } else {
        // If no tenant found, add to default tenant
        await db.prepare(`
          INSERT OR IGNORE INTO UserRoles (TenantId, Email, RoleId)
          VALUES ('default', ?, 'subscriber')
        `).bind(subscriber.Email).run();
      }
    } catch (roleError) {
      console.error('Error adding subscriber role:', roleError);
      // Don't fail verification if role assignment fails
    }

    // Send welcome email after successful verification via Resend
    try {
      // Detect language from Accept-Language header
      const acceptLanguage = request.headers.get('accept-language');
      const detectedLanguage = detectLanguageFromHeaders(acceptLanguage);
      
      // Load translations for the detected language
      const translations = await loadTranslation(detectedLanguage);
      
      // Get email template for the detected language
      const emailTemplate = getEmailTemplate('welcome', detectedLanguage, translations);
      
      // Render the welcome email content
      const name = subscriber.Email.split('@')[0].charAt(0).toUpperCase() + subscriber.Email.split('@')[0].slice(1);
      const { subject, html, text } = renderWelcomeEmail(emailTemplate, name);

      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.AUTH_RESEND_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'info@logosophe.com',
          to: subscriber.Email,
          subject,
          html,
          text
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
