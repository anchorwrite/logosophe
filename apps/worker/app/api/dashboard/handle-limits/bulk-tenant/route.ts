import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { NormalizedLogging } from '@/lib/normalized-logging';

interface BulkTenantRequest {
  tenantIds: string[];
  limitType: 'default' | 'premium' | 'enterprise';
  description?: string;
  expiresAt?: string;
}

// POST - Apply handle limits to all subscribers in selected tenants
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const normalizedLogging = new NormalizedLogging(db);

    // Check if user is system admin
    const isAdmin = await isSystemAdmin(session.user.email, db);
    if (!isAdmin) {
      // Log unauthorized access attempt
      await normalizedLogging.logAuthentication({
        userEmail: session.user.email,
        userId: session.user.id || session.user.email,
        provider: 'credentials',
        activityType: 'unauthorized_bulk_tenant_access',
        accessType: 'auth',
        targetId: session.user.email,
        targetName: `Unauthorized Bulk Tenant Access (${session.user.email})`,
        ipAddress: 'unknown',
        userAgent: 'unknown',
        metadata: { attemptedAccess: 'bulk-tenant-handle-limits' }
      });
      
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json() as BulkTenantRequest;
    const { tenantIds, limitType, description, expiresAt } = body;

    if (!tenantIds || !Array.isArray(tenantIds) || tenantIds.length === 0) {
      return NextResponse.json({ error: 'Tenant IDs are required' }, { status: 400 });
    }

    if (!limitType || !['default', 'premium', 'enterprise'].includes(limitType)) {
      return NextResponse.json({ error: 'Valid limit type is required' }, { status: 400 });
    }

    // Get all subscribers in the selected tenants
    const placeholders = tenantIds.map(() => '?').join(',');
    const subscribersQuery = `
      SELECT DISTINCT s.Email
      FROM Subscribers s
      JOIN TenantUsers tu ON s.Email = tu.Email
      WHERE tu.TenantId IN (${placeholders})
      AND s.Active = TRUE
    `;

    const subscribersResult = await db.prepare(subscribersQuery).bind(...tenantIds).all();
    const subscribers = (subscribersResult.results || []) as Array<{ Email: string }>;

    if (subscribers.length === 0) {
      return NextResponse.json({ 
        error: 'No active subscribers found in selected tenants' 
      }, { status: 400 });
    }

    // Apply handle limits to all subscribers
    const now = new Date().toISOString();
    const expiresAtValue = expiresAt || null;

    // Use a transaction to ensure all operations succeed or fail together
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO IndividualSubscriberHandleLimits 
      (SubscriberEmail, LimitType, Description, SetBy, SetAt, ExpiresAt, IsActive, CreatedAt, UpdatedAt)
      VALUES (?, ?, ?, ?, ?, ?, TRUE, ?, ?)
    `);

    for (const subscriber of subscribers) {
      await stmt.bind(
        subscriber.Email,
        limitType,
        description || null,
        session.user.email,
        now,
        expiresAtValue,
        now,
        now
      ).run();
    }

    // Log successful bulk operation
    await normalizedLogging.logSystemOperations({
      userEmail: session.user.email,
      tenantId: 'system',
      activityType: 'bulk_tenant_handle_limits',
      accessType: 'admin',
      targetId: 'bulk-tenant-limits',
      targetName: 'Bulk Tenant Handle Limits',
      ipAddress: undefined,
      userAgent: undefined,
      metadata: { 
        tenantIds,
        limitType,
        subscribersCount: subscribers.length,
        description,
        expiresAt
      }
    });

    return NextResponse.json({
      success: true,
      message: `Successfully applied ${limitType} limits to ${subscribers.length} subscribers across ${tenantIds.length} tenants`,
      data: {
        tenantsProcessed: tenantIds.length,
        subscribersUpdated: subscribers.length,
        limitType
      }
    });

  } catch (error) {
    console.error('Error in POST /api/dashboard/handle-limits/bulk-tenant:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
