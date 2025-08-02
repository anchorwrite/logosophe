import { ReactNode, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { hasPermission, hasResourceAccess } from '@/lib/access';
import type { ResourceType, Action } from '@/lib/access';
import { auth } from '@/auth';

interface AccessControlProps {
  resource: ResourceType;
  action: Action;
  resourceType?: string;
  resourceId?: string;
  fallback?: ReactNode;
  children: ReactNode;
}

export async function AccessControl({
  resource,
  action,
  resourceType,
  resourceId,
  fallback = null,
  children
}: AccessControlProps) {
  const searchParams = useSearchParams();
  const tenantId = searchParams.get('tenantId') || 'default';

  // Get the current user's email from the session
  const session = await auth();
  if (!session?.user?.email) {
    return fallback;
  }

  let hasAccess = false;

  if (resourceType && resourceId) {
    // Check resource-specific access
    hasAccess = await hasResourceAccess(
      session.user.email,
      tenantId,
      resourceType,
      resourceId
    );
  } else {
    // Check general permission
    hasAccess = await hasPermission(
      session.user.email,
      tenantId,
      resource,
      action
    );
  }

  return hasAccess ? children : fallback;
}

// Client-side version for dynamic content
export function ClientAccessControl({
  resource,
  action,
  resourceType,
  resourceId,
  fallback = null,
  children
}: AccessControlProps) {
  const searchParams = useSearchParams();
  const tenantId = searchParams.get('tenantId') || 'default';
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkAccess() {
      try {
        const response = await fetch('/api/auth/check-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resource,
            action,
            resourceType,
            resourceId,
            tenantId
          })
        });
        const data = await response.json() as { hasAccess: boolean };
        setHasAccess(data.hasAccess);
      } catch (error) {
        console.error('Error checking access:', error);
        setHasAccess(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkAccess();
  }, [resource, action, resourceType, resourceId, tenantId]);

  if (isLoading) {
    return null; // or a loading spinner
  }

  return hasAccess ? children : fallback;
} 