import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasPermission, hasResourceAccess } from "@/lib/access";
import type { ResourceType, Action } from "@/lib/access";


interface RequestBody {
  resource: ResourceType;
  action: Action;
  resourceType?: string;
  resourceId?: string;
  tenantId: string;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ hasAccess: false }, { status: 401 });
    }

    const body = await request.json() as RequestBody;
    const { resource, action, resourceType, resourceId, tenantId } = body;

    let hasAccess = false;

    if (resourceType && resourceId) {
      hasAccess = await hasResourceAccess(
        session.user.email,
        tenantId,
        resourceType,
        resourceId
      );
    } else {
      hasAccess = await hasPermission(
        session.user.email,
        tenantId,
        resource,
        action
      );
    }

    return NextResponse.json({ hasAccess });
  } catch (error) {
    console.error('Access check error:', error);
    return NextResponse.json({ hasAccess: false }, { status: 500 });
  }
} 