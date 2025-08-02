import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

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
          SELECT * FROM Roles
          ORDER BY Name ASC
        `).all();
        return NextResponse.json(result);
      }
      default:
        return new NextResponse('Invalid operation', { status: 400 });
    }
  } catch (error) {
    console.error('Error in roles API:', error);
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
    Id?: string;
    Name?: string;
    Description?: string;
    updateId?: string;
    delId?: string;
  };
  const operation = body.op || 'select';

  try {
    switch (operation) {
      case 'select': {
        const result = await db.prepare(`
          SELECT * FROM Roles
          ORDER BY Name ASC
        `).all();
        return NextResponse.json(result);
      }
      case 'insert': {
        if (!body.Id || !body.Name) {
          return new NextResponse('Missing required fields', { status: 400 });
        }
        const result = await db.prepare(`
          INSERT INTO Roles (Id, Name, Description)
          VALUES (?, ?, ?)
        `).bind(body.Id, body.Name, body.Description || null).run();
        return NextResponse.json({ success: true, message: 'Role created successfully' });
      }
      case 'populate': {
        if (!body.updateId) {
          return new NextResponse('Missing update ID', { status: 400 });
        }
        const result = await db.prepare(`
          SELECT * FROM Roles WHERE Id = ?
        `).bind(body.updateId).all();
        return NextResponse.json(result);
      }
      case 'update': {
        if (!body.updateId || !body.Name) {
          return new NextResponse('Missing required fields', { status: 400 });
        }
        const result = await db.prepare(`
          UPDATE Roles 
          SET Name = ?, Description = ?
          WHERE Id = ?
        `).bind(body.Name, body.Description || null, body.updateId).run();
        return NextResponse.json({ success: true, message: 'Role updated successfully' });
      }
      case 'delete': {
        if (!body.delId) {
          return new NextResponse('Missing role ID', { status: 400 });
        }
        // First check if role is in use
        const roleInUse = await db.prepare(`
          SELECT COUNT(*) as count FROM UserRoles WHERE RoleId = ?
        `).bind(body.delId).first() as { count: number } | null;
        
        if (roleInUse?.count && roleInUse.count > 0) {
          return new NextResponse('Cannot delete role that is assigned to users', { status: 400 });
        }

        // Delete role permissions first
        await db.prepare(`
          DELETE FROM RolePermissions WHERE RoleId = ?
        `).bind(body.delId).run();

        // Then delete the role
        const result = await db.prepare(`
          DELETE FROM Roles WHERE Id = ?
        `).bind(body.delId).run();
        
        return NextResponse.json({ success: true, message: 'Role deleted successfully' });
      }
      default:
        return new NextResponse('Invalid operation', { status: 400 });
    }
  } catch (error) {
    console.error('Error in roles API:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 