import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getUserRole, getDB } from './request-context';
import { headers } from 'next/headers';
import { isSystemAdmin, isTenantAdminFor } from './access';

// Static type for compile-time safety
export type UserRole = 'admin' | 'tenant' | 'editor' | 'author' | 'subscriber' | 'agent' | 'reviewer' | 'user' | 'publisher';

// Runtime validation function
async function validateRolesAgainstDB(): Promise<void> {
  const db = await getDB();
  
  const { results } = await db.prepare(
    'SELECT Id, Name FROM Roles'
  ).all();
  
  const dbRoles = results
    .filter((r): r is { Id: string, Name: string } => typeof r.Id === 'string' && typeof r.Name === 'string')
    .map(r => r.Id.toLowerCase());
    
  // Type assertion to ensure our static type matches DB
  const staticRoles: UserRole[] = ['admin', 'tenant', 'editor', 'author', 'subscriber', 'agent', 'reviewer', 'user', 'publisher'];
  
  // Check if all DB roles are in our static type
  const missingRoles = dbRoles.filter(role => !staticRoles.includes(role as UserRole));
  if (missingRoles.length > 0) {
    console.warn('Database contains roles not defined in UserRole type:', missingRoles);
  }
  
  // Check if all static roles exist in DB
  const extraRoles = staticRoles.filter(role => !dbRoles.includes(role));
  if (extraRoles.length > 0) {
    console.warn('UserRole type contains roles not in database:', extraRoles);
  }
}

interface AccessControlOptions {
  requireAuth?: boolean;
  allowedRoles?: UserRole[];
  requireTenant?: boolean;
}

interface AccessResult {
  hasAccess: boolean;
  role: UserRole | null;
  email: string | null;
}

export async function checkAccess(options: AccessControlOptions): Promise<AccessResult> {
  const session = await auth();
  const email = session?.user.email ?? null;

  if (!email) {
    if (options.requireAuth) {
      return { hasAccess: false, role: null, email: null };
    }
    return { hasAccess: true, role: null, email: null };
  }

  try {
    const db = await getDB() as unknown as D1Database;

    // Validate roles during request handling
    await validateRolesAgainstDB().catch(console.error);

    // First check if user is a system admin
    const isAdmin = await isSystemAdmin(email, db);

    if (isAdmin) {
      return { hasAccess: true, role: 'admin', email };
    }

    // Check if user is a tenant admin in any tenant
    const credentialsUser = await db.prepare(
      'SELECT Role FROM Credentials WHERE Email = ?'
    ).bind(email).first();

    if (credentialsUser?.Role === 'tenant') {
      const result = { hasAccess: true, role: credentialsUser.Role as UserRole, email };
      return result;
    }

    // Check if user exists in TenantUsers
    const tenantUserCheck = await db.prepare(
      'SELECT 1 FROM TenantUsers WHERE Email = ?'
    ).bind(email).first();

    if (!tenantUserCheck) {
      return { hasAccess: false, role: null, email };
    }

    // Get all roles for this user across all tenants
    interface RoleResult { Id: string, Name: string }
    let roleResults: RoleResult[] = [];
    try {
      const roleResultsRaw = await db.prepare(
        `SELECT r.Id, r.Name FROM UserRoles ur JOIN Roles r ON ur.RoleId = r.Id WHERE ur.Email = ?`
      ).bind(email).all();
      if (Array.isArray(roleResultsRaw.results)) {
        roleResults = roleResultsRaw.results
          .filter((r): r is { Id: string, Name: string } => typeof r.Id === 'string' && typeof r.Name === 'string')
          .map((r) => ({ Id: r.Id, Name: r.Name }));
      }
    } catch (e) {
      // handle error or leave roleResults empty
    }

    // Check all roles - user has access if any role is allowed
    if (roleResults.length > 0) {
      const roles = roleResults.map(r => r.Id.toLowerCase() as UserRole);
      
      // If no specific roles are required, grant access with the first role
      if (!options.allowedRoles) {
        return { hasAccess: true, role: roles[0], email };
      }
      
      // Check if any of the user's roles are in the allowed roles
      const allowedRole = roles.find(role => options.allowedRoles?.includes(role));
      if (allowedRole) {
        return { hasAccess: true, role: allowedRole, email };
      }
    }

    // Finally check Subscribers table
    let subscriberResult: unknown = null;
    try {
      const subRaw = await db.prepare(
        'SELECT * FROM Subscribers WHERE Email = ?'
      ).bind(email).first();
      if (subRaw && typeof subRaw === 'object') {
        subscriberResult = subRaw;
      }
    } catch (e) {
      // handle error or leave subscriberResult null
    }

    // If user is a subscriber and subscriber role is allowed, grant access
    if (subscriberResult && (!options.allowedRoles || options.allowedRoles.includes('subscriber'))) {
      return { hasAccess: true, role: 'subscriber', email };
    }

    // If we get here, user has no allowed roles
    return { hasAccess: false, role: null, email };
  } catch (error) {
    return { hasAccess: false, role: null, email };
  }
}

export async function handleAccessControl(options: AccessControlOptions) {
  const access = await checkAccess(options);
  const headersList = await headers();
  const currentPath = headersList.get('x-url') ? new URL(headersList.get('x-url')!).pathname : '';
  
  // Extract language from current path if it exists
  const langMatch = currentPath.match(/^\/([a-z]{2})\//);
  const lang = langMatch ? langMatch[1] : 'en';
  
  // If no email and auth is required, redirect to signin
  if (!access.email && options.requireAuth) {
    if (!currentPath.startsWith('/signin')) {
      redirect('/signin');
    }
    return access;
  }

  // If user has access based on allowed roles, let them stay on current path
  if (access.hasAccess) {
    return access;
  }

  // If user doesn't have access, redirect based on role
  if (access.role === 'admin') {
    if (!currentPath.startsWith('/dashboard')) {
      redirect('/dashboard');
    }
  } else if (access.role === 'tenant') {
    if (!currentPath.startsWith('/dashboard')) {
      redirect('/dashboard');
    }
  } else if (access.role === 'subscriber' || access.role === 'editor' || access.role === 'author') {
    // Always use the current language for harbor redirects
    if (!currentPath.startsWith(`/${lang}/harbor`)) {
      redirect(`/${lang}/harbor`);
    }
  }

  return access;
}

export async function getTenantData(email: string) {
  const role = await getUserRole(email);
  if (role !== 'tenant') {
    return null;
  }

  // Add tenant data fetching logic here
  return null;
}

export async function getUserData(email: string) {
  const role = await getUserRole(email);
  if (!role) {
    return null;
  }

  // Add user data fetching logic here
  return null;
}