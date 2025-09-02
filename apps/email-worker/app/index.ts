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
function getSenderName(emailType: 'tenant_application' | 'contact_form'): string {
  const senderNames = {
    tenant_application: 'Logosophe Tenant Application',
    contact_form: 'Logosophe Contact Submission'
  };
  
  return senderNames[emailType];
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
    // Default: handle contact form and tenant applications
    return await handleContactForm(request, env);
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