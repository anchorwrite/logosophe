import { getCloudflareContext } from '@opennextjs/cloudflare';

interface RequestContext {
  env: {
    DB: D1Database;
  };
}

export { getCloudflareContext as getRequestContext };

export async function getDB(): Promise<D1Database> {
  return (await getCloudflareContext({async: true})).env.DB;
}

export async function isAdmin(email: string): Promise<boolean> {
  const db = await getDB();
  // First check Credentials table for administrative users
  const adminCredential = await db.prepare(
    'SELECT 1 FROM Credentials WHERE Email = ?'
  ).bind(email).first();
  
  if (adminCredential) {
    return true;
  }

  // Then check UserRoles for admin role
  const adminRole = await db.prepare(
    'SELECT 1 FROM UserRoles ur JOIN Roles r ON ur.RoleId = r.Id WHERE ur.Email = ? AND r.Name = ?'
  ).bind(email, 'admin').first();
  
  return !!adminRole;
}

export async function isTenant(email: string): Promise<boolean> {
  const db = await getDB();
  const result = await db.prepare(
    'SELECT 1 FROM UserRoles ur JOIN Roles r ON ur.RoleId = r.Id WHERE ur.Email = ? AND r.Name = ?'
  ).bind(email, 'tenant').first();
  return !!result;
}

export async function getUserRole(email: string): Promise<string | null> {
  const db = await getDB();

  // First check if user is in Credentials table (admin or tenant admin)
  const credResult = await db.prepare(
    'SELECT Role FROM Credentials WHERE Email = ?'
  ).bind(email).first();
  if (credResult && credResult.Role) {
    // Only allow 'admin' or 'tenant' as valid roles from Credentials
    if (credResult.Role === 'admin' || credResult.Role === 'tenant') {
      return credResult.Role;
    }
  }

  // Get all roles for this user across all tenants
  const roleResults = await db.prepare(
    `SELECT r.Name FROM UserRoles ur JOIN Roles r ON ur.RoleId = r.Id WHERE ur.Email = ?`
  ).bind(email).all();

  let found: string[] = [];
  if (Array.isArray(roleResults.results)) {
    found = roleResults.results
      .filter((r): r is { Name: string } => typeof r.Name === 'string')
      .map(r => r.Name.toLowerCase());
  }

  if (found.length > 0) {
    // Priority: admin > tenant > subscriber > user
    const priority = ['admin', 'tenant', 'subscriber', 'user'];
    for (const role of priority) {
      if (found.includes(role)) return role;
    }
    // If no priority match, return the first role found
    return found[0];
  }

  // Finally check Subscribers table
  const subscriberResult = await db.prepare(
    'SELECT * FROM Subscribers WHERE Email = ?'
  ).bind(email).first();
  if (subscriberResult) {
    return 'subscriber';
  }

  return null;
}