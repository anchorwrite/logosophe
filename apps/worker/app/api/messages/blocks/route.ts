import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { logMessagingActivity } from '@/lib/messaging';
import type { BlockUserRequest, UnblockUserRequest, GetUserBlocksResponse } from '@/types/messaging';

export const runtime = 'edge';

// GET /api/messages/blocks - Get user's blocking relationships
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    // Check if user has access to this tenant
    const isAdmin = await isSystemAdmin(session.user.email, db);
    const isTenantAdmin = await isTenantAdminFor(session.user.email, tenantId);
    
    if (!isAdmin && !isTenantAdmin) {
      // Regular users can only see their own blocks
      const blocks = await db.prepare(`
        SELECT ub.*, s.Name as BlockedUserName
        FROM UserBlocks ub
        LEFT JOIN Subscribers s ON ub.BlockedEmail = s.Email
        WHERE ub.BlockerEmail = ? AND ub.TenantId = ? AND ub.IsActive = TRUE
        ORDER BY ub.CreatedAt DESC
      `).bind(session.user.email, tenantId).all();

      const blockedBy = await db.prepare(`
        SELECT ub.*, s.Name as BlockerUserName
        FROM UserBlocks ub
        LEFT JOIN Subscribers s ON ub.BlockerEmail = s.Email
        WHERE ub.BlockedEmail = ? AND ub.TenantId = ? AND ub.IsActive = TRUE
        ORDER BY ub.CreatedAt DESC
      `).bind(session.user.email, tenantId).all();

      return NextResponse.json({
        blocks: blocks.results || [],
        blockedBy: blockedBy.results || []
      });
    } else {
      // Admins can see all blocks in the tenant
      const blocks = await db.prepare(`
        SELECT ub.*, 
               s1.Name as BlockerUserName,
               s2.Name as BlockedUserName
        FROM UserBlocks ub
        LEFT JOIN Subscribers s1 ON ub.BlockerEmail = s1.Email
        LEFT JOIN Subscribers s2 ON ub.BlockedEmail = s2.Email
        WHERE ub.TenantId = ? AND ub.IsActive = TRUE
        ORDER BY ub.CreatedAt DESC
      `).bind(tenantId).all();

      return NextResponse.json({
        blocks: blocks.results || [],
        blockedBy: []
      });
    }

  } catch (error) {
    console.error('Error getting user blocks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/messages/blocks - Block a user
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const body = await request.json() as BlockUserRequest;
    const { blockedEmail, tenantId, reason } = body;

    if (!blockedEmail || !tenantId) {
      return NextResponse.json({ error: 'Blocked email and tenant ID are required' }, { status: 400 });
    }

    // Check if user has permission to block in this tenant
    const isAdmin = await isSystemAdmin(session.user.email, db);
    const isTenantAdmin = await isTenantAdminFor(session.user.email, tenantId);
    
    if (!isAdmin && !isTenantAdmin) {
      // Regular users can only block within their own tenant
      const userTenant = await db.prepare(`
        SELECT 1 FROM TenantUsers WHERE Email = ? AND TenantId = ?
      `).bind(session.user.email, tenantId).first();

      if (!userTenant) {
        return NextResponse.json({ error: 'You can only block users in your own tenant' }, { status: 403 });
      }
    }

    // Check if blocked user exists in the tenant
    const blockedUser = await db.prepare(`
      SELECT 1 FROM TenantUsers WHERE Email = ? AND TenantId = ?
    `).bind(blockedEmail, tenantId).first();

    if (!blockedUser) {
      return NextResponse.json({ error: 'User not found in specified tenant' }, { status: 404 });
    }

    // Prevent blocking yourself
    if (session.user.email === blockedEmail) {
      return NextResponse.json({ error: 'You cannot block yourself' }, { status: 400 });
    }

    // Create or update the block
    await db.prepare(`
      INSERT OR REPLACE INTO UserBlocks 
      (BlockerEmail, BlockedEmail, TenantId, Reason, CreatedAt, IsActive)
      VALUES (?, ?, ?, ?, datetime('now'), TRUE)
    `).bind(session.user.email, blockedEmail, tenantId, reason || null).run();

    // Log the block
    await logMessagingActivity(
      'BLOCK_USER',
      session.user.email,
      tenantId,
      blockedEmail,
      `Blocked ${blockedEmail}`,
      { reason }
    );

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error blocking user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/messages/blocks - Unblock a user
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const { searchParams } = new URL(request.url);
    const blockedEmail = searchParams.get('blockedEmail');
    const tenantId = searchParams.get('tenantId');

    if (!blockedEmail || !tenantId) {
      return NextResponse.json({ error: 'Blocked email and tenant ID are required' }, { status: 400 });
    }

    // Check if user has permission to unblock
    const isAdmin = await isSystemAdmin(session.user.email, db);
    const isTenantAdmin = await isTenantAdminFor(session.user.email, tenantId);
    
    if (!isAdmin && !isTenantAdmin) {
      // Regular users can only unblock their own blocks
      const ownBlock = await db.prepare(`
        SELECT 1 FROM UserBlocks 
        WHERE BlockerEmail = ? AND BlockedEmail = ? AND TenantId = ?
      `).bind(session.user.email, blockedEmail, tenantId).first();

      if (!ownBlock) {
        return NextResponse.json({ error: 'You can only unblock users you have blocked' }, { status: 403 });
      }
    }

    // Deactivate the block
    await db.prepare(`
      UPDATE UserBlocks 
      SET IsActive = FALSE
      WHERE BlockerEmail = ? AND BlockedEmail = ? AND TenantId = ?
    `).bind(session.user.email, blockedEmail, tenantId).run();

    // Log the unblock
    await logMessagingActivity(
      'UNBLOCK_USER',
      session.user.email,
      tenantId,
      blockedEmail,
      `Unblocked ${blockedEmail}`
    );

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error unblocking user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 