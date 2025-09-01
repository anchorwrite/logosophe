import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { D1Database } from '@cloudflare/workers-types';
import { logAnnouncementAction } from '@/lib/subscriber-pages-logging';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const { email } = await params;
    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const language = searchParams.get('language');
    const handleId = searchParams.get('handleId');
    const search = searchParams.get('search');

    // Build the WHERE clause dynamically
    let whereConditions = ['sh.SubscriberEmail = ?'];
    let bindParams: any[] = [email];

    if (status && status !== 'all') {
      if (status === 'public') {
        whereConditions.push('sb.IsPublic = 1 AND sb.IsActive = 1');
      } else if (status === 'private') {
        whereConditions.push('sb.IsPublic = 0 AND sb.IsActive = 1');
      } else if (status === 'archived') {
        whereConditions.push('sb.IsActive = 0');
      }
    }

    if (language && language !== 'all') {
      whereConditions.push('sb.Language = ?');
      bindParams.push(language);
    }

    if (handleId && handleId !== 'all') {
      whereConditions.push('sb.HandleId = ?');
      bindParams.push(parseInt(handleId));
    }

    if (search) {
      whereConditions.push('(sb.Bio LIKE ? OR sh.DisplayName LIKE ?)');
      bindParams.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get filtered biographies for this subscriber
    const biographiesResult = await db.prepare(`
      SELECT 
        sb.Id, sb.HandleId, sb.Bio, sb.IsActive, sb.IsPublic, sb.Language,
        sb.CreatedAt, sb.UpdatedAt,
        sh.Handle, sh.DisplayName as HandleDisplayName
      FROM SubscriberBiographies sb
      INNER JOIN SubscriberHandles sh ON sb.HandleId = sh.Id
      WHERE ${whereClause}
      ORDER BY sh.DisplayName, sb.CreatedAt DESC
    `).bind(...bindParams).all();

    if (!biographiesResult.success) {
      console.error('Database error fetching biographies:', biographiesResult.error);
      return Response.json(
        { success: false, error: 'Failed to fetch biographies' },
        { status: 500 }
      );
    }

    const biographies = biographiesResult.results as any[];

    return Response.json({
      success: true,
      data: biographies
    });

  } catch (error) {
    console.error('Error fetching biographies:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const { email } = await params;
    const body = await request.json() as { handleId: number; bio: string; isPublic: boolean; language: string };
    const { handleId, bio, isPublic, language } = body;

    if (!handleId || !bio) {
      return Response.json(
        { success: false, error: 'Handle ID and bio content are required' },
        { status: 400 }
      );
    }

    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;

    // Verify the handle belongs to this subscriber
    const handleResult = await db.prepare(`
      SELECT Id, Handle, DisplayName FROM SubscriberHandles 
      WHERE Id = ? AND SubscriberEmail = ?
    `).bind(handleId, email).first();

    if (!handleResult) {
      return Response.json(
        { success: false, error: 'Handle not found or access denied' },
        { status: 404 }
      );
    }

    // Check if a biography already exists for this handle
    const existingBiographyResult = await db.prepare(`
      SELECT Id FROM SubscriberBiographies 
      WHERE HandleId = ? AND IsActive = 1
    `).bind(handleId).first();

    if (existingBiographyResult) {
      // Update existing biography instead of creating new one
      const updateResult = await db.prepare(`
        UPDATE SubscriberBiographies 
        SET Bio = ?, IsPublic = ?, Language = ?, UpdatedAt = ?
        WHERE Id = ?
      `).bind(
        bio,
        isPublic ? 1 : 0,
        language || 'en',
        new Date().toISOString(),
        (existingBiographyResult as any).Id
      ).run();

      if (!updateResult.success) {
        console.error('Database error updating biography:', updateResult.error);
        return Response.json(
          { success: false, error: 'Failed to update biography' },
          { status: 500 }
        );
      }

      // Log the action
      await logAnnouncementAction('updated', (existingBiographyResult as any).Id.toString(), email, {
        title: 'Biography',
        handleId: handleId,
        handle: (handleResult as any).Handle
      });

      return Response.json({
        success: true,
        data: {
          id: (existingBiographyResult as any).Id,
          message: 'Biography updated successfully'
        }
      });
    }

    // Create new biography if none exists
    const insertResult = await db.prepare(`
      INSERT INTO SubscriberBiographies (HandleId, Bio, IsPublic, Language, CreatedAt, UpdatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      handleId,
      bio,
      isPublic ? 1 : 0,
      language || 'en',
      new Date().toISOString(),
      new Date().toISOString()
    ).run();

    if (!insertResult.success) {
      console.error('Database error creating biography:', insertResult.error);
      return Response.json(
        { success: false, error: 'Failed to create biography' },
        { status: 500 }
      );
    }

    const biographyId = insertResult.meta.last_row_id;

    // Log the action
    await logAnnouncementAction('created', biographyId.toString(), email, {
      title: 'Biography',
      handleId: handleId,
      handle: (handleResult as any).Handle
    });

    return Response.json({
      success: true,
      data: {
        id: biographyId,
        message: 'Biography created successfully'
      }
    });

  } catch (error) {
    console.error('Error creating biography:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
