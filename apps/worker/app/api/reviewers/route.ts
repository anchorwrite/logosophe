import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { auth } from "@/auth";
import { isSystemAdmin, isTenantAdminFor, hasPermission, Action } from "@/lib/access";
import { checkAccess } from '@/lib/access-control';

export const runtime = 'edge';

interface Reviewer {
  Id: string;
  Email: string;
  Name: string;
  tenantId: string;
  AssignedAt: Date;
}

interface RequestBody {
  op?: 'select' | 'insert' | 'update' | 'delete' | 'list';
  Email?: string;
  Name?: string;
  tenantId?: string;
  Id?: string;
  TenantId: string;
  Moderate: boolean;
  Post: boolean;
}

// GET handler for reading reviewers
export const GET = async (request: Request) => {
  try {
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check authentication
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant', 'editor', 'author']
    });

    if (!access.hasAccess) {
      return new Response('Unauthorized', { status: 401 });
    }

    const url = new URL(request.url);
    const tenantId = url.searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    // Check if user has access to this tenant
    const isAdmin = await isSystemAdmin(access.email!, db);
    const isTenantAdmin = await isTenantAdminFor(access.email!, tenantId);
    const hasReviewPermission = await hasPermission(access.email!, tenantId, 'blog', 'review' as Action);

    if (!isAdmin && !isTenantAdmin && !hasReviewPermission) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get reviewers for the tenant
    const reviewers = await db.prepare(`
      SELECT 
        u.Email,
        u.Name,
        u.Provider,
        u.Joined,
        u.LastSignin,
        u.Active,
        u.Banned,
        u.Post,
        u.Moderate,
        u.Track
      FROM Subscribers u
      JOIN TenantUsers tu ON u.Email = tu.Email
      WHERE tu.TenantId = ?
      AND (u.Moderate = 1 OR u.Post = 1)
      ORDER BY u.Name
    `).bind(tenantId).all();

    return NextResponse.json(reviewers.results);
  } catch (error) {
    console.error('Error fetching reviewers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
};

// POST handler for creating/updating/deleting reviewers
export const POST = async (request: Request) => {
  try {
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check authentication
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['admin', 'tenant', 'editor', 'author']
    });

    if (!access.hasAccess) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json() as RequestBody;
    const { Email, TenantId, Moderate, Post } = body;

    if (!Email || !TenantId) {
      return NextResponse.json({ error: 'Email and TenantId are required' }, { status: 400 });
    }

    // Check if user has permission to modify reviewers in this tenant
    const isAdmin = await isSystemAdmin(access.email!, db);
    const isTenantAdmin = await isTenantAdminFor(access.email!, TenantId);
    const hasReviewPermission = await hasPermission(access.email!, TenantId, 'blog', 'review' as Action);

    if (!isAdmin && !isTenantAdmin && !hasReviewPermission) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Update subscriber permissions
    await db.prepare(`
      UPDATE Subscribers
      SET Moderate = ?, Post = ?
      WHERE Email = ?
    `).bind(Moderate ? 1 : 0, Post ? 1 : 0, Email).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating reviewer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
};