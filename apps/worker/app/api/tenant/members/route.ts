import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';
import { checkAccess } from '@/lib/access-control';
import { isSystemAdmin } from '@/lib/access';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const url = new URL(request.url);
    const tenantId = url.searchParams.get('tenantId');

    // Check if user is admin
    const isAdminUser = await isSystemAdmin(session.user.email, db);
    
    let members;
    if (isAdminUser) {
      // If admin, get all tenant members or filter by tenant if specified
      if (tenantId) {
        members = await db.prepare(`
          SELECT 
            s.Email as email,
            s.Name as name,
            u.image as image,
            r.Name as role,
            t.Id as tenantId,
            t.Name as tenantName
          FROM UserRoles ur
          JOIN Subscribers s ON ur.Email = s.Email
          LEFT JOIN users u ON ur.Email = u.email
          JOIN Roles r ON ur.RoleId = r.Id
          JOIN Tenants t ON ur.TenantId = t.Id
          WHERE ur.TenantId = ?
          ORDER BY r.Name, s.Name
        `).bind(tenantId).all();
      } else {
        members = await db.prepare(`
          SELECT 
            s.Email as email,
            s.Name as name,
            u.image as image,
            r.Name as role,
            t.Id as tenantId,
            t.Name as tenantName
          FROM UserRoles ur
          JOIN Subscribers s ON ur.Email = s.Email
          LEFT JOIN users u ON ur.Email = u.email
          JOIN Roles r ON ur.RoleId = r.Id
          JOIN Tenants t ON ur.TenantId = t.Id
          ORDER BY t.Name, r.Name, s.Name
        `).all();
      }
    } else {
      // If regular user, only get members from their tenants
      if (tenantId) {
        // Check if user has access to the specified tenant
        const userAccessToTenant = await db.prepare(`
          SELECT 1 FROM UserRoles WHERE Email = ? AND TenantId = ?
        `).bind(session.user.email, tenantId).first();
        
        if (!userAccessToTenant) {
          return new Response('Forbidden', { status: 403 });
        }
        
        // Get members from the specified tenant
        members = await db.prepare(`
          SELECT 
            s.Email as email,
            s.Name as name,
            u.image as image,
            r.Name as role,
            t.Id as tenantId,
            t.Name as tenantName
          FROM UserRoles ur
          JOIN Subscribers s ON ur.Email = s.Email
          LEFT JOIN users u ON ur.Email = u.email
          JOIN Roles r ON ur.RoleId = r.Id
          JOIN Tenants t ON ur.TenantId = t.Id
          WHERE ur.TenantId = ?
          ORDER BY r.Name, s.Name
        `).bind(tenantId).all();
      } else {
        // Get members from all user's tenants
        members = await db.prepare(`
          SELECT 
            s.Email as email,
            s.Name as name,
            u.image as image,
            r.Name as role,
            t.Id as tenantId,
            t.Name as tenantName
          FROM UserRoles ur
          JOIN Subscribers s ON ur.Email = s.Email
          LEFT JOIN users u ON ur.Email = u.email
          JOIN Roles r ON ur.RoleId = r.Id
          JOIN Tenants t ON ur.TenantId = t.Id
          WHERE ur.Email IN (
            SELECT Email 
            FROM UserRoles 
            WHERE TenantId IN (
              SELECT TenantId 
              FROM UserRoles 
              WHERE Email = ?
            )
          )
          ORDER BY t.Name, r.Name, s.Name
        `).bind(session.user.email).all();
      }
    }

    return Response.json({ 
      success: true,
      members: members.results 
    });

  } catch (error) {
    console.error('Error fetching tenant members:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 