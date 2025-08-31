import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { NormalizedLogging } from '@/lib/normalized-logging';

interface CreateHandleLimitRequest {
  subscriberEmail: string;
  limitType: 'default' | 'premium' | 'enterprise';
  description?: string;
  expiresAt?: string;
  tenantId?: string;
}

// GET - List all individual handle limits
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
        activityType: 'unauthorized_handle_limits_access',
        accessType: 'auth',
        targetId: session.user.email,
        targetName: `Unauthorized Handle Limits Access (${session.user.email})`,
        ipAddress: 'unknown',
        userAgent: 'unknown',
        metadata: { attemptedAccess: 'handle-limits' }
      });
      
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    let query = `
      SELECT 
        ishl.Id,
        ishl.SubscriberEmail,
        ishl.MaxHandles,
        ishl.LimitType,
        ishl.Description,
        ishl.SetBy,
        ishl.SetAt,
        ishl.ExpiresAt,
        ishl.IsActive,
        ishl.CreatedAt,
        ishl.UpdatedAt,
        s.Name as SubscriberName,
        c.Email as AdminEmail
      FROM IndividualSubscriberHandleLimits ishl
      LEFT JOIN Subscribers s ON ishl.SubscriberEmail = s.Email
      LEFT JOIN Credentials c ON ishl.SetBy = c.Email
      WHERE ishl.IsActive = TRUE
    `;

    const queryParams: any[] = [];

    if (!isAdmin && tenantId) {
      // For tenant admins, only show limits for subscribers in their tenant
      query += ` AND ishl.SubscriberEmail IN (
        SELECT tu.Email FROM TenantUsers tu WHERE tu.TenantId = ?
      )`;
      queryParams.push(tenantId);
    }

    query += ` ORDER BY ishl.CreatedAt DESC`;

    const result = await db.prepare(query).bind(...queryParams).all();
    const limits = result.results || [];

    // Log successful access
    await normalizedLogging.logSystemOperations({
      userEmail: session.user.email,
      tenantId: tenantId || 'system',
      activityType: 'list_handle_limits',
      accessType: 'admin',
      targetId: 'handle-limits-list',
      targetName: 'Handle Limits List',
      ipAddress: undefined,
      userAgent: undefined,
      metadata: { 
        isSystemAdmin: isAdmin,
        isTenantAdmin: !!isTenantAdmin,
        tenantId,
        limitsCount: limits.length
      }
    });

    return NextResponse.json({
      success: true,
      data: limits
    });

  } catch (error) {
    console.error('Error in GET /api/dashboard/handle-limits:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// POST - Create or update individual handle limit
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json() as CreateHandleLimitRequest;
    const { subscriberEmail, limitType, description, expiresAt } = body;

    // Validate required fields
    if (!subscriberEmail || !limitType) {
      return NextResponse.json({ 
        error: 'Missing required fields: subscriberEmail, limitType' 
      }, { status: 400 });
    }

    // Validate limitType
    if (!['default', 'premium', 'enterprise'].includes(limitType)) {
      return NextResponse.json({ 
        error: 'limitType must be default, premium, or enterprise' 
      }, { status: 400 });
    }

    // Check if subscriber exists
    const subscriber = await db.prepare(`
      SELECT Email, Name FROM Subscribers WHERE Email = ?
    `).bind(subscriberEmail).first();

    if (!subscriber) {
      return NextResponse.json({ 
        error: 'Subscriber not found' 
      }, { status: 404 });
    }

    // For tenant admins, verify they have access to this subscriber
    if (!isAdmin) {
      const tenantAccess = await db.prepare(`
        SELECT 1 FROM TenantUsers WHERE Email = ? AND TenantId = ?
      `).bind(subscriberEmail, body.tenantId).first();

      if (!tenantAccess) {
        return NextResponse.json({ 
          error: 'You do not have access to this subscriber' 
        }, { status: 403 });
      }
    }

    // Check if individual limit already exists
    const existingLimit = await db.prepare(`
      SELECT Id FROM IndividualSubscriberHandleLimits WHERE SubscriberEmail = ?
    `).bind(subscriberEmail).first();

    let result;
    if (existingLimit) {
      // Update existing limit
      result = await db.prepare(`
        UPDATE IndividualSubscriberHandleLimits 
        SET LimitType = ?, Description = ?, ExpiresAt = ?, UpdatedAt = CURRENT_TIMESTAMP
        WHERE SubscriberEmail = ?
      `).bind(limitType, description || null, expiresAt || null, subscriberEmail).run();
    } else {
      // Create new limit
      result = await db.prepare(`
        INSERT INTO IndividualSubscriberHandleLimits 
        (SubscriberEmail, LimitType, Description, SetBy, ExpiresAt)
        VALUES (?, ?, ?, ?, ?)
      `).bind(subscriberEmail, limitType, description || null, session.user.email, expiresAt || null).run();
    }

    // Log the action
    await normalizedLogging.logSystemOperations({
      userEmail: session.user.email,
      tenantId: body.tenantId || 'system',
      activityType: existingLimit ? 'update_handle_limit' : 'create_handle_limit',
      accessType: 'admin',
      targetId: subscriberEmail,
      targetName: `Handle Limit for ${subscriber.Name || subscriberEmail}`,
      ipAddress: undefined,
      userAgent: undefined,
      metadata: { 
        limitType,
        description,
        expiresAt,
        isSystemAdmin: isAdmin,
        isTenantAdmin: !!isTenantAdmin
      }
    });

    return NextResponse.json({
      success: true,
      message: existingLimit ? 'Handle limit updated successfully' : 'Handle limit created successfully',
      data: {
        subscriberEmail,
        limitType,
        description,
        expiresAt
      }
    });

  } catch (error) {
    console.error('Error in POST /api/dashboard/handle-limits:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// DELETE - Remove individual handle limit
export async function DELETE(request: NextRequest) {
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const subscriberEmail = searchParams.get('subscriberEmail');
    const tenantId = searchParams.get('tenantId');

    if (!subscriberEmail) {
      return NextResponse.json({ 
        error: 'Missing subscriberEmail parameter' 
      }, { status: 400 });
    }

    // Check if individual limit exists
    const existingLimit = await db.prepare(`
      SELECT Id FROM IndividualSubscriberHandleLimits WHERE SubscriberEmail = ?
    `).bind(subscriberEmail).first();

    if (!existingLimit) {
      return NextResponse.json({ 
        error: 'Handle limit not found' 
      }, { status: 404 });
    }

    // For tenant admins, verify they have access to this subscriber
    if (!isAdmin) {
      const tenantAccess = await db.prepare(`
        SELECT 1 FROM TenantUsers WHERE Email = ? AND TenantId = ?
      `).bind(subscriberEmail, tenantId).first();

      if (!tenantAccess) {
        return NextResponse.json({ 
          error: 'You do not have access to this subscriber' 
        }, { status: 403 });
      }
    }

    // Soft delete the limit
    await db.prepare(`
      UPDATE IndividualSubscriberHandleLimits 
      SET IsActive = FALSE, UpdatedAt = CURRENT_TIMESTAMP
      WHERE SubscriberEmail = ?
    `).bind(subscriberEmail).run();

    // Log the action
    await normalizedLogging.logSystemOperations({
      userEmail: session.user.email,
      tenantId: tenantId || 'system',
      activityType: 'delete_handle_limit',
      accessType: 'admin',
      targetId: subscriberEmail,
      targetName: `Handle Limit for ${subscriberEmail}`,
      ipAddress: undefined,
      userAgent: undefined,
      metadata: { 
        isSystemAdmin: isAdmin,
        isTenantAdmin: !!isTenantAdmin
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Handle limit removed successfully'
    });

  } catch (error) {
    console.error('Error in DELETE /api/dashboard/handle-limits:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
