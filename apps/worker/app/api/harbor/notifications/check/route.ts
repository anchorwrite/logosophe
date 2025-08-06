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
        { success: false, error: 'You do not have permission to check notifications' },
        { status: 403 }
      );
    }

    // Get database context
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Get unread notifications for the user
    const notificationsQuery = `
      SELECT 
        un.Id,
        un.WorkflowId,
        un.NotificationType,
        un.Message,
        un.CreatedAt,
        un.IsRead,
        w.Title as WorkflowTitle,
        w.Status as WorkflowStatus
      FROM UserNotifications un
      JOIN Workflows w ON un.WorkflowId = w.Id
      WHERE un.UserEmail = ? 
        AND un.IsRead = 0
      ORDER BY un.CreatedAt DESC
      LIMIT 50
    `;

    const notifications = await db.prepare(notificationsQuery).bind(access.email).all();

    // Get notification counts by type
    const countsQuery = `
      SELECT 
        NotificationType,
        COUNT(*) as count
      FROM UserNotifications 
      WHERE UserEmail = ? AND IsRead = 0
      GROUP BY NotificationType
    `;

    const counts = await db.prepare(countsQuery).bind(access.email).all();

    // Get the UserNotificationsDurableObject to check for real-time notifications
    const userNotificationsId = env.USER_NOTIFICATIONS_DO.idFromName(access.email);
    const userNotificationsObj = env.USER_NOTIFICATIONS_DO.get(userNotificationsId);

    const doResponse = await userNotificationsObj.fetch('http://localhost/notifications/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'check_notifications',
        data: { userEmail: access.email }
      })
    });

    let realTimeNotifications: any[] = [];
    if (doResponse.ok) {
      const doData = await doResponse.json() as { notifications?: any[] };
      realTimeNotifications = doData.notifications || [];
    }

    return NextResponse.json({
      success: true,
      notifications: notifications.results || [],
      counts: counts.results || [],
      realTimeNotifications,
      totalUnread: notifications.results?.length || 0
    });
  } catch (error) {
    console.error('Error in check notifications API route:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}