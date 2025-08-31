import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { auth } from "@/auth";
import { isSystemAdmin } from "@/lib/access";


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
          // Check if user is admin or tenant admin
          const isGlobalAdmin = await isSystemAdmin(session.user.email, db);
          const isTenantAdmin = !isGlobalAdmin && await db.prepare(`
            SELECT 1 FROM Credentials WHERE Email = ? AND Role = 'tenant'
          `).bind(session.user.email).first();

          if (!isGlobalAdmin && !isTenantAdmin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
          }

          try {
            if (isGlobalAdmin) {
              // Global admin can see all subscribers
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
            } else {
              // Tenant admin can only see subscribers from their tenant(s)
              const userTenants = await db.prepare(`
                SELECT TenantId FROM TenantUsers 
                WHERE Email = ? AND RoleId = 'tenant'
              `).bind(session.user.email).all();
              
              if (!userTenants.results || userTenants.results.length === 0) {
                return NextResponse.json({ error: "No tenant access found" }, { status: 403 });
              }
              
              const tenantIds = userTenants.results.map(t => t.TenantId);
              const placeholders = tenantIds.map(() => '?').join(',');
              
              const results = await db.prepare(`
                SELECT 
                  s.Email as Id,
                  s.Email,
                  s.Name,
                  s.Provider,
                  s.EmailVerified,
                  s.Joined,
                  s.Signin,
                  s.Left,
                  s.Active,
                  s.Banned,
                  s.Post,
                  s.Moderate,
                  s.Track,
                  s.CreatedAt,
                  s.UpdatedAt
                FROM Subscribers s
                INNER JOIN TenantUsers tu ON s.Email = tu.Email
                WHERE tu.TenantId IN (${placeholders})
                ORDER BY s.CreatedAt DESC
              `).bind(...tenantIds).all<SubscriberRow>();
              return NextResponse.json({ success: true, results: results.results || [] });
            }
          } catch (error) {
            console.error('Error fetching subscribers:', error);
            return NextResponse.json({ error: "Error fetching subscribers" }, { status: 500 });
          }
        } else {
          // Check if user is admin, tenant admin, or requesting their own record
          const identifier = body.Id || body.email || body.Email;
          const isUserAdmin = await isSystemAdmin(session.user.email, db);
          const isUserTenantAdmin = !isUserAdmin && await db.prepare(`
            SELECT 1 FROM Credentials WHERE Email = ? AND Role = 'tenant'
          `).bind(session.user.email).first();
          
          if (!isUserAdmin && !isUserTenantAdmin && identifier !== session.user.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
          }
          
          // If tenant admin is accessing someone else's record, verify they belong to the same tenant
          if (isUserTenantAdmin && identifier !== session.user.email) {
            const targetUserTenant = await db.prepare(`
              SELECT tu.TenantId FROM TenantUsers tu
              WHERE tu.Email = ?
            `).bind(identifier).first();
            
            if (!targetUserTenant) {
              return NextResponse.json({ error: "User not found in any tenant" }, { status: 404 });
            }
            
            const userTenants = await db.prepare(`
              SELECT TenantId FROM TenantUsers 
              WHERE Email = ? AND RoleId = 'tenant'
            `).bind(session.user.email).all();
            
            const userTenantIds = userTenants.results?.map(t => t.TenantId) || [];
            if (!userTenantIds.includes(targetUserTenant.TenantId)) {
              return NextResponse.json({ error: "Access denied to user from different tenant" }, { status: 403 });
            }
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
              WHERE Email = ? AND Active = TRUE
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
        // Check if user already exists (including inactive ones)
        const existingSubscriber = await db.prepare(
          'SELECT * FROM Subscribers WHERE Email = ?'
        ).bind(body.Id).first();

        if (existingSubscriber) {
          // If subscriber exists and is active, they're already subscribed
          if (existingSubscriber.Active) {
            return NextResponse.json("Already a subscriber", { status: 400 });
          }
          
          // If subscriber exists but is inactive, reactivate them
          await db.prepare(`
            UPDATE Subscribers 
            SET Active = 1, Left = NULL, UpdatedAt = CURRENT_TIMESTAMP
            WHERE Email = ?
          `).bind(body.Id).run();

          // Ensure subscriber role exists
          const userTenant = await db.prepare(`
            SELECT TenantId FROM TenantUsers WHERE Email = ?
          `).bind(body.Id).first() as { TenantId: string } | undefined;

          if (userTenant) {
            await db.prepare(`
              INSERT OR IGNORE INTO UserRoles (TenantId, Email, RoleId)
              VALUES (?, ?, 'subscriber')
            `).bind(userTenant.TenantId, body.Id).run();
          } else {
            await db.prepare(`
              INSERT OR IGNORE INTO UserRoles (TenantId, Email, RoleId)
              VALUES ('default', ?, 'subscriber')
            `).bind(body.Id).run();
          }

          return NextResponse.json("Subscriber reactivated successfully");
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
          ) VALUES (?, NULL, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, true, ?)
        `).bind(
          body.Id,
          session.user.name || null,
          body.provider
        ).run();

        // Add subscriber role to UserRoles table
        // First, get the user's tenant from TenantUsers
        const userTenant = await db.prepare(`
          SELECT TenantId FROM TenantUsers WHERE Email = ?
        `).bind(body.Id).first() as { TenantId: string } | undefined;

        if (userTenant) {
          // Add subscriber role for the user's tenant
          await db.prepare(`
            INSERT OR IGNORE INTO UserRoles (TenantId, Email, RoleId)
            VALUES (?, ?, 'subscriber')
          `).bind(userTenant.TenantId, body.Id).run();
        } else {
          // If no tenant found, add to default tenant
          await db.prepare(`
            INSERT OR IGNORE INTO UserRoles (TenantId, Email, RoleId)
            VALUES ('default', ?, 'subscriber')
          `).bind(body.Id).run();
        }

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

        // Delete subscriber role from UserRoles (but keep basic user role)
        await db.prepare(
          'DELETE FROM UserRoles WHERE Email = ? AND RoleId = "subscriber"'
        ).bind(body.Id).run();

        // Don't delete from TenantUsers - keep basic tenant membership
        // The user should retain their basic 'user' role for basic access

        // Soft delete the subscriber record instead of hard deleting
        // Also reset verification fields so user can re-verify if they resubscribe
        await db.prepare(
          'UPDATE Subscribers SET Active = FALSE, Left = CURRENT_TIMESTAMP, EmailVerified = NULL, VerificationToken = NULL, VerificationExpires = NULL WHERE Email = ?'
        ).bind(body.Id).run();

        return NextResponse.json("Record deleted successfully");
      }

      case 'hardDelete': {
        if (!body.Id) {
          return NextResponse.json({ error: "Missing subscriber ID" }, { status: 400 });
        }

        const email = body.Id;
        const isGlobalAdmin = await isSystemAdmin(session.user.email, db);
        
        if (!isGlobalAdmin) {
          // Check if user is a tenant admin
          const isTenantAdmin = await db.prepare(`
            SELECT 1 FROM Credentials WHERE Email = ? AND Role = 'tenant'
          `).bind(session.user.email).first();

          if (!isTenantAdmin) {
            return NextResponse.json({ error: "Only system admins and tenant admins can perform hard deletes" }, { status: 401 });
          }

          // For tenant admins, check if the target user is in multiple tenants
          const targetUserTenants = await db.prepare(`
            SELECT TenantId FROM TenantUsers WHERE Email = ?
          `).bind(email).all();

          if (!targetUserTenants.results || targetUserTenants.results.length === 0) {
            return NextResponse.json({ error: "User not found in any tenant" }, { status: 404 });
          }

          // If user is in multiple tenants, only system admins can delete them
          if (targetUserTenants.results.length > 1) {
            return NextResponse.json({ 
              error: "Cannot delete user who is in multiple tenants. Only system admins can perform this operation." 
            }, { status: 403 });
          }

          // Check if the tenant admin has access to the tenant where the user exists
          const userTenantId = targetUserTenants.results[0].TenantId;
          const tenantAdminAccess = await db.prepare(`
            SELECT 1 FROM TenantUsers 
            WHERE Email = ? AND TenantId = ? AND RoleId = 'tenant'
          `).bind(session.user.email, userTenantId).first();

          if (!tenantAdminAccess) {
            return NextResponse.json({ 
              error: "You can only delete users from tenants you have admin access to" 
            }, { status: 403 });
          }
        }

        try {
          // Start with the most dependent tables and work backwards
          
          // Delete message attachments and links
          await db.prepare(`
            DELETE FROM MessageAttachments 
            WHERE MessageId IN (
              SELECT Id FROM Messages WHERE SenderEmail = ? OR Id IN (
                SELECT MessageId FROM MessageRecipients WHERE RecipientEmail = ?
              )
            )
          `).bind(email, email).run();

          // Delete message recipients
          await db.prepare(`
            DELETE FROM MessageRecipients 
            WHERE MessageId IN (
              SELECT Id FROM Messages WHERE SenderEmail = ? OR Id IN (
                SELECT MessageId FROM MessageRecipients WHERE RecipientEmail = ?
              )
            )
          `).bind(email, email).run();

          // Delete messages
          await db.prepare(`
            DELETE FROM Messages 
            WHERE SenderEmail = ? OR Id IN (
              SELECT MessageId FROM MessageRecipients WHERE RecipientEmail = ?
            )
          `).bind(email, email).run();

          // Delete workflow messages and history
          await db.prepare(`
            DELETE FROM WorkflowMessages 
            WHERE SenderEmail = ?
          `).bind(email).run();

          await db.prepare(`
            DELETE FROM WorkflowHistory 
            WHERE InitiatorEmail = ? OR CompletedBy = ? OR DeletedBy = ? OR EventPerformedBy = ?
          `).bind(email, email, email, email).run();

          // Delete workflow participants
          await db.prepare(`
            DELETE FROM WorkflowParticipants 
            WHERE ParticipantEmail = ?
          `).bind(email).run();

          // Delete media files uploaded by this user
          await db.prepare(`
            DELETE FROM MediaFiles 
            WHERE UploadedBy = ?
          `).bind(email).run();

          // Delete media access records
          await db.prepare(`
            DELETE FROM MediaAccess 
            WHERE GrantedBy = ?
          `).bind(email).run();

          // Delete user blocks
          await db.prepare(`
            DELETE FROM UserBlocks 
            WHERE BlockedEmail = ? OR BlockerEmail = ?
          `).bind(email, email).run();

          // Delete user roles
          await db.prepare(`
            DELETE FROM UserRoles 
            WHERE Email = ?
          `).bind(email).run();

          // Delete tenant users
          await db.prepare(`
            DELETE FROM TenantUsers 
            WHERE Email = ?
          `).bind(email).run();

          // Finally, delete the subscriber record
          await db.prepare(`
            DELETE FROM Subscribers 
            WHERE Email = ?
          `).bind(email).run();

          return NextResponse.json("Subscriber and all associated records hard deleted successfully");
        } catch (error) {
          console.error('Error during hard delete:', error);
          return NextResponse.json({ 
            error: "Failed to hard delete subscriber. Some records may have been deleted. Check logs for details." 
          }, { status: 500 });
        }
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

    // If email is provided, return specific subscriber (including inactive ones for admin purposes)
    if (email) {
      const subscriber = await db.prepare(
        'SELECT * FROM Subscribers WHERE Email = ?'
      ).bind(email).first();

      return NextResponse.json(subscriber || { error: "Not found" });
    }

    // If no email provided, check if user is admin or tenant admin
    const isGlobalAdmin = await isSystemAdmin(session.user.email, db);
    const isTenantAdmin = !isGlobalAdmin && await db.prepare(`
      SELECT 1 FROM Credentials WHERE Email = ? AND Role = 'tenant'
    `).bind(session.user.email).first();

    if (!isGlobalAdmin && !isTenantAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (isGlobalAdmin) {
      // Global admin can see all subscribers
      const subscribers = await db.prepare(
        'SELECT * FROM Subscribers ORDER BY CreatedAt DESC'
      ).all();
      return NextResponse.json(subscribers.results || []);
    } else {
      // Tenant admin can only see subscribers from their tenant(s)
      const userTenants = await db.prepare(`
        SELECT TenantId FROM TenantUsers 
        WHERE Email = ? AND RoleId = 'tenant'
      `).bind(session.user.email).all();
      
      if (!userTenants.results || userTenants.results.length === 0) {
        return NextResponse.json({ error: "No tenant access found" }, { status: 403 });
      }
      
      const tenantIds = userTenants.results.map(t => t.TenantId);
      const placeholders = tenantIds.map(() => '?').join(',');
      
      const subscribers = await db.prepare(`
        SELECT s.* FROM Subscribers s
        INNER JOIN TenantUsers tu ON s.Email = tu.Email
        WHERE tu.TenantId IN (${placeholders})
        ORDER BY s.CreatedAt DESC
      `).bind(...tenantIds).all();
      
      return NextResponse.json(subscribers.results || []);
    }
  } catch (error) {
    console.error('Subscriber fetch error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 