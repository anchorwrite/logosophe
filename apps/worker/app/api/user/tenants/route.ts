import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAccess } from '@/lib/access-control';
import { isSystemAdmin } from '@/lib/access';

export const runtime = 'edge';

export async function GET() {
  try {
    const access = await checkAccess({
      requireAuth: true,
    });

    if (!access.hasAccess || !access.email) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    
    // System admins have access to all tenants
    if (await isSystemAdmin(access.email, db)) {
      const tenants = await db.prepare(`
        SELECT Id, Name, Description, CreatedAt, UpdatedAt FROM Tenants
      `).all();
      return NextResponse.json(tenants.results || []);
    }

    // Get tenants where user is a member
    const tenants = await db.prepare(`
      SELECT t.Id, t.Name, t.Description, t.CreatedAt, t.UpdatedAt
      FROM Tenants t
      JOIN TenantUsers tu ON t.Id = tu.TenantId
      WHERE tu.Email = ?
    `).bind(access.email).all();

    return NextResponse.json(tenants.results || []);
  } catch (error) {
    console.error('Error fetching user tenants:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
} 