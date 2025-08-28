// Content Links API Route
// POST: Create content links
// GET: Retrieve content links for a specific source

import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json() as {
      sourceType: string;
      sourceId: string | number;
      linkedContentIds: number[];
    };
    
    const { sourceType, sourceId, linkedContentIds } = body;
    
    if (!sourceType || !sourceId || !Array.isArray(linkedContentIds)) {
      return Response.json(
        { success: false, error: 'Invalid request data' },
        { status: 400 }
      );
    }

    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;

    // Verify the source exists and belongs to the user
    let sourceExists = false;
    if (sourceType === 'blog_post') {
      const blogResult = await db.prepare(`
        SELECT sbp.Id FROM SubscriberBlogPosts sbp
        INNER JOIN SubscriberHandles sh ON sbp.HandleId = sh.Id
        WHERE sbp.Id = ? AND sh.SubscriberEmail = ?
      `).bind(sourceId, session.user.email).first();
      sourceExists = !!blogResult;
    } else if (sourceType === 'announcement') {
      const announcementResult = await db.prepare(`
        SELECT sa.Id FROM SubscriberAnnouncements sa
        INNER JOIN SubscriberHandles sh ON sa.HandleId = sh.Id
        WHERE sa.Id = ? AND sh.SubscriberEmail = ?
      `).bind(sourceId, session.user.email).first();
      sourceExists = !!announcementResult;
    }

    if (!sourceExists) {
      return Response.json(
        { success: false, error: 'Source not found or access denied' },
        { status: 404 }
      );
    }

    // Delete existing links for this source
    await db.prepare(`
      DELETE FROM ContentLinks 
      WHERE ContentType = ? AND ContentId = ?
    `).bind(sourceType, sourceId).run();

    // Insert new links
    for (const linkedContentId of linkedContentIds) {
      await db.prepare(`
        INSERT INTO ContentLinks (ContentType, ContentId, LinkedContentType, LinkedContentId, CreatedAt)
        VALUES (?, ?, 'published_content', ?, CURRENT_TIMESTAMP)
      `).bind(sourceType, sourceId, linkedContentId).run();
    }

    return Response.json({
      success: true,
      message: 'Content links saved successfully'
    });

  } catch (error) {
    console.error('Error saving content links:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceType = searchParams.get('sourceType');
    const sourceId = searchParams.get('sourceId');

    if (!sourceType || !sourceId) {
      return Response.json(
        { success: false, error: 'Missing sourceType or sourceId' },
        { status: 400 }
      );
    }

    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;

    // Get linked content for the specified source
    const linkedContentResult = await db.prepare(`
      SELECT 
        pc.Id, mf.FileName as Title, mf.Description, mf.MediaType, pc.AccessToken,
        pc.FormId, pc.GenreId, mf.Language, pc.PublishedAt,
        f.Name as FormName, g.Name as GenreName,
        pc.PublisherId
      FROM ContentLinks cl
      INNER JOIN PublishedContent pc ON cl.LinkedContentId = pc.Id
      INNER JOIN MediaFiles mf ON pc.MediaId = mf.Id
      LEFT JOIN Form f ON pc.FormId = f.Id
      LEFT JOIN Genre g ON pc.GenreId = g.Id
      WHERE cl.ContentType = ? AND cl.ContentId = ?
      ORDER BY pc.PublishedAt DESC
    `).bind(sourceType, sourceId).all();

    const linkedContent = linkedContentResult.results?.map((item: any) => ({
      id: item.Id as number,
      title: item.Title as string,
      description: item.Description as string | undefined,
      mediaType: item.MediaType as string,
      accessToken: item.AccessToken as string,
      form: item.FormName as string | undefined,
      genre: item.GenreName as string | undefined,
      language: item.Language as string | undefined,
      publisher: {
        email: item.PublisherId as string,
        name: item.PublisherId as string // Using email as name for now
      },
      publishedAt: item.PublishedAt as string
    })) || [];

    return Response.json({
      success: true,
      data: linkedContent
    });

  } catch (error) {
    console.error('Error fetching content links:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
