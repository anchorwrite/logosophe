import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { D1Database } from '@cloudflare/workers-types';
import { logAnnouncementAction } from '@/lib/subscriber-pages-logging';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ email: string; id: string }> }
) {
  try {
    const { email, id } = await params;
    const contactInfoId = parseInt(id, 10);
    const body = await request.json() as { 
      handleId: number; 
      contactEmail?: string; 
      phone?: string; 
      website?: string; 
      location?: string; 
      socialLinks?: string; 
      isPublic: boolean; 
      language: string;
      contactFormEnabled?: boolean;
    };
    const { handleId, contactEmail, phone, website, location, socialLinks, isPublic, language, contactFormEnabled } = body;
    
    console.log('PUT Debug - Request body:', body);
    console.log('PUT Debug - Parsed fields:', { handleId, contactEmail, phone, website, location, socialLinks, isPublic, language, contactFormEnabled });

    if (!handleId) {
      return Response.json(
        { success: false, error: 'Handle ID is required' },
        { status: 400 }
      );
    }

    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;

    // Get existing contact info and verify ownership
    const existingContactInfo = await db.prepare(`
      SELECT sci.*, sh.Handle, sh.DisplayName as HandleDisplayName
      FROM SubscriberContactInfo sci
      INNER JOIN SubscriberHandles sh ON sci.HandleId = sh.Id
      WHERE sci.Id = ? AND sh.SubscriberEmail = ?
    `).bind(contactInfoId, email).first();

    if (!existingContactInfo) {
      return Response.json(
        { success: false, error: 'Contact info not found or access denied' },
        { status: 404 }
      );
    }

    // Verify the new handle belongs to this subscriber
    const newHandleResult = await db.prepare(`
      SELECT Id, Handle, DisplayName FROM SubscriberHandles 
      WHERE Id = ? AND SubscriberEmail = ?
    `).bind(handleId, email).first();

    if (!newHandleResult) {
      return Response.json(
        { success: false, error: 'Handle not found or access denied' },
        { status: 404 }
      );
    }

    // Update the contact info
    const updateResult = await db.prepare(`
      UPDATE SubscriberContactInfo 
      SET HandleId = ?, Email = ?, Phone = ?, Website = ?, Location = ?, SocialLinks = ?, IsPublic = ?, Language = ?, UpdatedAt = ?, ContactFormEnabled = ?
      WHERE Id = ?
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
      contactFormEnabled !== undefined ? (contactFormEnabled ? 1 : 0) : null,
      contactInfoId
    ).run();

    if (!updateResult.success) {
      console.error('Database error updating contact info:', updateResult.error);
      return Response.json(
        { success: false, error: 'Failed to update contact info' },
        { status: 500 }
      );
    }

    // Log the action
    await logAnnouncementAction('updated', contactInfoId.toString(), email, {
      title: 'Contact Info',
      handleId: (existingContactInfo as any).HandleId,
      handle: (existingContactInfo as any).Handle
    });

    return Response.json({
      success: true,
      data: {
        message: 'Contact info updated successfully'
      }
    });

  } catch (error) {
    console.error('Error updating contact info:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ email: string; id: string }> }
) {
  try {
    const { email, id } = await params;
    const contactInfoId = parseInt(id, 10);

    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;

    // Get existing contact info and verify ownership
    const existingContactInfo = await db.prepare(`
      SELECT sci.*, sh.Handle, sh.DisplayName as HandleDisplayName
      FROM SubscriberContactInfo sci
      INNER JOIN SubscriberHandles sh ON sci.HandleId = sh.Id
      WHERE sci.Id = ? AND sh.SubscriberEmail = ?
    `).bind(contactInfoId, email).first();

    if (!existingContactInfo) {
      return Response.json(
        { success: false, error: 'Contact info not found or access denied' },
        { status: 404 }
      );
    }

    // Hard delete the contact info
    const deleteResult = await db.prepare(`
      DELETE FROM SubscriberContactInfo 
      WHERE Id = ?
    `).bind(contactInfoId).run();

    if (!deleteResult.success) {
      console.error('Database error deleting contact info:', deleteResult.error);
      return Response.json(
        { success: false, error: 'Failed to delete contact info' },
        { status: 500 }
      );
    }

    // Log the action
    await logAnnouncementAction('deleted', contactInfoId.toString(), email, {
      title: 'Contact Info',
      handleId: (existingContactInfo as any).HandleId,
      handle: (existingContactInfo as any).Handle
    });

    return Response.json({
      success: true,
      data: {
        message: 'Contact info deleted successfully'
      }
    });

  } catch (error) {
    console.error('Error deleting contact info:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
