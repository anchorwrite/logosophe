import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextResponse } from 'next/server';


export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  const { searchParams } = new URL(request.url);
  const operation = searchParams.get('operation') || 'select';

  try {
    switch (operation) {
      case 'select': {
        const result = await db.prepare(`
          SELECT rp.*, r.Name as RoleName, p.Name as PermissionName
          FROM RolePermissions rp
          JOIN Roles r ON rp.RoleId = r.Id
          JOIN Permissions p ON rp.PermissionId = p.Id
          ORDER BY r.Name, p.Name ASC
        `).all();
        return NextResponse.json(result);
      }
      default:
        return new NextResponse('Invalid operation', { status: 400 });
    }
  } catch (error) {
    console.error('Error in role permissions API:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  const body = await request.json() as {
    op?: string;
    RoleId?: string;
    PermissionId?: string;
    updateId?: string;
    delId?: string;
  };
  const operation = body.op || 'select';

  try {
    switch (operation) {
      case 'select': {
        const result = await db.prepare(`
          SELECT rp.*, r.Name as RoleName, p.Name as PermissionName
          FROM RolePermissions rp
          JOIN Roles r ON rp.RoleId = r.Id
          JOIN Permissions p ON rp.PermissionId = p.Id
          ORDER BY r.Name, p.Name ASC
        `).all();
        return NextResponse.json(result);
      }
      case 'insert': {
        if (!body.RoleId || !body.PermissionId) {
          return new NextResponse('Missing required fields', { status: 400 });
        }
        const result = await db.prepare(`
          INSERT INTO RolePermissions (RoleId, PermissionId)
          VALUES (?, ?)
        `).bind(body.RoleId, body.PermissionId).run();
        return NextResponse.json({ success: true, message: 'Role permission created successfully' });
      }
      case 'populate': {
        if (!body.updateId) {
          return new NextResponse('Missing update ID', { status: 400 });
        }
        
        try {
          const result = await db.prepare(`
            SELECT rp.*, r.Name as RoleName, p.Name as PermissionName
            FROM RolePermissions rp
            JOIN Roles r ON rp.RoleId = r.Id
            JOIN Permissions p ON rp.PermissionId = p.Id
            WHERE rp.RoleId = ?
          `).bind(body.updateId).all();
          
          if (result && Array.isArray(result.results) && result.results.length > 0) {
            return NextResponse.json(result);
          } else {
            return NextResponse.json({ error: 'Record not found' }, { status: 404 });
          }
        } catch (error) {
          console.error('Error fetching role permission:', error);
          return NextResponse.json({ error: 'Error fetching record' }, { status: 500 });
        }
      }
      case 'update': {
        if (!body.updateId) {
          return new NextResponse('Missing required fields', { status: 400 });
        }
        
        // If both RoleId and PermissionId are provided, use them both in the query
        if (body.RoleId && body.PermissionId) {
          const result = await db.prepare(`
            UPDATE RolePermissions 
            SET PermissionId = ?
            WHERE RoleId = ? AND PermissionId = ?
          `).bind(body.PermissionId, body.RoleId, body.PermissionId).run();
          return NextResponse.json({ success: true, message: 'Role permission updated successfully' });
        }
        
        // Otherwise, just use the updateId
        const result = await db.prepare(`
          UPDATE RolePermissions 
          SET PermissionId = ?
          WHERE RoleId = ?
        `).bind(body.PermissionId, body.updateId).run();
        return NextResponse.json({ success: true, message: 'Role permission updated successfully' });
      }
      case 'delete': {
        if (!body.delId) {
          return new NextResponse('Missing role permission ID', { status: 400 });
        }
        
        // If both RoleId and PermissionId are provided, use them both in the query
        if (body.RoleId && body.PermissionId) {
          const result = await db.prepare(`
            DELETE FROM RolePermissions 
            WHERE RoleId = ? AND PermissionId = ?
          `).bind(body.RoleId, body.PermissionId).run();
          return NextResponse.json({ success: true, message: 'Role permission deleted successfully' });
        }
        
        // Otherwise, just use the delId
        const result = await db.prepare(`
          DELETE FROM RolePermissions 
          WHERE RoleId = ?
        `).bind(body.delId).run();
        return NextResponse.json({ success: true, message: 'Role permission deleted successfully' });
      }
      default:
        return new NextResponse('Invalid operation', { status: 400 });
    }
  } catch (error) {
    console.error('Error in role permissions API:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 