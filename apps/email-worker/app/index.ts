import { EmailMessage } from "cloudflare:email";

interface EmailData {
  name: string;
  email: string;
  subject: string;
  message: string;
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

  try {
    const data = await request.json() as EmailData;
    console.log("Received data:", data);

    // Validate required fields
    if (!data.name || !data.email || !data.subject || !data.message) {
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

    // Store in database
    try {
      const stmt = env.DB.prepare(
        'INSERT INTO contact_submissions (name, email, subject, message, created_at) VALUES (?, ?, ?, ?, ?)'
      );
      await stmt.bind(
        data.name,
        data.email,
        data.subject,
        data.message,
        new Date().toISOString()
      ).run();
      console.log("Successfully stored submission in database");
    } catch (dbError) {
      console.error("Error storing in database:", dbError);
      // Continue with email sending even if database fails
    }

    const emailBody = `Name: ${data.name}\nEmail: ${data.email}\nSubject: ${data.subject}\n\nMessage:\n${data.message}`;
    
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
    
    // Create a simple, clean email message
    const messageId = `${Date.now()}@logosophe.workers.dev`;
    const date = new Date().toUTCString();
    const mimeMessage = [
      `From: ${env.EMAIL_FROM_ADDRESS}`,
      `To: ${env.EMAIL_TO_ADDRESS}`,
      `Subject: ${data.subject}`,
      `Message-ID: <${messageId}>`,
      `Date: ${date}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      emailBody
    ].join('\r\n');
    
    try {
      console.log("Sending email...");
      // Use the send_email binding's destination address instead of vars
      const message = new EmailMessage(
        env.EMAIL_FROM_ADDRESS,
        "info@logosophe.com", // Use the verified destination directly
        mimeMessage
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
    console.error("Error processing request:", error);
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