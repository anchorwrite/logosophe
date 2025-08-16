import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Get blocks created by this user
    const blocksQuery = `
      SELECT 
        ub.Id,
        ub.BlockerEmail,
        ub.BlockedEmail,
        ub.TenantId,
        ub.BlockedAt,
        ub.IsActive,
        s.Name as BlockedUserName
      FROM UserBlocks ub
      LEFT JOIN Subscribers s ON ub.BlockedEmail = s.Email
      WHERE ub.BlockerEmail = ? 
      AND ub.TenantId = ? 
      AND ub.IsActive = TRUE
      ORDER BY ub.BlockedAt DESC
    `;

    const blocksResult = await db.prepare(blocksQuery)
      .bind(session.user.email, userTenantId)
      .all() as any;

    const blocks = blocksResult.results || [];

    return NextResponse.json({ 
      success: true, 
      blocks: blocks.map((block: any) => ({
        ...block,
        BlockedUserEmail: block.BlockedEmail
      }))
    });

  } catch (error) {
    console.error('Error fetching blocks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { blockedEmail } = await request.json() as { blockedEmail: string };
    if (!blockedEmail) {
      return NextResponse.json({ error: 'Blocked email is required' }, { status: 400 });
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

    // Check if user is trying to block themselves
    if (session.user.email === blockedEmail) {
      return NextResponse.json({ error: 'Cannot block yourself' }, { status: 400 });
    }

    // Check if the blocked user exists in the same tenant
    const blockedUserQuery = `
      SELECT 1 FROM (
        SELECT Email, TenantId FROM TenantUsers WHERE Email = ? AND TenantId = ?
        UNION ALL
        SELECT Email, TenantId FROM UserRoles WHERE Email = ? AND TenantId = ? AND RoleId = 'subscriber'
      )
    `;

    const blockedUserResult = await db.prepare(blockedUserQuery)
      .bind(blockedEmail, userTenantId, blockedEmail, userTenantId)
      .first();

    if (!blockedUserResult) {
      return NextResponse.json({ error: 'User not found in your tenant' }, { status: 404 });
    }

    // Check if block already exists
    const existingBlockQuery = `
      SELECT 1 FROM UserBlocks 
      WHERE BlockerEmail = ? AND BlockedEmail = ? AND TenantId = ? AND IsActive = TRUE
    `;

    const existingBlock = await db.prepare(existingBlockQuery)
      .bind(session.user.email, blockedEmail, userTenantId)
      .first();

    if (existingBlock) {
      return NextResponse.json({ error: 'User is already blocked' }, { status: 400 });
    }

    // Create the block
    const insertBlockQuery = `
      INSERT INTO UserBlocks (BlockerEmail, BlockedEmail, TenantId, BlockedAt, IsActive)
      VALUES (?, ?, ?, datetime('now'), TRUE)
    `;

    await db.prepare(insertBlockQuery)
      .bind(session.user.email, blockedEmail, userTenantId)
      .run();

    return NextResponse.json({ 
      success: true, 
      message: 'User blocked successfully' 
    });

  } catch (error) {
    console.error('Error creating block:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
