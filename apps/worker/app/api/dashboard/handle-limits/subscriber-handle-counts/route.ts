import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { NormalizedLogging } from '@/lib/normalized-logging';

// GET - Get handle counts for subscribers
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const normalizedLogging = new NormalizedLogging(db);

    // Check if user is system admin or tenant admin
    const isAdmin = await isSystemAdmin(session.user.email, db);
    const isTenantAdmin = !isAdmin && await db.prepare(
      'SELECT Role FROM Credentials WHERE Email = ?'
    ).bind(session.user.email).first() as { Role: string } | null;
    
    if (!isAdmin && !isTenantAdmin) {
      // Log unauthorized access attempt
      await normalizedLogging.logAuthentication({
        userEmail: session.user.email,
        userId: session.user.id || session.user.email,
        provider: 'credentials',
        activityType: 'unauthorized_handle_counts_access',
        accessType: 'auth',
        targetId: session.user.email,
        targetName: `Unauthorized Handle Counts Access (${session.user.email})`,
        ipAddress: 'unknown',
        userAgent: 'unknown',
        metadata: { attemptedAccess: 'subscriber-handle-counts' }
      });
      
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    let query = `
      SELECT 
        s.Email,
        s.Name,
        COALESCE(COUNT(sh.Id), 0) as HandleCount,
        COALESCE(COUNT(CASE WHEN sh.IsActive = 1 THEN 1 END), 0) as ActiveHandleCount,
        COALESCE(COUNT(CASE WHEN sh.IsPublic = 1 THEN 1 END), 0) as PublicHandleCount
      FROM Subscribers s
      LEFT JOIN SubscriberHandles sh ON s.Email = sh.SubscriberEmail
      WHERE s.Active = TRUE
    `;

    const queryParams: any[] = [];

    if (!isAdmin && tenantId) {
      // For tenant admins, only show subscribers in their tenant
      query += ` AND s.Email IN (
        SELECT tu.Email FROM TenantUsers tu WHERE tu.TenantId = ?
      )`;
      queryParams.push(tenantId);
    }

    query += ` GROUP BY s.Email, s.Name ORDER BY s.Name ASC, s.Email ASC`;

    const result = await db.prepare(query).bind(...queryParams).all();
    const handleCounts = result.results || [];

    // Log successful access
    await normalizedLogging.logSystemOperations({
      userEmail: session.user.email,
      tenantId: tenantId || 'system',
      activityType: 'list_subscriber_handle_counts',
      accessType: 'admin',
      targetId: 'subscriber-handle-counts-list',
      targetName: 'Subscriber Handle Counts List',
      ipAddress: undefined,
      userAgent: undefined,
      metadata: { 
        isSystemAdmin: isAdmin,
        isTenantAdmin: !!isTenantAdmin,
        tenantId,
        handleCountsCount: handleCounts.length
      }
    });

    return NextResponse.json({
      success: true,
      data: handleCounts
    });

  } catch (error) {
    console.error('Error in GET /api/dashboard/handle-limits/subscriber-handle-counts:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

