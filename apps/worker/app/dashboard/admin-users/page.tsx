import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import AdminUsers from '@/components/AdminUsers';
import { SystemLogs } from '@/lib/system-logs';


interface AdminUser {
  Email: string;
  Role: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export default async function AdminUsersPage() {
  const session = await auth();
  
  if (!session?.user?.email) {
    redirect('/signin');
  }

  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  const systemLogs = new SystemLogs(db);

  // Check if user is system admin
  const isAdmin = await isSystemAdmin(session.user.email, db);
  
  if (!isAdmin) {
    // Log unauthorized access attempt
    await systemLogs.createLog({
      logType: 'ACTIVITY',
      timestamp: new Date().toISOString(),
      userEmail: session.user.email,
      activityType: 'UNAUTHORIZED_ADMIN_ACCESS',
      metadata: { attemptedAccess: 'admin-users' }
    });
    
    redirect('/dashboard');
  }

  // Log successful access
  await systemLogs.createLog({
    logType: 'ACTIVITY',
    timestamp: new Date().toISOString(),
    userEmail: session.user.email,
    activityType: 'ACCESS_ADMIN_USERS'
  });

  // Fetch initial users
  const result = await db.prepare('SELECT * FROM Credentials ORDER BY CreatedAt DESC').all();
  const initialUsers = (result.results as unknown) as AdminUser[];

  return <AdminUsers initialUsers={initialUsers} />;
} 