import { NextRequest, NextResponse } from 'next/server';
import { auth, createCustomAdapter } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';

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
    const normalizedLogging = new NormalizedLogging(db);

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

    // Manual deletion approach - delete all related records and then the user
    try {
      // Delete all related records in the correct order
      
      // Auth.js v5 tables
      await db.prepare('DELETE FROM accounts WHERE userId = ?').bind(user.id).run();
      await db.prepare('DELETE FROM sessions WHERE userId = ?').bind(user.id).run();
      await db.prepare('DELETE FROM verification_tokens WHERE identifier = ?').bind(email).run();
      
      // User-related tables
      await db.prepare('DELETE FROM UserAvatars WHERE UserId = ?').bind(user.id).run();
      await db.prepare('DELETE FROM Preferences WHERE Email = ?').bind(email).run();
      
      // Messaging tables
      await db.prepare('DELETE FROM Messages WHERE SenderEmail = ?').bind(email).run();
      await db.prepare('DELETE FROM MessageRecipients WHERE RecipientEmail = ?').bind(email).run();
      await db.prepare('DELETE FROM UserBlocks WHERE BlockerEmail = ? OR BlockedEmail = ?').bind(email, email).run();
      await db.prepare('DELETE FROM MessageRateLimits WHERE SenderEmail = ?').bind(email).run();
      
      // Workflow tables
      await db.prepare('DELETE FROM Workflows WHERE InitiatorEmail = ?').bind(email).run();
      await db.prepare('DELETE FROM WorkflowParticipants WHERE ParticipantEmail = ?').bind(email).run();
      
      // User management tables - soft delete if exists
      await db.prepare('UPDATE Subscribers SET Active = FALSE, Left = CURRENT_TIMESTAMP, EmailVerified = NULL, VerificationToken = NULL, VerificationExpires = NULL WHERE Email = ?').bind(email).run();
      
      // Delete UserRoles first (has foreign key to TenantUsers)
      await db.prepare('DELETE FROM UserRoles WHERE Email = ?').bind(email).run();
      
      // Now delete from TenantUsers
      await db.prepare('DELETE FROM TenantUsers WHERE Email = ?').bind(email).run();
      
      // Content tables (after TenantUsers is deleted)
      await db.prepare('DELETE FROM PublishedContent WHERE PublisherId = ?').bind(email).run();
      
      // Finally, delete the user from the users table
      await db.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run();
      
    } catch (cleanupError) {
      console.error('Error during manual deletion:', cleanupError);
      throw new Error(`Failed to delete user: ${cleanupError}`);
    }

    // Note: SystemLogs are intentionally NOT deleted to preserve audit trail
    // SystemLogs records will remain for historical purposes

    // Log the action
    const { ipAddress, userAgent } = extractRequestContext(request);
    await normalizedLogging.logUserManagement({
      userEmail: session.user.email,
      tenantId: 'system',
      activityType: 'user_deleted',
      accessType: 'admin',
      targetId: email,
      targetName: `User ${email}`,
      ipAddress,
      userAgent,
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