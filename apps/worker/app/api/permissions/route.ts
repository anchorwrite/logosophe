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
          SELECT * FROM Permissions 
          ORDER BY Resource, Action ASC
        `).all();
        return NextResponse.json(result);
      }
      default:
        return new NextResponse('Invalid operation', { status: 400 });
    }
  } catch (error) {
    console.error('Error in permissions API:', error);
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
    Resource?: string;
    Action?: string;
    updateId?: string;
    delId?: string;
  };
  const operation = body.op || 'select';

  try {
    switch (operation) {
      case 'select': {
        const result = await db.prepare(`
          SELECT * FROM Permissions 
          ORDER BY Resource, Action ASC
        `).all();
        return NextResponse.json(result);
      }
      case 'insert': {
        if (!body.Id || !body.Name || !body.Resource || !body.Action) {
          return new NextResponse('Missing required fields', { status: 400 });
        }
        const result = await db.prepare(`
          INSERT INTO Permissions (Id, Name, Description, Resource, Action)
          VALUES (?, ?, ?, ?, ?)
        `).bind(body.Id, body.Name, body.Description || null, body.Resource, body.Action).run();
        return NextResponse.json({ success: true, message: 'Permission created successfully' });
      }
      case 'populate': {
        if (!body.updateId) {
          return new NextResponse('Missing update ID', { status: 400 });
        }
        const result = await db.prepare(`
          SELECT * FROM Permissions WHERE Id = ?
        `).bind(body.updateId).all();
        return NextResponse.json(result);
      }
      case 'update': {
        if (!body.updateId || !body.Name || !body.Resource || !body.Action) {
          return new NextResponse('Missing required fields', { status: 400 });
        }
        const result = await db.prepare(`
          UPDATE Permissions 
          SET Name = ?, Description = ?, Resource = ?, Action = ?
          WHERE Id = ?
        `).bind(body.Name, body.Description || null, body.Resource, body.Action, body.updateId).run();
        return NextResponse.json({ success: true, message: 'Permission updated successfully' });
      }
      case 'delete': {
        if (!body.delId) {
          return new NextResponse('Missing permission ID', { status: 400 });
        }
        const result = await db.prepare(`
          DELETE FROM Permissions 
          WHERE Id = ?
        `).bind(body.delId).run();
        return NextResponse.json({ success: true, message: 'Permission deleted successfully' });
      }
      default:
        return new NextResponse('Invalid operation', { status: 400 });
    }
  } catch (error) {
    console.error('Error in permissions API:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 