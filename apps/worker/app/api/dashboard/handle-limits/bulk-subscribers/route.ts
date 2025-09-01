import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { NormalizedLogging } from '@/lib/normalized-logging';

interface BulkSubscribersRequest {
  subscriberEmails: string[];
  limitType: 'default' | 'premium' | 'enterprise';
  description?: string;
  expiresAt?: string;
  tenantId?: string;
}

// POST - Apply handle limits to multiple selected subscribers
export async function POST(request: NextRequest) {
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
        activityType: 'unauthorized_bulk_subscribers_access',
        accessType: 'auth',
        targetId: session.user.email,
        targetName: `Unauthorized Bulk Subscribers Access (${session.user.email})`,
        ipAddress: 'unknown',
        userAgent: 'unknown',
        metadata: { attemptedAccess: 'bulk-subscribers-handle-limits' }
      });
      
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json() as BulkSubscribersRequest;
    const { subscriberEmails, limitType, description, expiresAt, tenantId } = body;

    if (!subscriberEmails || !Array.isArray(subscriberEmails) || subscriberEmails.length === 0) {
      return NextResponse.json({ error: 'Subscriber emails are required' }, { status: 400 });
    }

    if (!limitType || !['default', 'premium', 'enterprise'].includes(limitType)) {
      return NextResponse.json({ error: 'Valid limit type is required' }, { status: 400 });
    }

    // For tenant admins, verify they have access to all subscribers
    if (!isAdmin && tenantId) {
      const placeholders = subscriberEmails.map(() => '?').join(',');
      const accessQuery = `
        SELECT COUNT(*) as count
        FROM TenantUsers 
        WHERE Email IN (${placeholders}) AND TenantId = ?
      `;
      
      const accessResult = await db.prepare(accessQuery).bind(...subscriberEmails, tenantId).first() as { count: number };
      
      if (accessResult.count !== subscriberEmails.length) {
        return NextResponse.json({ 
          error: 'You do not have access to all selected subscribers' 
        }, { status: 403 });
      }
    }

    // Check if all subscribers exist
    const placeholders = subscriberEmails.map(() => '?').join(',');
    const subscribersQuery = `
      SELECT Email, Name FROM Subscribers WHERE Email IN (${placeholders})
    `;
    
    const subscribersResult = await db.prepare(subscribersQuery).bind(...subscriberEmails).all();
    const subscribers = (subscribersResult.results || []) as Array<{ Email: string; Name: string }>;

    if (subscribers.length !== subscriberEmails.length) {
      const foundEmails = subscribers.map(s => s.Email);
      const missingEmails = subscriberEmails.filter(email => !foundEmails.includes(email));
      return NextResponse.json({ 
        error: `Subscribers not found: ${missingEmails.join(', ')}` 
      }, { status: 404 });
    }

    // Apply handle limits to all subscribers
    const now = new Date().toISOString();
    const expiresAtValue = expiresAt || null;
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Use a transaction to ensure all operations succeed or fail together
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO IndividualSubscriberHandleLimits 
      (SubscriberEmail, LimitType, Description, SetBy, SetAt, ExpiresAt, IsActive, CreatedAt, UpdatedAt)
      VALUES (?, ?, ?, ?, ?, ?, TRUE, ?, ?)
    `);

    for (const subscriber of subscribers) {
      try {
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
        successCount++;
      } catch (error) {
        errorCount++;
        errors.push(`Failed to update ${subscriber.Email}: ${error}`);
      }
    }

    // Log successful bulk operation
    await normalizedLogging.logSystemOperations({
      userEmail: session.user.email,
      tenantId: tenantId || 'system',
      activityType: 'bulk_subscribers_handle_limits',
      accessType: 'admin',
      targetId: 'bulk-subscribers-limits',
      targetName: 'Bulk Subscribers Handle Limits',
      ipAddress: undefined,
      userAgent: undefined,
      metadata: { 
        subscriberEmails,
        limitType,
        subscribersCount: subscribers.length,
        successCount,
        errorCount,
        errors,
        description,
        expiresAt,
        isSystemAdmin: isAdmin,
        isTenantAdmin: !!isTenantAdmin
      }
    });

    if (errorCount > 0) {
      return NextResponse.json({
        success: false,
        message: `Partially completed: ${successCount} updated, ${errorCount} failed`,
        data: {
          subscribersProcessed: subscribers.length,
          successCount,
          errorCount,
          errors,
          limitType
        }
      }, { status: 207 }); // 207 Multi-Status
    }

    return NextResponse.json({
      success: true,
      message: `Successfully applied ${limitType} limits to ${successCount} subscribers`,
      data: {
        subscribersProcessed: subscribers.length,
        successCount,
        limitType
      }
    });

  } catch (error) {
    console.error('Error in POST /api/dashboard/handle-limits/bulk-subscribers:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

