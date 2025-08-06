import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/access-control';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function POST(request: NextRequest) {
  try {
    const access = await checkAccess({
      requireAuth: true,
      allowedRoles: ['subscriber']
    });

    if (!access.hasAccess || !access.email) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to clear notifications' },
        { status: 403 }
      );
    }

    const body = await request.json() as {
      workflowId: string;
      lastViewedTimestamp: string;
    };

    const { workflowId, lastViewedTimestamp } = body;

    if (!workflowId || !lastViewedTimestamp) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: workflowId and lastViewedTimestamp' },
        { status: 400 }
      );
    }

    // Get database context
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Verify the user has access to this workflow
    const workflowAccessCheck = await db.prepare(`
      SELECT 1 FROM WorkflowParticipants 
      WHERE WorkflowId = ? AND ParticipantEmail = ?
    `).bind(workflowId, access.email).first();

    if (!workflowAccessCheck) {
      return NextResponse.json(
        { success: false, error: 'You do not have access to this workflow' },
        { status: 403 }
      );
    }

    // Clear notifications for this workflow and user
    const clearQuery = `
      UPDATE UserNotifications 
      SET IsRead = 1, ReadAt = datetime('now')
      WHERE UserEmail = ? 
        AND WorkflowId = ? 
        AND CreatedAt <= ?
        AND IsRead = 0
    `;

    const result = await db.prepare(clearQuery).bind(
      access.email, 
      workflowId, 
      lastViewedTimestamp
    ).run();

    // Get the UserNotificationsDurableObject and notify it about the cleared notifications
    const userNotificationsId = env.USER_NOTIFICATIONS_DO.idFromName(access.email);
    const userNotificationsObj = env.USER_NOTIFICATIONS_DO.get(userNotificationsId);

    await userNotificationsObj.fetch('http://localhost/notifications/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'notifications_cleared',
        data: {
          userEmail: access.email,
          workflowId,
          lastViewedTimestamp
        }
      })
    });

    return NextResponse.json({
      success: true,
      message: 'Notifications cleared successfully',
      clearedCount: result.meta?.changes || 0
    });
  } catch (error) {
    console.error('Error in clear notifications API route:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 