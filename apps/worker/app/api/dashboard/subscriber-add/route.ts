import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { auth } from "@/auth";
import { isSystemAdmin } from "@/lib/access";

interface SubscriberAddRequest {
  op: string;
  Id: string;
  Name: string;
  Provider: string;
  Active: boolean;
  Banned: boolean;
  Post: boolean;
  Moderate: boolean;
  Track: boolean;
  Joined: string;
  CreatedAt: string;
  TenantIds: string[];
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    
    if (!await isSystemAdmin(session.user.email, db)) {
      return NextResponse.json({ error: "Only system admins can add subscribers" }, { status: 403 });
    }

    const body = await request.json() as SubscriberAddRequest;
  

    if (body.op !== 'add') {
      return NextResponse.json({ error: "Invalid operation" }, { status: 400 });
    }

    if (!body.Id || !body.Name || !body.Provider) {
      return NextResponse.json({ error: "Email, Name, and Provider are required" }, { status: 400 });
    }

    // Check if subscriber already exists
    const existingSubscriber = await db.prepare(`
      SELECT Email FROM Subscribers WHERE Email = ?
    `).bind(body.Id).first();

    if (existingSubscriber) {
      // Subscriber exists, check if they need tenant assignments updated
      console.log('Subscriber already exists, updating tenant assignments');
      
      // Update subscriber record with new values
      await db.prepare(`
        UPDATE Subscribers SET
          Name = ?,
          Provider = ?,
          Active = ?,
          Banned = ?,
          Post = ?,
          Moderate = ?,
          Track = ?,
          UpdatedAt = ?
        WHERE Email = ?
      `).bind(
        body.Name,
        body.Provider,
        body.Active ? 1 : 0,
        body.Banned ? 1 : 0,
        body.Post ? 1 : 0,
        body.Moderate ? 1 : 0,
        body.Track ? 1 : 0,
        body.CreatedAt,
        body.Id
      ).run();
    } else {
      // Create new subscriber record
      await db.prepare(`
        INSERT INTO Subscribers (
          Email,
          Name,
          Provider,
          Active,
          Banned,
          Post,
          Moderate,
          Track,
          Joined,
          CreatedAt,
          UpdatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        body.Id,
        body.Name,
        body.Provider,
        body.Active ? 1 : 0,
        body.Banned ? 1 : 0,
        body.Post ? 1 : 0,
        body.Moderate ? 1 : 0,
        body.Track ? 1 : 0,
        body.Joined,
        body.CreatedAt,
        body.CreatedAt
      ).run();
    }

    // Add subscriber to specified tenants following proper RBAC onboarding flow
    let validTenantsProcessed = 0;
    
    // Clear existing tenant assignments to ensure clean slate
    await db.prepare(`
      DELETE FROM TenantUsers WHERE Email = ?
    `).bind(body.Id).run();
    
    await db.prepare(`
      DELETE FROM UserRoles WHERE Email = ?
    `).bind(body.Id).run();
    
    if (body.TenantIds && body.TenantIds.length > 0) {
      for (const tenantId of body.TenantIds) {
        // Verify tenant exists
        const tenant = await db.prepare(`
          SELECT Id FROM Tenants WHERE Id = ?
        `).bind(tenantId).first();

        if (tenant) {
          // Step 1: Add user to TenantUsers with 'user' role (base role)
          await db.prepare(`
            INSERT OR IGNORE INTO TenantUsers (TenantId, Email, RoleId, CreatedAt, UpdatedAt)
            VALUES (?, ?, 'user', datetime('now'), datetime('now'))
          `).bind(tenantId, body.Id).run();
          
          // Step 2: Add 'subscriber' role to UserRoles (additional capability)
          await db.prepare(`
            INSERT OR IGNORE INTO UserRoles (TenantId, Email, RoleId)
            VALUES (?, ?, 'subscriber')
          `).bind(tenantId, body.Id).run();
          
          validTenantsProcessed++;
        }
      }
    }
    
    // If no tenants were specified or none were valid, add to default tenant
    if (validTenantsProcessed === 0) {
      // Get the first available tenant
      const firstTenant = await db.prepare(`
        SELECT Id FROM Tenants ORDER BY Name ASC LIMIT 1
      `).first() as { Id: string } | undefined;
      
      if (firstTenant) {
        // Step 1: Add user to TenantUsers with 'user' role (base role)
        await db.prepare(`
          INSERT OR IGNORE INTO TenantUsers (TenantId, Email, RoleId, CreatedAt, UpdatedAt)
          VALUES (?, ?, 'user', datetime('now'), datetime('now'))
        `).bind(firstTenant.Id, body.Id).run();
        
        // Step 2: Add 'subscriber' role to UserRoles (additional capability)
        await db.prepare(`
          INSERT OR IGNORE INTO UserRoles (TenantId, Email, RoleId)
          VALUES (?, ?, 'subscriber')
        `).bind(firstTenant.Id, body.Id).run();
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: existingSubscriber ? "Subscriber updated successfully" : "Subscriber added successfully",
      subscriber: {
        Email: body.Id,
        Name: body.Name,
        Provider: body.Provider,
        Active: body.Active,
        Banned: body.Banned,
        Post: body.Post,
        Moderate: body.Moderate,
        Track: body.Track,
        Joined: body.Joined,
        CreatedAt: body.CreatedAt
      }
    });

  } catch (error) {
    console.error('Error adding subscriber:', error);
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
