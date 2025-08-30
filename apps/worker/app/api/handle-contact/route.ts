import { NextRequest, NextResponse } from "next/server";
import { NormalizedLogging, extractRequestContext } from "@/lib/normalized-logging";
import { getCloudflareContext } from "@opennextjs/cloudflare";

interface HandleContactRequestBody {
  name: string;
  email: string;
  subject: string;
  message: string;
  handleId: number;
  handleName: string;
  handleEmail?: string;
}

interface WorkerResponse {
  message?: string;
  error?: string;
  details?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as HandleContactRequestBody;
    const { name, email, subject, message, handleId, handleName, handleEmail } = body;

    // Validate the request body
    if (!name || !email || !subject || !message || !handleId || !handleName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get database context for logging and validation
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Verify the handle exists and is public
    const handle = await db.prepare(`
      SELECT Id, DisplayName, Description, IsPublic
      FROM SubscriberHandles 
      WHERE Id = ? AND IsPublic = TRUE
    `).bind(handleId).first() as {
      Id: number;
      DisplayName: string;
      Description?: string;
      IsPublic: boolean;
    } | undefined;

    if (!handle) {
      return NextResponse.json(
        { error: 'Handle not found or not public' },
        { status: 404 }
      );
    }

    // Check if contact form is enabled for this handle
    const contactInfo = await db.prepare(`
      SELECT Id, Email, ContactFormEnabled
      FROM SubscriberContactInfo 
      WHERE HandleId = ? AND IsActive = TRUE
    `).bind(handleId).first() as {
      Id: number;
      Email: string;
      ContactFormEnabled: boolean;
    } | undefined;

    if (!contactInfo) {
      return NextResponse.json(
        { error: 'No contact info found for this handle' },
        { status: 400 }
      );
    }

    if (!contactInfo.ContactFormEnabled) {
      return NextResponse.json(
        { error: 'Contact form is disabled for this handle' },
        { status: 403 }
      );
    }

    if (!contactInfo.Email) {
      return NextResponse.json(
        { error: 'No contact email configured for this handle' },
        { status: 400 }
      );
    }

    const targetEmail = contactInfo.Email;

    // Log the handle contact form submission to SystemLogs
    try {
      const normalizedLogging = new NormalizedLogging(db);
      const { ipAddress, userAgent } = extractRequestContext(request);

      await normalizedLogging.logUserManagement({
        userEmail: email,
        tenantId: 'system',
        activityType: 'submit_handle_contact_form',
        accessType: 'write',
        targetId: handleId.toString(),
        targetName: `Handle contact form submission from ${name} to ${handleName}`,
        ipAddress,
        userAgent,
        metadata: {
          formType: 'handle_contact_form',
          handleId,
          handleName,
          subject,
          messageLength: message.length,
          source: 'api_route',
          targetEmail
        }
      });
    } catch (loggingError) {
      console.error('Failed to log handle contact form submission:', loggingError);
      // Continue with email sending even if logging fails
    }

    // Store the contact submission in the database
    try {
      await db.prepare(`
        INSERT INTO ContactSubmissions (
          Name, Email, Subject, Message, HandleId, HandleEmail, 
          CreatedAt, Status, Source
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'new', 'handle_contact_form')
      `).bind(name, email, subject, message, handleId, targetEmail).run();
    } catch (dbError) {
      console.error('Failed to store contact submission:', dbError);
      // Continue with email sending even if database storage fails
    }

    const workerUrl = process.env.EMAIL_WORKER_URL;
    if (!workerUrl) {
      throw new Error('EMAIL_WORKER_URL environment variable is not set');
    }

    // Ensure the URL has https:// prefix
    const formattedUrl = workerUrl.startsWith('http') ? workerUrl : `https://${workerUrl}`;

    // Add handle-specific prefix to subject
    const formattedSubject = `Handle Contact: ${handleName} - ${subject}`;

    // Send to email worker with handle-specific information
    const response = await fetch(formattedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        name, 
        email, 
        subject: formattedSubject, 
        message: `Handle: ${handleName}\n\n${message}`,
        type: 'handle_contact_form',
        handleId,
        handleName,
        handleEmail: targetEmail
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
    console.error('Error sending handle contact message:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send message',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
