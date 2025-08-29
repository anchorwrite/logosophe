import { NextRequest, NextResponse } from "next/server";
import { NormalizedLogging, extractRequestContext } from "@/lib/normalized-logging";
import { getCloudflareContext } from "@opennextjs/cloudflare";

interface ContactRequestBody {
  name: string;
  email: string;
  subject: string;
  message: string;
}

interface WorkerResponse {
  message?: string;
  error?: string;
  details?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ContactRequestBody;
    const { name, email, subject, message } = body;

    // Validate the request body
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get database context for logging
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Log the contact form submission to SystemLogs
    try {
      const normalizedLogging = new NormalizedLogging(db);
      const { ipAddress, userAgent } = extractRequestContext(request);

      await normalizedLogging.logUserManagement({
        userEmail: email,
        tenantId: 'system',
        activityType: 'submit_contact_form',
        accessType: 'write',
        targetId: email,
        targetName: `Contact form submission from ${name}`,
        ipAddress,
        userAgent,
        metadata: {
          formType: 'contact_form',
          subject,
          messageLength: message.length,
          source: 'api_route'
        }
      });
    } catch (loggingError) {
      console.error('Failed to log contact form submission:', loggingError);
      // Continue with email sending even if logging fails
    }

    const workerUrl = process.env.EMAIL_WORKER_URL;
    if (!workerUrl) {
      throw new Error('EMAIL_WORKER_URL environment variable is not set');
    }

    // Ensure the URL has https:// prefix
    const formattedUrl = workerUrl.startsWith('http') ? workerUrl : `https:/${workerUrl}`;

    // Add prefix only if it's not already present
    const formattedSubject = subject.startsWith('New Contact Form Submission: ') 
      ? subject 
      : `New Contact Form Submission: ${subject}`;

    // Send to email worker
    const response = await fetch(formattedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        name, 
        email, 
        subject: formattedSubject, 
        message 
      }),
    });

    const responseData = await response.json() as WorkerResponse;

    if (!response.ok) {
      throw new Error(responseData.error || 'Failed to send message');
    }

    return NextResponse.json({ 
      message: 'Message sent successfully',
      data: responseData
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send message',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 