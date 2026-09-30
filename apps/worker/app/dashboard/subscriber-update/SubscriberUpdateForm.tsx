'use client';

import { useEffect, useState } from 'react';
import { Button, TextField, Text, Box, Checkbox, Flex } from '@radix-ui/themes';
import { useToast } from '@/components/Toast';
import { useRouter } from 'next/navigation';
import {
  BASE_TENANT_ROLE,
  NON_TENANT_ROLES,
  planTenantRoleChanges,
  type TenantRoleMap,
} from '@/lib/tenant-membership';

interface Subscriber {
  Email: string;
  Name: string;
  Provider: string;
  Active: boolean;
  Banned: boolean;
  Post: boolean;
  Moderate: boolean;
  Track: boolean;
}

interface SubscriberUpdateFormProps {
  subscriber: Subscriber;
  onUpdateComplete: () => void;
}

interface Tenant {
  Id: string;
  Name: string;
}

interface Role {
  Id: string;
  Name: string;
}

/** GET /api/tenant: tenants this admin may manage (all for system admins). */
interface TenantsResponse {
  results?: Tenant[];
}

/** GET /api/tenant/[id]/users: one row per member role (UserRoles). */
interface TenantUsersResponse {
  results?: { Email: string; RoleId: string }[];
}

export function SubscriberUpdateForm({ subscriber, onUpdateComplete }: SubscriberUpdateFormProps) {
  const { showToast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  // Roles per tenant as loaded (current) and as edited (desired); absent tenant = not a member
  const [currentRoles, setCurrentRoles] = useState<TenantRoleMap>({});
  const [desiredRoles, setDesiredRoles] = useState<TenantRoleMap>({});
  const [formData, setFormData] = useState<Subscriber>({
    Email: subscriber.Email,
    Name: subscriber.Name,
    Provider: subscriber.Provider,
    Active: subscriber.Active,
    Banned: subscriber.Banned,
    Post: subscriber.Post,
    Moderate: subscriber.Moderate,
    Track: subscriber.Track
  });

  // Load the tenants this admin manages, the assignable roles, and the subscriber's roles per tenant
  const loadMemberships = async () => {
    setTenantsLoading(true);
    try {
      const [tenantsResponse, rolesResponse] = await Promise.all([fetch('/api/tenant'), fetch('/api/roles')]);
      if (!tenantsResponse.ok) throw new Error('Failed to fetch tenants');
      if (!rolesResponse.ok) throw new Error('Failed to fetch roles');
      const tenantList = ((await tenantsResponse.json()) as TenantsResponse).results || [];
      const roleList = ((await rolesResponse.json()) as { results?: Role[] }).results || [];
      setTenants(tenantList);
      setRoles(roleList.filter((r) => !NON_TENANT_ROLES.includes(r.Id) && r.Id !== BASE_TENANT_ROLE));

      const email = subscriber.Email.toLowerCase();
      const memberships: TenantRoleMap = {};
      await Promise.all(tenantList.map(async (tenant) => {
        const response = await fetch(`/api/tenant/${encodeURIComponent(tenant.Id)}/users`);
        if (!response.ok) throw new Error(`Failed to load members of ${tenant.Name}`);
        const rows = ((await response.json()) as TenantUsersResponse).results || [];
        const mine = rows.filter((row) => row.Email?.toLowerCase() === email).map((row) => row.RoleId);
        if (mine.length > 0) memberships[tenant.Id] = mine;
      }));
      setCurrentRoles(memberships);
      setDesiredRoles(memberships);
    } catch (error) {
      console.error('Error loading tenant memberships:', error);
      showToast({
        title: 'Error',
        content: error instanceof Error ? error.message : 'Failed to load tenants',
        type: 'error'
      });
    } finally {
      setTenantsLoading(false);
    }
  };

  useEffect(() => {
    void loadMemberships();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriber.Email]);

  const setMembership = (tenantId: string, member: boolean) => {
    setDesiredRoles((prev) => {
      const next = { ...prev };
      if (member) next[tenantId] = currentRoles[tenantId] || [BASE_TENANT_ROLE];
      else delete next[tenantId];
      return next;
    });
  };

  const setTenantRole = (tenantId: string, roleId: string, on: boolean) => {
    setDesiredRoles((prev) => {
      const roles = prev[tenantId] || [BASE_TENANT_ROLE];
      return {
        ...prev,
        [tenantId]: on ? [...new Set([...roles, roleId])] : roles.filter((r) => r !== roleId),
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log('Starting subscriber update...', { email: subscriber.Email });

      // Update subscriber
      const response = await fetch('/api/subscribers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          op: 'update',
          updateId: subscriber.Email,
          ...formData
        }),
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(`Failed to update subscriber: ${errorData.error || response.statusText}`);
      }

      console.log('Subscriber basic info updated successfully');

      // Apply tenant membership and role changes through the tenant members API
      const { addRoles, removeRoles, removeMemberships } = planTenantRoleChanges(currentRoles, desiredRoles);
      const usersUrl = (tenantId: string) => `/api/tenant/${encodeURIComponent(tenantId)}/users`;
      const memberUrl = (tenantId: string) => `${usersUrl(tenantId)}/${encodeURIComponent(subscriber.Email)}`;
      const failure = async (response: Response, what: string) => {
        const data = await response.json().catch(() => ({})) as { error?: string; message?: string };
        return new Error(`${what}: ${data.message || data.error || response.statusText}`);
      };

      for (const tenantId of removeMemberships) {
        const response = await fetch(memberUrl(tenantId), { method: 'DELETE' });
        if (!response.ok) throw await failure(response, `Failed to remove tenant ${tenantId}`);
      }
      for (const { tenantId, roleId } of removeRoles) {
        const response = await fetch(`${memberUrl(tenantId)}/roles/${encodeURIComponent(roleId)}`, { method: 'DELETE' });
        if (!response.ok) throw await failure(response, `Failed to remove ${roleId} in ${tenantId}`);
      }
      for (const { tenantId, roleId } of addRoles) {
        const response = await fetch(usersUrl(tenantId), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ Email: subscriber.Email, RoleId: roleId }),
        });
        // A new membership already includes the base role
        if (!response.ok && !(roleId === BASE_TENANT_ROLE && response.status === 400)) {
          throw await failure(response, `Failed to add ${roleId} in ${tenantId}`);
        }
      }

      setCurrentRoles(desiredRoles);
      console.log('All tenant assignments updated successfully');
      showToast({
        title: 'Success',
        content: 'Subscriber updated successfully',
        type: 'success'
      });
      onUpdateComplete();
    } catch (error) {
      console.error('Error updating subscriber:', error);
      showToast({
        title: 'Error',
        content: error instanceof Error ? error.message : 'Failed to update subscriber',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-4">
        <Box>
          <Text as="label" size="2" weight="bold" mb="1">
            Email
          </Text>
          <TextField.Root>
            <TextField.Input
              value={formData.Email}
              readOnly
              disabled
            />
          </TextField.Root>
        </Box>

        <Box>
          <Text as="label" size="2" weight="bold" mb="1">
            Name
          </Text>
          <TextField.Root>
            <TextField.Input
              value={formData.Name}
              onChange={(e) => setFormData({ ...formData, Name: e.target.value })}
              required
            />
          </TextField.Root>
        </Box>

        <Box>
          <Text as="label" size="2" weight="bold" mb="1">
            Provider
          </Text>
          <TextField.Root>
            <TextField.Input
              value={formData.Provider}
              readOnly
              disabled
            />
          </TextField.Root>
        </Box>

        <Box>
          <Text as="label" size="2" weight="bold" mb="1">
            Permissions
          </Text>
          <div className="space-y-2">
            <Flex align="center" gap="2">
              <Checkbox
                checked={formData.Active}
                onCheckedChange={(checked) => setFormData({ ...formData, Active: checked as boolean })}
              />
              <Text size="2">Active</Text>
            </Flex>
            <Flex align="center" gap="2">
              <Checkbox
                checked={formData.Banned}
                onCheckedChange={(checked) => setFormData({ ...formData, Banned: checked as boolean })}
              />
              <Text size="2">Banned</Text>
            </Flex>
            <Flex align="center" gap="2">
              <Checkbox
                checked={formData.Post}
                onCheckedChange={(checked) => setFormData({ ...formData, Post: checked as boolean })}
              />
              <Text size="2">Can Post</Text>
            </Flex>
            <Flex align="center" gap="2">
              <Checkbox
                checked={formData.Moderate}
                onCheckedChange={(checked) => setFormData({ ...formData, Moderate: checked as boolean })}
              />
              <Text size="2">Can Moderate</Text>
            </Flex>
            <Flex align="center" gap="2">
              <Checkbox
                checked={formData.Track}
                onCheckedChange={(checked) => setFormData({ ...formData, Track: checked as boolean })}
              />
              <Text size="2">Can Track</Text>
            </Flex>
          </div>
        </Box>

        <Box>
          <Text as="label" size="2" weight="bold" mb="1">
            Tenants
          </Text>
          {tenantsLoading ? (
            <Text size="2" color="gray">Loading tenants…</Text>
          ) : tenants.length === 0 ? (
            <Text size="2" color="gray">No tenants you can manage.</Text>
          ) : (
            <div className="space-y-3">
              {tenants.map((tenant) => {
                const tenantRoles = desiredRoles[tenant.Id];
                const isMember = tenantRoles !== undefined;
                return (
                  <Box key={tenant.Id}>
                    <Flex align="center" gap="2">
                      <Checkbox
                        checked={isMember}
                        onCheckedChange={(checked) => setMembership(tenant.Id, checked === true)}
                      />
                      <Text size="2" weight="medium">{tenant.Name}</Text>
                    </Flex>
                    {isMember && (
                      <Flex wrap="wrap" gap="3" ml="5" mt="1">
                        {roles.map((role) => (
                          <Flex key={role.Id} align="center" gap="1">
                            <Checkbox
                              checked={tenantRoles.includes(role.Id)}
                              onCheckedChange={(checked) => setTenantRole(tenant.Id, role.Id, checked === true)}
                            />
                            <Text size="1">{role.Name}</Text>
                          </Flex>
                        ))}
                      </Flex>
                    )}
                  </Box>
                );
              })}
            </div>
          )}
        </Box>
      </div>

      <div className="flex justify-end space-x-3">
        <Button
          type="button"
          variant="soft"
          onClick={onUpdateComplete}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? 'Updating...' : 'Update Subscriber'}
        </Button>
      </div>
    </form>
  );
} 