import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Block ID is required' }, { status: 400 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Get user's tenant
    const userTenantQuery = `
      SELECT tu.TenantId
      FROM TenantUsers tu
      WHERE tu.Email = ?
      UNION ALL
      SELECT ur.TenantId
      FROM UserRoles ur
      WHERE ur.Email = ? AND ur.RoleId = 'subscriber'
    `;

    const userTenantResult = await db.prepare(userTenantQuery)
      .bind(session.user.email, session.user.email)
      .first() as any;

    if (!userTenantResult?.TenantId) {
      return NextResponse.json({ error: 'User not found in any tenant' }, { status: 404 });
    }

    const userTenantId = userTenantResult.TenantId;

    // Check if the block exists and belongs to this user
    const blockQuery = `
      SELECT 1 FROM UserBlocks 
      WHERE Id = ? AND BlockerEmail = ? AND TenantId = ? AND IsActive = TRUE
    `;

    const block = await db.prepare(blockQuery)
      .bind(id, session.user.email, userTenantId)
      .first();

    if (!block) {
      return NextResponse.json({ error: 'Block not found or access denied' }, { status: 404 });
    }

    // Soft delete the block
    const deleteBlockQuery = `
      UPDATE UserBlocks 
      SET IsActive = FALSE 
      WHERE Id = ?
    `;

    await db.prepare(deleteBlockQuery)
      .bind(id)
      .run();

    return NextResponse.json({ 
      success: true, 
      message: 'User unblocked successfully' 
    });

  } catch (error) {
    console.error('Error unblocking user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
