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

    // Get all contact info for this subscriber across all handles
    const contactInfoResult = await db.prepare(`
      SELECT 
        sci.Id, sci.HandleId, sci.Email, sci.Phone, sci.Website, sci.Location, 
        sci.SocialLinks, sci.IsActive, sci.IsPublic, sci.Language,
        sci.CreatedAt, sci.UpdatedAt,
        sh.Handle, sh.DisplayName as HandleDisplayName
      FROM SubscriberContactInfo sci
      INNER JOIN SubscriberHandles sh ON sci.HandleId = sh.Id
      WHERE sh.SubscriberEmail = ?
      ORDER BY sh.DisplayName, sci.CreatedAt DESC
    `).bind(email).all();

    if (!contactInfoResult.success) {
      console.error('Database error fetching contact info:', contactInfoResult.error);
      return Response.json(
        { success: false, error: 'Failed to fetch contact info' },
        { status: 500 }
      );
    }

    const contactInfo = contactInfoResult.results as any[];

    return Response.json({
      success: true,
      data: contactInfo
    });

  } catch (error) {
    console.error('Error fetching contact info:', error);
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
    const body = await request.json() as { 
      handleId: number; 
      contactEmail?: string; 
      phone?: string; 
      website?: string; 
      location?: string; 
      socialLinks?: string; 
      isPublic: boolean; 
      language: string 
    };
    const { handleId, contactEmail, phone, website, location, socialLinks, isPublic, language } = body;

    if (!handleId) {
      return Response.json(
        { success: false, error: 'Handle ID is required' },
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

    // Check if contact info already exists for this handle
    const existingContactInfoResult = await db.prepare(`
      SELECT Id FROM SubscriberContactInfo 
      WHERE HandleId = ? AND IsActive = 1
    `).bind(handleId).first();

    if (existingContactInfoResult) {
      // Update existing contact info instead of creating new one
      const updateResult = await db.prepare(`
        UPDATE SubscriberContactInfo 
        SET Email = ?, Phone = ?, Website = ?, Location = ?, SocialLinks = ?, IsPublic = ?, Language = ?, UpdatedAt = ?
        WHERE Id = ?
      `).bind(
        contactEmail || null,
        phone || null,
        website || null,
        location || null,
        socialLinks || null,
        isPublic ? 1 : 0,
        language || 'en',
        new Date().toISOString(),
        (existingContactInfoResult as any).Id
      ).run();

      if (!updateResult.success) {
        console.error('Database error updating contact info:', updateResult.error);
        return Response.json(
          { success: false, error: 'Failed to update contact info' },
          { status: 500 }
        );
      }

      // Log the action
      await logAnnouncementAction('updated', (existingContactInfoResult as any).Id.toString(), email, {
        title: 'Contact Info',
        handleId: handleId,
        handle: (handleResult as any).Handle
      });

      return Response.json({
        success: true,
        data: {
          id: (existingContactInfoResult as any).Id,
          message: 'Contact info updated successfully'
        }
      });
    }

    // Create new contact info if none exists
    const insertResult = await db.prepare(`
      INSERT INTO SubscriberContactInfo (HandleId, Email, Phone, Website, Location, SocialLinks, IsPublic, Language, CreatedAt, UpdatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      handleId,
      contactEmail || null,
      phone || null,
      website || null,
      location || null,
      socialLinks || null,
      isPublic ? 1 : 0,
      language || 'en',
      new Date().toISOString(),
      new Date().toISOString()
    ).run();

    if (!insertResult.success) {
      console.error('Database error creating contact info:', insertResult.error);
      return Response.json(
        { success: false, error: 'Failed to create contact info' },
        { status: 500 }
      );
    }

    const contactInfoId = insertResult.meta.last_row_id;

    // Log the action
    await logAnnouncementAction('created', contactInfoId.toString(), email, {
      title: 'Contact Info',
      handleId: handleId,
      handle: (handleResult as any).Handle
    });

    return Response.json({
      success: true,
      data: {
        id: contactInfoId,
        message: 'Contact info created successfully'
      }
    });

  } catch (error) {
    console.error('Error creating contact info:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
