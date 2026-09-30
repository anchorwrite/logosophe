import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { planTenantRoleChanges } from './tenant-membership.ts';

describe('planTenantRoleChanges', () => {
  it('adds a new membership with its roles (the base role comes with the first add)', () => {
    assert.deepEqual(planTenantRoleChanges({ default: ['user'] }, { default: ['user'], logosophe: ['user', 'author'] }), {
      addRoles: [{ tenantId: 'logosophe', roleId: 'author' }],
      removeRoles: [],
      removeMemberships: [],
    });
  });

  it('adds a base-role-only membership explicitly', () => {
    assert.deepEqual(planTenantRoleChanges({}, { t1: ['user'] }).addRoles, [{ tenantId: 't1', roleId: 'user' }]);
    assert.deepEqual(planTenantRoleChanges({}, { t1: [] }).addRoles, [{ tenantId: 't1', roleId: 'user' }]);
  });

  it('adds and removes individual roles in an existing membership', () => {
    assert.deepEqual(planTenantRoleChanges({ t1: ['user', 'author', 'reviewer'] }, { t1: ['user', 'author', 'editor'] }), {
      addRoles: [{ tenantId: 't1', roleId: 'editor' }],
      removeRoles: [{ tenantId: 't1', roleId: 'reviewer' }],
      removeMemberships: [],
    });
  });

  it('removes a whole membership instead of its roles one by one', () => {
    assert.deepEqual(planTenantRoleChanges({ t1: ['user', 'author'], t2: ['user'] }, { t2: ['user'] }), {
      addRoles: [],
      removeRoles: [],
      removeMemberships: ['t1'],
    });
  });

  it('never removes the base role and is a no-op when nothing changed', () => {
    assert.deepEqual(planTenantRoleChanges({ t1: ['user', 'author'] }, { t1: ['author'] }), {
      addRoles: [], removeRoles: [], removeMemberships: [],
    });
  });
});
