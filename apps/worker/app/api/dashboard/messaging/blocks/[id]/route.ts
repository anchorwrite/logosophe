import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { logMessagingActivity } from '@/lib/messaging';

// DELETE /api/messages/blocks/[id] - Delete a block by ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const { id: blockId } = await params;

    if (!blockId) {
      return NextResponse.json({ error: 'Block ID is required' }, { status: 400 });
    }

    // First, get the block details to check permissions
    const block = await db.prepare(`
      SELECT * FROM UserBlocks WHERE Id = ?
    `).bind(blockId).first() as {
      Id: number;
      BlockerEmail: string;
      BlockedEmail: string;
      TenantId: string;
      Reason: string;
      CreatedAt: string;
      IsActive: boolean;
    } | null;

    if (!block) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 });
    }

    // Check if user has permission to delete this block
    const isAdmin = await isSystemAdmin(session.user.email, db);
    const isTenantAdmin = await isTenantAdminFor(session.user.email, block.TenantId);
    
    if (!isAdmin && !isTenantAdmin) {
      // Regular users can only delete their own blocks
      if (block.BlockerEmail !== session.user.email) {
        return NextResponse.json({ error: 'You can only delete blocks you have created' }, { status: 403 });
      }
    }

    // Delete the block
    await db.prepare(`
      DELETE FROM UserBlocks WHERE Id = ?
    `).bind(blockId).run();

    // Log the deletion
    await logMessagingActivity(
      'DELETE_BLOCK',
      session.user.email,
      block.TenantId,
      block.BlockedEmail,
      `Deleted block for ${block.BlockedEmail}`
    );

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting block:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
