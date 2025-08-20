import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';
import AdminUsers from '@/components/AdminUsers';
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';


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
  const normalizedLogging = new NormalizedLogging(db);

  // Check if user is system admin
  const isAdmin = await isSystemAdmin(session.user.email, db);
  
  if (!isAdmin) {
    // Log unauthorized access attempt
    await normalizedLogging.logSystemOperations({
      userEmail: session.user.email,
      tenantId: 'system',
      activityType: 'unauthorized_admin_access',
      accessType: 'admin',
      targetId: 'admin-users',
      targetName: 'Admin Users Page',
      ipAddress: undefined,
      userAgent: undefined,
      metadata: { attemptedAccess: 'admin-users' }
    });
    
    redirect('/dashboard');
  }

  // Log successful access
  await normalizedLogging.logUserManagement({
    userEmail: session.user.email,
    tenantId: 'system',
    activityType: 'access_admin_users',
    accessType: 'admin',
    targetId: 'admin-users-page',
    targetName: 'Admin Users Page',
    ipAddress: undefined,
    userAgent: undefined,
    metadata: { accessGranted: true }
  });

  // Fetch initial users
  const result = await db.prepare('SELECT * FROM Credentials ORDER BY CreatedAt DESC').all();
  const initialUsers = (result.results as unknown) as AdminUser[];

  return <AdminUsers initialUsers={initialUsers} />;
} 