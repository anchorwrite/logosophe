import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth'

export const runtime = "edge";

export interface Env {
    DB: D1Database;
  }

type Params = Promise<{ id: string }>

export async function GET(
    request: NextRequest, 
    { params }: { params: Params } ) {  

    try { 
      const session = await auth();
      if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
      }
    } catch (error) {
      console.error(error);
      return new NextResponse('Error authenticating session', { status: 500 });
    }

    try {
        const { env } = await getCloudflareContext({async: true});
        const db = env.DB;
        const { id } = await params
        const { results } = await db.prepare(
            "SELECT * FROM Customer WHERE Id = ?"
        )
            .bind(id)
            .all();
        return NextResponse.json(results);
    } catch (error) {
       console.error(error);
       return new NextResponse('Error fetching customer', { status: 500 });
    }
} 