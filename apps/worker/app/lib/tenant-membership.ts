/**
 * Plan for editing one subscriber's tenant memberships from the dashboard's
 * subscriber update form, using the tenant members API:
 *   POST   /api/tenant/[id]/users                       { Email, RoleId } — adds membership (with the base 'user' role) and a role
 *   DELETE /api/tenant/[id]/users/[email]/roles/[roleId] — removes one role
 *   DELETE /api/tenant/[id]/users/[email]               — removes the membership and all its roles
 *
 * A member always has the base 'user' role; the form edits the other roles.
 */

export const BASE_TENANT_ROLE = 'user';

/** Credential-level designations that are not assigned per tenant in UserRoles. */
export const NON_TENANT_ROLES = ['admin', 'tenant'];

/** tenantId → roles in that tenant; a tenant absent from the map means "not a member". */
export type TenantRoleMap = Record<string, string[]>;

export interface TenantRolePlan {
  addRoles: { tenantId: string; roleId: string }[];
  removeRoles: { tenantId: string; roleId: string }[];
  removeMemberships: string[];
}

const extraRoles = (roles: readonly string[] = []) =>
  [...new Set(roles)].filter((r) => r !== BASE_TENANT_ROLE);

/** Requests that take the subscriber's memberships from `current` to `desired`. */
export function planTenantRoleChanges(current: TenantRoleMap, desired: TenantRoleMap): TenantRolePlan {
  const plan: TenantRolePlan = { addRoles: [], removeRoles: [], removeMemberships: [] };

  for (const tenantId of Object.keys(current)) {
    if (!(tenantId in desired)) plan.removeMemberships.push(tenantId);
  }

  for (const [tenantId, roles] of Object.entries(desired)) {
    const wanted = extraRoles(roles);
    const had = tenantId in current ? extraRoles(current[tenantId]) : [];
    if (!(tenantId in current) && wanted.length === 0) {
      // New membership with only the base role
      plan.addRoles.push({ tenantId, roleId: BASE_TENANT_ROLE });
      continue;
    }
    for (const roleId of wanted) {
      if (!had.includes(roleId)) plan.addRoles.push({ tenantId, roleId });
    }
    for (const roleId of had) {
      if (!wanted.includes(roleId)) plan.removeRoles.push({ tenantId, roleId });
    }
  }
  return plan;
}
