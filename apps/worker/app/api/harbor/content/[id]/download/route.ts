// Public Content Download API Route
// GET: Download published content using access token

import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return Response.json(
        { success: false, error: 'Access token required' },
        { status: 400 }
      );
    }

    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;

    // Verify the content exists and the access token is valid
    const contentResult = await db.prepare(`
      SELECT 
        pc.Id, pc.AccessToken, pc.PublishedAt,
        mf.FileName, mf.ContentType, mf.R2Key, mf.FileSize
      FROM PublishedContent pc
      INNER JOIN MediaFiles mf ON pc.MediaId = mf.Id
      WHERE pc.Id = ? AND pc.AccessToken = ?
    `).bind(id, token).first();

    if (!contentResult) {
      return Response.json(
        { success: false, error: 'Content not found or invalid access token' },
        { status: 404 }
      );
    }

    // Log the download for analytics
    try {
      await db.prepare(`
        INSERT INTO ContentUsage (ContentId, UsageType, UsageData, CreatedAt)
        VALUES (?, 'download', ?, CURRENT_TIMESTAMP)
      `).bind(id, JSON.stringify({ 
        fileName: contentResult.FileName,
        contentType: contentResult.ContentType,
        fileSize: contentResult.FileSize
      })).run();
    } catch (logError) {
      // Don't fail the download if logging fails
      console.warn('Failed to log content download:', logError);
    }

    // For now, return a redirect to the R2 object
    // In a production system, you might want to proxy the file through your API
    // or generate a signed URL for direct R2 access
    const downloadUrl = `${process.env.R2_PUBLIC_URL || 'https://your-r2-domain.com'}/${contentResult.R2Key}`;
    
    return Response.redirect(downloadUrl, 302);

  } catch (error) {
    console.error('Error downloading content:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
