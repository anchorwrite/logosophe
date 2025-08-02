import { NextRequest, NextResponse } from "next/server";

// Use Edge Runtime for Cloudflare Pages
export const runtime = "edge";

interface TenantApplicationRequestBody {
  name: string;
  email: string;
  organization: string;
  purpose: string;
  message: string;
}

interface WorkerResponse {
  message?: string;
  error?: string;
  details?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as TenantApplicationRequestBody;
    const { name, email, organization, purpose, message } = body;

    // Validate the request body
    if (!name || !email || !organization || !purpose || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const workerUrl = process.env.EMAIL_WORKER_URL;
    if (!workerUrl) {
      throw new Error('EMAIL_WORKER_URL environment variable is not set');
    }

    // Ensure the URL has https:// prefix
    const formattedUrl = workerUrl.startsWith('http') ? workerUrl : `https:/${workerUrl}`;

    // Send to email worker
    const response = await fetch(formattedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        name, 
        email, 
        subject: 'New Tenant Application Submission', 
        message: `Organization: ${organization}\nPurpose: ${purpose}\n\nAdditional Details:\n${message}` 
      }),
    });

    const responseData = await response.json() as WorkerResponse;

    if (!response.ok) {
      throw new Error(responseData.error || 'Failed to submit application');
    }

    return NextResponse.json({ 
      message: 'Application submitted successfully',
      data: responseData
    });
  } catch (error) {
    console.error('Error submitting application:', error);
    return NextResponse.json(
      { 
        error: 'Failed to submit application',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 