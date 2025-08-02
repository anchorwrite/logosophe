import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin, isTenantAdminFor } from '@/lib/access';
import { SystemLogs } from '@/lib/system-logs';


interface UserInfo {
  email: string;
  name: string | null;
  provider: string;
  isSubscriber: boolean;
  hasSignedIn: boolean; // NEW: Whether user has ever signed in
  tenants: Array<{
    id: string;
    name: string;
    role: string;
  }>;
  roles: string[];
  hasActiveSession: boolean;
  lastLogin: string | null;
  sessionDuration?: number;
  isBlocked: boolean;
  emailVerified: string | null;
  image: string | null;
}

interface QueryParams {
  page?: number;
  limit?: number;
  search?: string;
  tenantId?: string;
  status?: 'active' | 'inactive' | 'blocked';
  role?: string;
  subscriberStatus?: 'all' | 'subscribers' | 'non-subscribers';
  signedInStatus?: 'all' | 'signed-in' | 'never-signed-in';
  sortBy?: 'email' | 'name' | 'lastLogin' | 'provider';
  sortOrder?: 'asc' | 'desc';
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const systemLogs = new SystemLogs(db);

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
    const params: QueryParams = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      search: searchParams.get('search') || undefined,
      tenantId: searchParams.get('tenantId') || undefined,
      status: searchParams.get('status') as 'active' | 'inactive' | 'blocked' || undefined,
      role: searchParams.get('role') || undefined,
      subscriberStatus: searchParams.get('subscriberStatus') as 'all' | 'subscribers' | 'non-subscribers' || 'all',
      signedInStatus: searchParams.get('signedInStatus') as 'all' | 'signed-in' | 'never-signed-in' || 'all',
      sortBy: searchParams.get('sortBy') as 'email' | 'name' | 'lastLogin' | 'provider' || 'email',
      sortOrder: searchParams.get('sortOrder') as 'asc' | 'desc' || 'asc'
    };

    // Build the base query - use UNION to combine users from TenantUsers and Credentials tables
    let query = `
      SELECT 
        COALESCE(u.email, user_email) as email,
        u.name,
        u.emailVerified,
        u.image,
        COALESCE(a.provider, 
          CASE 
            WHEN COALESCE(u.email, user_email) LIKE '%@logosophe.test' THEN 'Test'
            WHEN c.Email IS NOT NULL THEN 'Credentials'
            ELSE 'unknown'
          END
        ) as provider,
        s.expires as lastLogin,
        CASE WHEN s.expires > datetime('now') THEN 1 ELSE 0 END as hasActiveSession,
        sub.Banned as isBlocked,
        CASE WHEN sub.Email IS NOT NULL THEN 1 ELSE 0 END as isSubscriber,
        CASE WHEN u.email IS NOT NULL THEN 1 ELSE 0 END as hasSignedIn,
        GROUP_CONCAT(DISTINCT t.Id) as tenantIds,
        GROUP_CONCAT(DISTINCT t.Name) as tenantNames,
        GROUP_CONCAT(DISTINCT r.Name) as roleNames
      FROM (
        SELECT tu.Email as user_email, tu.TenantId
        FROM TenantUsers tu
        UNION
        SELECT c.Email as user_email, NULL as TenantId
        FROM Credentials c
        WHERE c.Email NOT IN (SELECT Email FROM TenantUsers)
      ) combined_users
      LEFT JOIN users u ON combined_users.user_email = u.email
      LEFT JOIN accounts a ON u.id = a.userId
      LEFT JOIN sessions s ON u.id = s.userId
      LEFT JOIN Subscribers sub ON combined_users.user_email = sub.Email
      LEFT JOIN Tenants t ON combined_users.TenantId = t.Id
      LEFT JOIN UserRoles ur ON combined_users.user_email = ur.Email
      LEFT JOIN Roles r ON ur.RoleId = r.Id
      LEFT JOIN Credentials c ON combined_users.user_email = c.Email
    `;

    const whereConditions: string[] = [];
    const bindParams: any[] = [];

    // Add search filter
    if (params.search) {
      whereConditions.push('(COALESCE(u.email, user_email) LIKE ? OR u.name LIKE ?)');
      bindParams.push(`%${params.search}%`, `%${params.search}%`);
    }

    // Add tenant filter for tenant admins
    if (isTenantAdmin) {
      // Get tenants that this tenant admin manages
      const userTenants = await db.prepare(`
        SELECT TenantId FROM TenantUsers WHERE Email = ?
      `).bind(session.user.email).all() as { results: Array<{ TenantId: string }> };
      
      const tenantIds = userTenants.results.map(t => t.TenantId);
      if (tenantIds.length > 0) {
        whereConditions.push(`(combined_users.TenantId IN (${tenantIds.map(() => '?').join(',')}))`);
        bindParams.push(...tenantIds);
      } else {
        // If tenant admin has no tenants, return empty result
        return NextResponse.json({
          users: [],
          pagination: {
            page: params.page,
            limit: params.limit,
            total: 0,
            totalPages: 0
          }
        });
      }
    }

    // Add specific tenant filter
    if (params.tenantId) {
      whereConditions.push('combined_users.TenantId = ?');
      bindParams.push(params.tenantId);
    }

    // Add status filter
    if (params.status === 'active') {
      whereConditions.push('s.expires > datetime("now")');
    } else if (params.status === 'inactive') {
      whereConditions.push('(s.expires IS NULL OR s.expires <= datetime("now"))');
    } else if (params.status === 'blocked') {
      whereConditions.push('sub.Banned = 1');
    }

    // Add subscriber status filter
    if (params.subscriberStatus === 'subscribers') {
      whereConditions.push('sub.Email IS NOT NULL');
    } else if (params.subscriberStatus === 'non-subscribers') {
      whereConditions.push('sub.Email IS NULL');
    }

    // Add signed-in status filter
    if (params.signedInStatus === 'signed-in') {
      whereConditions.push('u.email IS NOT NULL');
    } else if (params.signedInStatus === 'never-signed-in') {
      whereConditions.push('u.email IS NULL');
    }

    // Add role filter
    if (params.role) {
      whereConditions.push('r.Name = ?');
      bindParams.push(params.role);
    }

    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }

    query += ' GROUP BY COALESCE(u.email, user_email)';

    // Add sorting
    let sortColumn;
    if (params.sortBy === 'lastLogin') {
      sortColumn = 's.expires';
    } else if (params.sortBy === 'email') {
      sortColumn = 'COALESCE(u.email, user_email)';
    } else if (params.sortBy === 'name') {
      sortColumn = 'u.name';
    } else if (params.sortBy === 'provider') {
      sortColumn = 'COALESCE(a.provider, CASE WHEN COALESCE(u.email, user_email) LIKE \'%@logosophe.test\' THEN \'Test\' WHEN c.Email IS NOT NULL THEN \'Credentials\' ELSE \'unknown\' END)';
    } else {
      sortColumn = 'COALESCE(u.email, user_email)';
    }
    query += ` ORDER BY ${sortColumn} ${(params.sortOrder || 'asc').toUpperCase()}`;

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT user_email) as count
      FROM (
        SELECT tu.Email as user_email, tu.TenantId
        FROM TenantUsers tu
        UNION
        SELECT c.Email as user_email, NULL as TenantId
        FROM Credentials c
        WHERE c.Email NOT IN (SELECT Email FROM TenantUsers)
      ) combined_users
      LEFT JOIN users u ON combined_users.user_email = u.email
      LEFT JOIN accounts a ON u.id = a.userId
      LEFT JOIN sessions s ON u.id = s.userId
      LEFT JOIN Subscribers sub ON combined_users.user_email = sub.Email
      LEFT JOIN Tenants t ON combined_users.TenantId = t.Id
      LEFT JOIN UserRoles ur ON combined_users.user_email = ur.Email
      LEFT JOIN Roles r ON ur.RoleId = r.Id
      LEFT JOIN Credentials c ON combined_users.user_email = c.Email
    `;
    
    // Add WHERE conditions to count query
    let countWhereConditions = '';
    if (whereConditions.length > 0) {
      countWhereConditions = ' WHERE ' + whereConditions.join(' AND ');
    }
    const finalCountQuery = countQuery + countWhereConditions;
    
    const countResult = await db.prepare(finalCountQuery).bind(...bindParams).first() as { count: number };
    const total = countResult.count;

    // Add pagination
    const offset = ((params.page || 1) - 1) * (params.limit || 20);
    query += ` LIMIT ${params.limit || 20} OFFSET ${offset}`;

    // Execute the main query
    const result = await db.prepare(query).bind(...bindParams).all();

    // Process the results
    const users: UserInfo[] = result.results.map((row: any) => {
      const tenantIds = row.tenantIds ? row.tenantIds.split(',') : [];
      const tenantNames = row.tenantNames ? row.tenantNames.split(',') : [];
      const roleNames = row.roleNames ? row.roleNames.split(',') : [];

      const tenants = tenantIds.map((id: string, index: number) => ({
        id,
        name: tenantNames[index] || id,
        role: 'user' // Default role, could be enhanced to get actual role
      }));

      return {
        email: row.email,
        name: row.name || row.email.split('@')[0], // Use email username as fallback
        provider: row.provider || 'unknown',
        isSubscriber: Boolean(row.isSubscriber),
        hasSignedIn: Boolean(row.hasSignedIn),
        tenants,
        roles: roleNames,
        hasActiveSession: Boolean(row.hasActiveSession),
        lastLogin: row.lastLogin,
        isBlocked: Boolean(row.isBlocked),
        emailVerified: row.emailVerified,
        image: row.image
      };
    });

    // Log the access
    await systemLogs.logAuth({
      userId: session.user.id || session.user.email,
      email: session.user.email,
      provider: 'credentials',
      activityType: 'user_management_access',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      metadata: {
        filters: params,
        resultCount: users.length
      }
    });

    return NextResponse.json({
      users,
      pagination: {
        page: params.page || 1,
        limit: params.limit || 20,
        total,
        totalPages: Math.ceil(total / (params.limit || 20))
      }
    });

  } catch (error) {
    console.error('Error in user management API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 