import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { D1Database } from '@cloudflare/workers-types';

export async function GET(request: NextRequest) {
  try {
    // This endpoint is public - no authentication required
    // It only returns handles that are marked as public

    // Get database connection
    const context = await getCloudflareContext({ async: true });
    const db = context.env.DB;

    // Get all public and active subscriber handles
    const handlesResult = await db.prepare(`
      SELECT 
        sh.Id,
        sh.Handle,
        sh.DisplayName,
        sh.Description,
        sh.IsActive,
        sh.IsPublic,
        sh.CreatedAt,
        sh.SubscriberEmail,
        sp.Bio,
        sp.Website,
        sp.SocialLinks
      FROM SubscriberHandles sh
      LEFT JOIN SubscriberProfiles sp ON sh.SubscriberEmail = sp.Email
      WHERE sh.IsActive = 1 AND sh.IsPublic = 1
      ORDER BY sh.CreatedAt DESC
    `).all();

    // Process handles to extract content focus and recent activity
    const processedHandles = handlesResult.results.map((handle: any) => {
      // Extract content focus from description, bio, or social links
      let contentFocus = '';
      if (handle.SocialLinks) {
        contentFocus = handle.SocialLinks;
      } else if (handle.Bio) {
        contentFocus = handle.Bio;
      } else if (handle.Description) {
        // Try to extract focus from description
        const description = handle.Description.toLowerCase();
        if (description.includes('poetry') || description.includes('poem')) {
          contentFocus = 'Poetry';
        } else if (description.includes('novel') || description.includes('fiction')) {
          contentFocus = 'Novels';
        } else if (description.includes('short story') || description.includes('short stories')) {
          contentFocus = 'Short Stories';
        } else if (description.includes('academic') || description.includes('research')) {
          contentFocus = 'Academic';
        } else if (description.includes('professional') || description.includes('business')) {
          contentFocus = 'Professional';
        } else if (description.includes('technical') || description.includes('technology')) {
          contentFocus = 'Technical';
        }
      }

      return {
        Id: handle.Id,
        Handle: handle.Handle,
        DisplayName: handle.DisplayName,
        Description: handle.Description || '',
        IsActive: Boolean(handle.IsActive),
        IsPublic: Boolean(handle.IsPublic),
        CreatedAt: handle.CreatedAt,
        SubscriberEmail: handle.SubscriberEmail,
        ContentFocus: contentFocus,
        Bio: handle.Bio,
        Website: handle.Website,
        SocialLinks: handle.SocialLinks
      };
    });

    return NextResponse.json({
      handles: processedHandles,
      total: processedHandles.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching subscriber handles for discovery:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscriber pages' },
      { status: 500 }
    );
  }
}
