import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { NormalizedLogging } from '@/lib/normalized-logging';

// GET - List subscribers for handle limits management
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
        activityType: 'unauthorized_subscribers_access',
        accessType: 'auth',
        targetId: session.user.email,
        targetName: `Unauthorized Subscribers Access (${session.user.email})`,
        ipAddress: 'unknown',
        userAgent: 'unknown',
        metadata: { attemptedAccess: 'subscribers' }
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
        s.CreatedAt,
        s.Active
      FROM Subscribers s
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

    query += ` ORDER BY s.Name ASC, s.Email ASC`;

    const result = await db.prepare(query).bind(...queryParams).all();
    const subscribers = result.results || [];

    // Log successful access
    await normalizedLogging.logSystemOperations({
      userEmail: session.user.email,
      tenantId: tenantId || 'system',
      activityType: 'list_subscribers',
      accessType: 'admin',
      targetId: 'subscribers-list',
      targetName: 'Subscribers List',
      ipAddress: undefined,
      userAgent: undefined,
      metadata: { 
        isSystemAdmin: isAdmin,
        isTenantAdmin: !!isTenantAdmin,
        tenantId,
        subscribersCount: subscribers.length
      }
    });

    return NextResponse.json({
      success: true,
      data: subscribers
    });

  } catch (error) {
    console.error('Error in GET /api/dashboard/handle-limits/subscribers:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
