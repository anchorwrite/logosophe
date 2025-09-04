import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check if user is system admin
    const isAdmin = await isSystemAdmin(session.user.email, db);
    
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all unique tenants from SystemLogs
    const tenantsQuery = `
      SELECT DISTINCT 
        TenantId,
        COUNT(*) as TotalOperations,
        COUNT(DISTINCT UserEmail) as UniqueUsers,
        MIN(Timestamp) as FirstActivity,
        MAX(Timestamp) as LastActivity
      FROM SystemLogs 
      WHERE IsDeleted = 0
        AND TenantId IS NOT NULL
        AND TenantId != ''
      GROUP BY TenantId
      ORDER BY TotalOperations DESC
    `;

    const tenantsResult = await db.prepare(tenantsQuery).all() as any;

    // If no tenants found in SystemLogs, try to get them from the Tenants table as fallback
    let finalTenants = tenantsResult.results || [];
    
    if (finalTenants.length === 0) {
      try {
        const fallbackQuery = `
          SELECT 
            Id as TenantId,
            0 as TotalOperations,
            0 as UniqueUsers,
            CreatedAt as FirstActivity,
            UpdatedAt as LastActivity
          FROM Tenants 
          WHERE IsDeleted = 0
          ORDER BY CreatedAt DESC
        `;
        
        const fallbackResult = await db.prepare(fallbackQuery).all() as any;
        
        if (fallbackResult.results && fallbackResult.results.length > 0) {
          finalTenants = fallbackResult.results;
        }
      } catch (fallbackError) {
        // Fallback query failed, continue with empty results
      }
    }

    return NextResponse.json({
      success: true,
      data: finalTenants
    });

  } catch (error) {
    console.error('Error fetching tenants:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
