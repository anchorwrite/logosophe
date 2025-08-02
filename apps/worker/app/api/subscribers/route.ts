import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { auth } from "@/auth";
import { isSystemAdmin } from "@/lib/access";

export const runtime = 'edge';

interface SubscriberRow {
  Id: string;
  Email: string;
  Name?: string;
  Provider?: string;
  EmailVerified?: boolean;
  Joined?: string;
  Signin?: string;
  Left?: string;
  Active?: boolean;
  Banned?: boolean;
  Post?: boolean;
  Moderate?: boolean;
  Track?: boolean;
  CreatedAt?: string;
  UpdatedAt?: string;
}

interface Subscriber {
  op?: string;
  Id?: string;
  email?: string;
  Email?: string;
  field?: string;
  value?: any;
  updateId?: string;
  provider?: string;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json() as Subscriber;
    console.log('Received request body:', body);
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    switch(body.op) {
      case 'select': {
        if (body.Id === '*') {
          // Only admins can view all subscribers
          if (!await isSystemAdmin(session.user.email, db)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
          }
          try {
            const results = await db.prepare(`
              SELECT 
                Email as Id,
                Email,
                Name,
                Provider,
                EmailVerified,
                Joined,
                Signin,
                Left,
                Active,
                Banned,
                Post,
                Moderate,
                Track,
                CreatedAt,
                UpdatedAt
              FROM Subscribers 
              ORDER BY CreatedAt DESC
            `).all<SubscriberRow>();
            return NextResponse.json({ success: true, results: results.results || [] });
          } catch (error) {
            console.error('Error fetching subscribers:', error);
            return NextResponse.json({ error: "Error fetching subscribers" }, { status: 500 });
          }
        } else {
          // Check if user is admin or requesting their own record
          const identifier = body.Id || body.email || body.Email;
          const isUserAdmin = await isSystemAdmin(session.user.email, db);
          if (!isUserAdmin && identifier !== session.user.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
          }
          try {
            const subscriber = await db.prepare(`
              SELECT 
                Email as Id,
                Email,
                Name,
                Provider,
                EmailVerified,
                Joined,
                Signin,
                Left,
                Active,
                Banned,
                Post,
                Moderate,
                Track,
                CreatedAt,
                UpdatedAt
              FROM Subscribers 
              WHERE Email = ?
            `).bind(identifier).first<SubscriberRow>();
            return NextResponse.json({ success: true, results: subscriber ? [subscriber] : [] });
          } catch (error) {
            console.error('Error fetching subscriber:', error);
            return NextResponse.json({ error: "Error fetching subscriber" }, { status: 500 });
          }
        }
      }

      case 'populate': {
        if (!body.updateId) {
          return NextResponse.json({ error: "Missing updateId" }, { status: 400 });
        }
        
        try {
          const subscriber = await db.prepare(`
            SELECT 
              Email as Id,
              Email,
              Name,
              EmailVerified,
              Joined,
              Signin,
              Left,
              Active,
              Banned,
              Post,
              Moderate,
              Track,
              CreatedAt,
              UpdatedAt
            FROM Subscribers 
            WHERE Email = ?
          `).bind(body.updateId).first();
          
          if (subscriber) {
            return NextResponse.json({ results: [subscriber] });
          } else {
            return NextResponse.json({ error: 'Record not found' }, { status: 404 });
          }
        } catch (error) {
          console.error('Error fetching subscriber:', error);
          return NextResponse.json({ error: 'Error fetching record' }, { status: 500 });
        }
      }

      case 'insert': {
        // Check if user already exists
        const existingSubscriber = await db.prepare(
          'SELECT * FROM Subscribers WHERE Email = ?'
        ).bind(body.Id).first();

        if (existingSubscriber) {
          return NextResponse.json("Already a subscriber", { status: 400 });
        }

        // Validate provider
        const allowedProviders = ['Resend', 'Google', 'Apple'];
        if (!body.provider || !allowedProviders.includes(body.provider)) {
          return NextResponse.json(
            { error: "Provider must be one of: Resend, Google, Apple" }, 
            { status: 400 }
          );
        }

        // Check if user is admin or adding their own email
        const isUserAdmin = await isSystemAdmin(session.user.email, db);
        if (!isUserAdmin && body.Id !== session.user.email) {
          return NextResponse.json({ error: "Only system admins can add other users' emails" }, { status: 401 });
        }

        // Create new subscriber record
        await db.prepare(`
          INSERT INTO Subscribers (
            Email,
            EmailVerified,
            Name,
            Joined,
            Signin,
            Active,
            Provider
          ) VALUES (?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, true, ?)
        `).bind(
          body.Id,
          session.user.name || null,
          body.provider
        ).run();

        return NextResponse.json("Subscriber created successfully");
      }

      case 'update': {
        // Only admins can update subscriber records
        if (!await isSystemAdmin(session.user.email, db)) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!body.updateId) {
          return NextResponse.json({ error: "Missing updateId" }, { status: 400 });
        }

        // Build the update query dynamically based on the form data
        const updates: string[] = [];
        const values: any[] = [];

        Object.entries(body).forEach(([key, val]) => {
          if (key !== 'op' && key !== 'updateId' && val !== undefined) {
            updates.push(`${key} = ?`);
            values.push(val);
          }
        });

        if (updates.length === 0) {
          return NextResponse.json({ error: "No fields to update" }, { status: 400 });
        }

        values.push(body.updateId);
        await db.prepare(`
          UPDATE Subscribers 
          SET ${updates.join(', ')} 
          WHERE Email = ?
        `).bind(...values).run();

        return NextResponse.json("Record updated successfully");
      }

      case 'delete': {
        if (!body.Id) {
          return NextResponse.json({ error: "Missing subscriber ID" }, { status: 400 });
        }

        // Check if user is admin or deleting their own email
        const isUserAdmin = await isSystemAdmin(session.user.email, db);
        if (!isUserAdmin && body.Id !== session.user.email) {
          return NextResponse.json({ error: "Only system admins can delete other users' emails" }, { status: 401 });
        }

        // First, delete associated records in TenantUsers
        await db.prepare(
          'DELETE FROM TenantUsers WHERE Email = ?'
        ).bind(body.Id).run();

        // Then delete the subscriber record
        await db.prepare(
          'DELETE FROM Subscribers WHERE Email = ?'
        ).bind(body.Id).run();

        return NextResponse.json("Record deleted successfully");
      }

      default:
        console.log('Invalid operation:', body.op);
        return NextResponse.json({ error: "Invalid operation" }, { status: 400 });
    }
  } catch (error) {
    console.error('Subscriber operation error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const url = new URL(request.url);
    const email = url.searchParams.get('email');

    // If email is provided, return specific subscriber
    if (email) {
      const subscriber = await db.prepare(
        'SELECT * FROM Subscribers WHERE Email = ?'
      ).bind(email).first();

      return NextResponse.json(subscriber || { error: "Not found" });
    }

    // If no email provided, check if user is admin
    if (!await isSystemAdmin(session.user.email, db)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Return all subscribers for admin
    const subscribers = await db.prepare(
      'SELECT * FROM Subscribers ORDER BY CreatedAt DESC'
    ).all();

    return NextResponse.json(subscribers.results || []);
  } catch (error) {
    console.error('Subscriber fetch error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 