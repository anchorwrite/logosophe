import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext";

interface EmailData {
  name: string;
  email: string;
  subject: string;
  message: string;
  organization?: string;
  purpose?: string;
}

interface SubscriberEmailData {
  type: 'newsletter' | 'announcement' | 'role_update' | 'tenant_update' | 'workflow_update' | 'handle_update' | 'blog_update' | 'content_update' | 'welcome';
  subject: string;
  content: string;
  recipients: string[];
  tenantId?: string;
  roleFilter?: string;
  handleId?: number;
}

interface VerificationEmailData {
  email: string;
  name: string;
  type: 'subscription_verification';
}

// Helper function to validate CORS origin
function getCorsOrigin(request: Request): string {
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    'https://www.logosophe.com',
    'https://logosophe.com',
    'https://local-dev.logosophe.com'
  ];
  
  if (origin && allowedOrigins.includes(origin)) {
    return origin;
  }
  
  // Return the first allowed origin as fallback
  return allowedOrigins[0];
}

// Helper function to get sender name based on email type
function getSenderName(emailType: 'tenant_application' | 'contact_form' | 'newsletter' | 'verification' | 'announcement' | 'system' | 'welcome'): string {
  const senderNames = {
    tenant_application: 'Logosophe Tenant Application',
    contact_form: 'Logosophe Contact Submission',
    newsletter: 'Logosophe Newsletters',
    verification: 'Logosophe Email Verification',
    announcement: 'Logosophe Announcements',
    system: 'Logosophe System Notifications',
    welcome: 'Logosophe Welcome'
  };
  
  return senderNames[emailType];
}

// Helper function to get sender email address based on email type
function getSenderEmail(emailType: 'tenant_application' | 'contact_form' | 'newsletter' | 'verification' | 'announcement' | 'system' | 'welcome'): string {
  const senderEmails = {
    tenant_application: 'info@logosophe.com',
    contact_form: 'info@logosophe.com',
    newsletter: 'newsletters@logosophe.com',
    verification: 'verification@logosophe.com',
    announcement: 'announcements@logosophe.com',
    system: 'system@logosophe.com',
    welcome: 'verification@logosophe.com'
  };
  
  return senderEmails[emailType];
}

// Helper function to generate secure tokens
function generateSecureToken(): string {
  return crypto.randomUUID();
}

// Helper function to create email verification record
async function createEmailVerification(email: string, env: CloudflareEnv): Promise<string> {
  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
  
  try {
    const stmt = env.DB.prepare(`
      INSERT INTO EmailVerifications (Email, Token, ExpiresAt) 
      VALUES (?, ?, ?)
    `);
    await stmt.bind(email, token, expiresAt.toISOString()).run();
    return token;
  } catch (error) {
    console.error("Error creating email verification:", error);
    throw new Error("Failed to create verification token");
  }
}

// Helper function to create unsubscribe token
async function createUnsubscribeToken(email: string, emailType: string, env: CloudflareEnv): Promise<string> {
  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
  
  try {
    const stmt = env.DB.prepare(`
      INSERT INTO UnsubscribeTokens (Email, Token, EmailType, ExpiresAt) 
      VALUES (?, ?, ?, ?)
    `);
    await stmt.bind(email, token, emailType, expiresAt.toISOString()).run();
    return token;
  } catch (error) {
    console.error("Error creating unsubscribe token:", error);
    throw new Error("Failed to create unsubscribe token");
  }
}

// Helper function to log subscriber email
async function logSubscriberEmail(emailData: SubscriberEmailData, env: CloudflareEnv): Promise<void> {
  try {
    const stmt = env.DB.prepare(`
      INSERT INTO SubscriberEmails (EmailType, Subject, Content, SentTo, TenantId, RoleFilter, HandleId) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    await stmt.bind(
      emailData.type,
      emailData.subject,
      emailData.content,
      JSON.stringify(emailData.recipients),
      emailData.tenantId || null,
      emailData.roleFilter || null,
      emailData.handleId || null
    ).run();
  } catch (error) {
    console.error("Error logging subscriber email:", error);
    // Don't fail the email sending if logging fails
  }
}

// Helper function to check if a recipient wants to receive a specific type of email
async function shouldSendEmailToRecipient(recipient: string, emailType: string, env: CloudflareEnv, handleId?: number): Promise<boolean> {
  try {
    // Get subscriber's email preferences
    const subscriber = await env.DB.prepare(`
      SELECT EmailPreferences FROM Subscribers WHERE Email = ? AND Active = 1
    `).bind(recipient).first() as { EmailPreferences: string } | undefined;

    if (!subscriber) {
      console.log(`Recipient ${recipient} not found in Subscribers table or not active`);
      return false;
    }

    let preferences;
    try {
      preferences = JSON.parse(subscriber.EmailPreferences || '{}');
    } catch (error) {
      console.log(`Invalid preferences JSON for ${recipient}, using defaults`);
      // Default to allowing emails if preferences are invalid
      preferences = {
        newsletters: true,
        announcements: true,
        role_updates: true,
        tenant_updates: true,
        workflow_updates: true,
        handle_updates: true,
        blog_updates: true,
        content_updates: true,
        welcome: true
      };
    }

    // Check general email type preference
    if (!preferences[emailType]) {
      console.log(`Recipient ${recipient} has disabled ${emailType} emails`);
      return false;
    }

    // If this is a handle-specific email, check handle-specific preferences
    if (handleId && (emailType === 'handle_updates' || emailType === 'blog_updates' || emailType === 'content_updates' || emailType === 'announcements')) {
      const handleKey = `handle_${handleId}`;
      if (preferences[handleKey]) {
        const handlePreferences = preferences[handleKey];
        if (!handlePreferences[emailType]) {
          console.log(`Recipient ${recipient} has disabled ${emailType} emails for handle ${handleId}`);
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    console.error(`Error checking email preferences for ${recipient}:`, error);
    // Default to allowing emails if there's an error checking preferences
    return true;
  }
}

// Helper function to filter recipients based on email preferences
async function filterRecipientsByPreferences(recipients: string[], emailType: string, env: CloudflareEnv, handleId?: number): Promise<string[]> {
  const filteredRecipients: string[] = [];
  
  for (const recipient of recipients) {
    if (await shouldSendEmailToRecipient(recipient, emailType, env, handleId)) {
      filteredRecipients.push(recipient);
    }
  }
  
  console.log(`Filtered recipients: ${recipients.length} → ${filteredRecipients.length} (${recipients.length - filteredRecipients.length} filtered out by preferences)`);
  return filteredRecipients;
}

async function handleRequest(request: Request, env: CloudflareEnv): Promise<Response> {
  console.log("Received request:", {
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries())
  });

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': getCorsOrigin(request),
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { 'Access-Control-Allow-Origin': getCorsOrigin(request) },
    });
  }

  const url = new URL(request.url);
  const path = url.pathname;

  try {
    // Handle different endpoints based on path
    if (path === '/api/verification-email') {
      return await handleVerificationEmail(request, env);
    } else if (path === '/api/welcome-email') {
      return await handleWelcomeEmail(request, env);
    } else if (path === '/api/subscriber-email') {
      return await handleSubscriberEmail(request, env);
    } else if (path === '/api/handle-newsletter') {
      return await handleHandleNewsletter(request, env);
    } else {
      // Default: handle contact form and tenant applications
      return await handleContactForm(request, env);
    }
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process request",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(request),
        },
      }
    );
  }
}

// Handle verification email requests
async function handleVerificationEmail(request: Request, env: CloudflareEnv): Promise<Response> {
  try {
    const data = await request.json() as VerificationEmailData;
    console.log("Received verification email request:", data);

    if (!data.email || !data.name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": getCorsOrigin(request),
          },
        }
      );
    }

    // Create verification token
    const token = await createEmailVerification(data.email, env);
    
    // Create verification email
    const verificationUrl = `https://logosophe.com/verify-email/${token}`;
    const emailContent = `
Hello ${data.name},

Thank you for subscribing to Logosophe! To complete your subscription, please verify your email address by clicking the link below:

${verificationUrl}

This link will expire in 24 hours for security reasons.

If you didn't request this subscription, you can safely ignore this email.

Best regards,
The Logosophe Team
    `;

    // Send verification email
    const msg = createMimeMessage();
    const senderName = getSenderName('verification');
    const senderEmail = getSenderEmail('verification');
    
    msg.setSender({ name: senderName, addr: senderEmail });
    msg.setRecipient(data.email);
    msg.setSubject("Verify Your Email Address - Logosophe");
    msg.addMessage({
      contentType: 'text/plain',
      data: emailContent
    });

    const message = new EmailMessage(
      senderEmail,
      data.email,
      msg.asRaw()
    );
    
    await env.EMAIL.send(message);
    console.log("Verification email sent successfully");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Verification email sent successfully",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(request),
        },
      }
    );
  } catch (error) {
    console.error("Error sending verification email:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to send verification email",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(request),
        },
      }
    );
  }
}

// Handle welcome email requests
async function handleWelcomeEmail(request: Request, env: CloudflareEnv): Promise<Response> {
  try {
    const data = await request.json() as { email: string; name: string; type: string };
    console.log("Received welcome email request:", data);

    if (!data.email || !data.name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": getCorsOrigin(request),
          },
        }
      );
    }

    // Create welcome email content
    const welcomeContent = `
Hello ${data.name},

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
- Visit https://logosophe.com/harbor to access your workspace
- Customize your email preferences in your profile
- Explore the platform and discover new features

If you have any questions or need assistance, feel free to reach out to our support team.

Welcome aboard!

Best regards,
The Logosophe Team
    `;

    // Send welcome email via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.AUTH_RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'info@logosophe.com',
        to: data.email,
        subject: 'Welcome to Logosophe! 🎉',
        html: welcomeContent.replace(/\n/g, '<br>'),
        text: welcomeContent
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error('Failed to send welcome email via Resend:', errorText);
      throw new Error(`Resend API error: ${resendResponse.status}`);
    }
    
    console.log("Welcome email sent successfully via Resend");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Welcome email sent successfully",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(request),
        },
      }
    );
  } catch (error) {
    console.error("Error sending welcome email:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to send welcome email",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(request),
        },
      }
    );
  }
}

// Handle subscriber email requests
async function handleSubscriberEmail(request: Request, env: CloudflareEnv): Promise<Response> {
  try {
    const data = await request.json() as SubscriberEmailData;
    console.log("Received subscriber email request:", data);

    if (!data.type || !data.subject || !data.content || !data.recipients || data.recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": getCorsOrigin(request),
          },
        }
      );
    }

    // Filter recipients based on preferences
    const filteredRecipients = await filterRecipientsByPreferences(data.recipients, data.type, env, data.handleId);
    if (filteredRecipients.length === 0) {
      console.log("No recipients left after filtering by preferences.");
      return new Response(
        JSON.stringify({
          success: true,
          message: `No recipients left after filtering by preferences for type: ${data.type}`,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": getCorsOrigin(request),
          },
        }
      );
    }

    // Log the email for tracking
    await logSubscriberEmail(data, env);

    // Send email to each recipient
    const senderName = getSenderName(data.type as any);
    const senderEmail = getSenderEmail(data.type as any);
    
    for (const recipient of filteredRecipients) {
      // Create unsubscribe token for this recipient
      const unsubscribeToken = await createUnsubscribeToken(recipient, data.type, env);
      const unsubscribeUrl = `https://logosophe.com/unsubscribe/${unsubscribeToken}?type=${data.type}`;
      
      // Add unsubscribe footer to content
      const emailContent = `${data.content}

---
You're receiving this email because you're a subscriber to Logosophe.
To unsubscribe from ${data.type} emails, click here: ${unsubscribeUrl}
To manage all email preferences, visit: https://logosophe.com/harbor/preferences`;

      const msg = createMimeMessage();
      msg.setSender({ name: senderName, addr: senderEmail });
      msg.setRecipient(recipient);
      msg.setSubject(data.subject);
      msg.addMessage({
        contentType: 'text/plain',
        data: emailContent
      });

      const message = new EmailMessage(
        senderEmail,
        recipient,
        msg.asRaw()
      );
      
      await env.EMAIL.send(message);
      console.log(`Subscriber email sent to ${recipient}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Email sent to ${filteredRecipients.length} recipients successfully`,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(request),
        },
      }
    );
  } catch (error) {
    console.error("Error sending subscriber email:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to send subscriber email",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(request),
        },
      }
    );
  }
}

// Handle handle-specific newsletter requests
async function handleHandleNewsletter(request: Request, env: CloudflareEnv): Promise<Response> {
  try {
    const data = await request.json() as SubscriberEmailData & { handleId: number; handleName?: string; handleDescription?: string };
    console.log("Received handle newsletter request:", data);

    if (!data.handleId || !data.subject || !data.content || !data.recipients || data.recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": getCorsOrigin(request),
          },
        }
      );
    }

    // Filter recipients based on preferences
    const filteredRecipients = await filterRecipientsByPreferences(data.recipients, 'handle_updates', env, data.handleId);
    if (filteredRecipients.length === 0) {
      console.log("No recipients left after filtering by preferences.");
      return new Response(
        JSON.stringify({
          success: true,
          message: `No recipients left after filtering by preferences for handle updates for handle ${data.handleId}`,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": getCorsOrigin(request),
          },
        }
      );
    }

    // Log the email for tracking
    await logSubscriberEmail(data, env);

    // Send email to each recipient
    const senderName = getSenderName('newsletter');
    const senderEmail = getSenderEmail('newsletter');
    
    for (const recipient of filteredRecipients) {
      // Create unsubscribe token for this recipient
      const unsubscribeToken = await createUnsubscribeToken(recipient, 'handle_updates', env);
      const unsubscribeUrl = `https://logosophe.com/unsubscribe/${unsubscribeToken}?type=handle_updates&handle=${data.handleId}`;
      
      // Create handle-specific content
      const handleName = data.handleName || `Handle ${data.handleId}`;
      const handleDescription = data.handleDescription || '';
      const handleUrl = `https://logosophe.com/pages/${data.handleId}`;
      
      const emailContent = `${data.subject}

${data.content}

---
Latest from ${handleName}
${handleDescription}
View ${handleName} Page: ${handleUrl}

---
You're receiving this email because you're subscribed to ${handleName} updates from Logosophe.
To unsubscribe from ${handleName} updates, click here: ${unsubscribeUrl}
To manage all email preferences, visit: https://logosophe.com/harbor/preferences`;

      const msg = createMimeMessage();
      msg.setSender({ name: senderName, addr: senderEmail });
      msg.setRecipient(recipient);
      msg.setSubject(`${handleName} - ${data.subject}`);
      msg.addMessage({
        contentType: 'text/plain',
        data: emailContent
      });

      const message = new EmailMessage(
        senderEmail,
        recipient,
        msg.asRaw()
      );
      
      await env.EMAIL.send(message);
      console.log(`Handle newsletter sent to ${recipient}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Handle newsletter sent to ${filteredRecipients.length} recipients successfully`,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(request),
        },
      }
    );
  } catch (error) {
    console.error("Error sending handle newsletter:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to send handle newsletter",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(request),
        },
      }
    );
  }
}

// Handle contact form and tenant application requests (existing functionality)
async function handleContactForm(request: Request, env: CloudflareEnv): Promise<Response> {
  try {
    const data = await request.json() as EmailData;
    console.log("Received data:", data);

    // Validate required fields
    if (!data.name || !data.email || !data.message) {
      console.error("Missing required fields:", data);
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": getCorsOrigin(request),
          },
        }
      );
    }

    // Determine submission type and validate accordingly
    const isTenantApplication = data.organization && data.purpose;
    const emailType = isTenantApplication ? 'tenant_application' : 'contact_form';
    
    if (isTenantApplication) {
      // Tenant application - organization and purpose are required
      if (!data.organization || !data.purpose) {
        console.error("Missing tenant application fields:", data);
        return new Response(
          JSON.stringify({ error: "Missing organization or purpose for tenant application" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": getCorsOrigin(request),
            },
          }
        );
      }
    } else {
      // Contact form - subject is required
      if (!data.subject) {
        console.error("Missing subject for contact form:", data);
        return new Response(
          JSON.stringify({ error: "Missing subject for contact form" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": getCorsOrigin(request),
            },
          }
        );
      }
    }

    // Store in appropriate table based on data type
    try {
      if (isTenantApplication) {
        // This is a tenant application submission
        const stmt = env.DB.prepare(`
          INSERT INTO TenantSubmissions (name, email, organization, purpose, message, created_at) 
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        await stmt.bind(
          data.name,
          data.email,
          data.organization,
          data.purpose,
          data.message,
          new Date().toISOString()
        ).run();
        console.log("Successfully stored tenant application in database");
      } else {
        // This is a contact form submission
        const stmt = env.DB.prepare(`
          INSERT INTO ContactSubmissions (name, email, subject, message, created_at) 
          VALUES (?, ?, ?, ?, ?)
        `);
        await stmt.bind(
          data.name,
          data.email,
          data.subject,
          data.message,
          new Date().toISOString()
        ).run();
        console.log("Successfully stored contact submission in database");
      }
    } catch (dbError) {
      console.error("Error storing in database:", dbError);
      // Continue with email sending even if database fails
    }

    // Create appropriate email body based on submission type
    const emailBody = isTenantApplication
      ? `Name: ${data.name}\nEmail: ${data.email}\nOrganization: ${data.organization}\nPurpose: ${data.purpose}\n\nAdditional Details:\n${data.message}`
      : `Name: ${data.name}\nEmail: ${data.email}\nSubject: ${data.subject}\n\nMessage:\n${data.message}`;
    
    // Check if EMAIL binding exists
    if (!env.EMAIL) {
      console.error("EMAIL binding is not configured");
      return new Response(
        JSON.stringify({
          error: "Email service not configured",
          details: "The EMAIL binding is not available. Please check the wrangler.jsonc configuration.",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": getCorsOrigin(request),
          },
        }
      );
    }
    
    // Create email using mimetext library as recommended by Cloudflare
    const msg = createMimeMessage();
    const senderName = getSenderName(emailType);
    msg.setSender({ name: senderName, addr: env.EMAIL_FROM_ADDRESS });
    msg.setRecipient(env.EMAIL_TO_ADDRESS);
    msg.setSubject(data.subject);
    msg.addMessage({
      contentType: 'text/plain',
      data: emailBody
    });
    
    try {
      console.log("Sending email...");
      const message = new EmailMessage(
        env.EMAIL_FROM_ADDRESS,
        env.EMAIL_TO_ADDRESS,
        msg.asRaw()
      );
      await env.EMAIL.send(message);
      console.log("Email sent successfully");
      
      return new Response(
        JSON.stringify({
          success: true,
          message: "Email sent successfully",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": getCorsOrigin(request),
          },
        }
      );
    } catch (error) {
      console.error("Error sending email:", error);
      return new Response(
        JSON.stringify({
          error: "Failed to send email",
          details: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": getCorsOrigin(request),
          },
        }
      );
    }
  } catch (error) {
    console.error("Error processing contact form:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process contact form",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(request),
        },
      }
    );
  }
}

export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    return handleRequest(request, env);
  },
}; 