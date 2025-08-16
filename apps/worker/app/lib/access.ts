import { getCloudflareContext } from "@opennextjs/cloudflare";
import { auth } from "@/auth";
import { D1Database } from '@cloudflare/workers-types';

interface Tenant {
  Id: string;
  Name: string;
  Description: string;
  CreatedAt: string;
  UpdatedAt: string;
}

interface Role {
  Id: string;
  Name: string;
}

interface Permission {
  Id: string;
  Resource: string;
  Action: string;
}

export type ResourceType = 'blog' | 'media' | 'subscribers' | 'message' | 'workflow' | 'content';
export type Action = 'read' | 'write' | 'delete' | 'send' | 'complete' | 'publish' | 'unpublish' | 'manage_protection' | 'moderate' | 'view';

type RequestHandler = (request: Request) => Promise<Response>;

/**
 * Check if a user is a system admin (Credentials user with admin role)
 */
export async function isSystemAdmin(email: string, db: D1Database): Promise<boolean> {
  const result = await db.prepare(`
    SELECT 1 FROM Credentials 
    WHERE Email = ? AND Role = 'admin'
  `).bind(email).first();
  return !!result;
}

/**
 * Check if a user is a tenant admin (either in Credentials or TenantUsers table)
 */
export async function isTenantAdmin(email: string, db: D1Database): Promise<boolean> {
  // Check if user is a Credentials tenant admin
  const credentialsUser = await db.prepare(`
    SELECT 1 FROM Credentials WHERE Email = ? AND Role = 'tenant'
  `).bind(email).first();
  
  if (credentialsUser) {
    return true;
  }
  
  // Check if user is a TenantUsers tenant admin
  const tenantUser = await db.prepare(`
    SELECT 1 FROM TenantUsers WHERE Email = ? AND RoleId = 'tenant'
  `).bind(email).first();
  
  return !!tenantUser;
}

/**
 * Check if a user is a tenant admin for a specific tenant
 */
export async function isTenantAdminFor(email: string, tenantId: string): Promise<boolean> {
  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  
  // System admins are admins of all tenants
  if (await isSystemAdmin(email, db)) {
    return true;
  }

  // Check if user is a Credentials tenant admin and belongs to the tenant
  const credentialsTenantAdmin = await db.prepare(`
    SELECT 1 FROM TenantUsers tu
    JOIN Credentials c ON tu.Email = c.Email
    WHERE tu.Email = ? 
    AND tu.TenantId = ?
    AND c.Role = 'tenant'
    LIMIT 1
  `).bind(email, tenantId).first();

  if (credentialsTenantAdmin) {
    return true;
  }

  // Check if user is a TenantUsers tenant admin for this specific tenant
  const tenantUserAdmin = await db.prepare(`
    SELECT 1 FROM TenantUsers 
    WHERE Email = ? 
    AND TenantId = ?
    AND RoleId = 'tenant'
    LIMIT 1
  `).bind(email, tenantId).first();

  return !!tenantUserAdmin;
}

/**
 * Check if a user has a specific permission in a tenant
 */
export async function hasPermission(
  email: string,
  tenantId: string,
  resource: ResourceType,
  action: Action
): Promise<boolean> {
  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  
  // System admins have all permissions
  if (await isSystemAdmin(email, db)) {
    return true;
  }

  // Tenant admins have all permissions for their tenants
  if (await isTenantAdminFor(email, tenantId)) {
    return true;
  }

  // Get user's roles in the tenant
  const userRoles = await db.prepare(`
    SELECT r.Id, r.Name
    FROM Roles r
    JOIN UserRoles ur ON r.Id = ur.RoleId
    WHERE ur.Email = ?
  `).bind(email).all() as D1Result<Role>;

  if (!userRoles.results?.length) return false;

  // Get permissions for user's roles
  const roleIds = userRoles.results.map(r => r.Id);
  const permissions = await db.prepare(`
    SELECT DISTINCT p.Id, p.Resource, p.Action
    FROM Permissions p
    JOIN RolePermissions rp ON p.Id = rp.PermissionId
    WHERE rp.RoleId IN (${roleIds.map(() => '?').join(',')})
  `).bind(...roleIds).all() as D1Result<Permission>;

  // Check if user has the required permission
  return permissions.results?.some(p => 
    p.Resource === resource && p.Action === action
  ) || false;
}

/**
 * Check if a user has access to a specific resource in a tenant
 */
export async function hasResourceAccess(
  email: string,
  tenantId: string,
  resourceType: string,
  resourceId: string
): Promise<boolean> {
  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  
  // System admins have access to all resources
  if (await isSystemAdmin(email, db)) {
    return true;
  }

  // Check if user is a Credentials tenant admin
  const credentialsUser = await db.prepare(`
    SELECT Role FROM Credentials WHERE Email = ?
  `).bind(email).first();

  if (credentialsUser?.Role === 'tenant') {
    // For Credentials tenant users, verify they belong to this tenant
    const tenantAdmin = await db.prepare(`
      SELECT 1 FROM TenantUsers 
      WHERE Email = ? AND TenantId = ?
      LIMIT 1
    `).bind(email, tenantId).first();

    if (tenantAdmin) {
      return true; // Tenant admin has full access to their tenant's resources
    }
    return false;
  }

  // For non-Credentials users, check if they have any role in the tenant
  const userInTenant = await db.prepare(`
    SELECT 1
    FROM UserRoles
    WHERE Email = ? AND TenantId = ?
    LIMIT 1
  `).bind(email, tenantId).first();

  if (!userInTenant) return false;

  // Check if resource belongs to tenant
  const resource = await db.prepare(`
    SELECT 1
    FROM TenantResources
    WHERE TenantId = ?
    AND ResourceType = ?
    AND ResourceId = ?
    LIMIT 1
  `).bind(tenantId, resourceType, resourceId).first();

  return !!resource;
}