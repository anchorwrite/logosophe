import { NextRequest, NextResponse } from 'next/server';
import { auth, createCustomAdapter } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { SystemLogs } from '@/lib/system-logs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const { email } = await params;
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;
    const systemLogs = new SystemLogs(db);

    // Check if user is system admin or tenant admin
    const isAdmin = await isSystemAdmin(session.user.email, db);
    const isTenantAdmin = !isAdmin && await db.prepare(
      'SELECT Role FROM Credentials WHERE Email = ?'
    ).bind(session.user.email).first() as { Role: string } | null;

    if (!isAdmin && !isTenantAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if user exists in users table (Auth.js v5)
    const customAdapter = await createCustomAdapter();
    const user = await customAdapter?.getUserByEmail?.(email);
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if this is a Credentials provider user (should be handled by AdminUsers)
    const credentialsUser = await db.prepare(
      'SELECT Email FROM Credentials WHERE Email = ?'
    ).bind(email).first() as { Email: string } | null;

    if (credentialsUser) {
      return NextResponse.json({ error: 'Cannot delete Credentials provider users from this endpoint. Use the admin users page instead.' }, { status: 400 });
    }

    // Force delete approach - disable foreign key constraints temporarily
    await db.prepare('PRAGMA foreign_keys = OFF').run();
    
    try {
      // Delete all related records in any order since constraints are disabled
      
      // Auth.js v5 tables
      await db.prepare('DELETE FROM accounts WHERE userId = ?').bind(user.id).run();
      await db.prepare('DELETE FROM sessions WHERE userId = ?').bind(user.id).run();
      await db.prepare('DELETE FROM verification_tokens WHERE identifier = ?').bind(email).run();
      
      // User-related tables
      await db.prepare('DELETE FROM UserAvatars WHERE UserId = ?').bind(user.id).run();
      await db.prepare('DELETE FROM UserRoles WHERE Email = ?').bind(email).run();
      
      // Messaging tables
      await db.prepare('DELETE FROM Messages WHERE SenderEmail = ?').bind(email).run();
      await db.prepare('DELETE FROM MessageRecipients WHERE RecipientEmail = ?').bind(email).run();
      await db.prepare('DELETE FROM UserBlocks WHERE BlockerEmail = ? OR BlockedEmail = ?').bind(email, email).run();
      await db.prepare('DELETE FROM MessageRateLimits WHERE SenderEmail = ?').bind(email).run();
      
      // Workflow tables
      await db.prepare('DELETE FROM Workflows WHERE InitiatorEmail = ?').bind(email).run();
      await db.prepare('DELETE FROM WorkflowParticipants WHERE ParticipantEmail = ?').bind(email).run();
      
      // User management tables
              await db.prepare('UPDATE Subscribers SET Active = FALSE, Left = CURRENT_TIMESTAMP WHERE Email = ?').bind(email).run();
      await db.prepare('DELETE FROM TenantUsers WHERE Email = ?').bind(email).run();
      
      // Content tables (after TenantUsers is deleted)
      await db.prepare('DELETE FROM PublishedContent WHERE PublisherId = ?').bind(email).run();
      
    } finally {
      // Re-enable foreign key constraints
      await db.prepare('PRAGMA foreign_keys = ON').run();
    }

    // Note: SystemLogs are intentionally NOT deleted to preserve audit trail
    // SystemLogs records will remain for historical purposes

    // Now delete from Users table using the adapter
    await customAdapter?.deleteUser?.(user.id);

    // Log the action
    await systemLogs.logActivity({
      userId: session.user.id || session.user.email,
      email: session.user.email,
      provider: 'credentials',
      activityType: 'user_deleted',
      targetId: email,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      metadata: {
        deletedUserId: user.id,
        userProvider: user.email ? 'oauth' : 'unknown'
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: `Deleted user ${email}`,
      deletedUserId: user.id
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 