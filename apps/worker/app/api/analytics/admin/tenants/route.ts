import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      console.log('No session or user email');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Checking admin status for:', session.user.email);
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Check if user is system admin
    const isAdmin = await isSystemAdmin(session.user.email, db);
    console.log('Is system admin:', isAdmin);
    
    if (!isAdmin) {
      console.log('User is not system admin');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // First, let's check if there are any tenants at all in SystemLogs
    const checkQuery = `
      SELECT COUNT(DISTINCT TenantId) as total_tenants
      FROM SystemLogs 
      WHERE IsDeleted = 0
        AND TenantId IS NOT NULL
        AND TenantId != ''
    `;
    
    const checkResult = await db.prepare(checkQuery).first() as any;
    console.log('Total tenants found:', checkResult?.total_tenants);

    // Let's also check what's actually in the SystemLogs table
    const sampleQuery = `
      SELECT TenantId, LogType, COUNT(*) as count
      FROM SystemLogs 
      WHERE IsDeleted = 0
      GROUP BY TenantId, LogType
      LIMIT 10
    `;
    
    const sampleResult = await db.prepare(sampleQuery).all() as any;
    console.log('Sample SystemLogs data:', sampleResult.results);

    // Check if there are any records at all
    const totalRecordsQuery = `
      SELECT COUNT(*) as total_records
      FROM SystemLogs 
      WHERE IsDeleted = 0
    `;
    
    const totalRecordsResult = await db.prepare(totalRecordsQuery).first() as any;
    console.log('Total SystemLogs records:', totalRecordsResult?.total_records);

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

    console.log('Executing tenants query...');
    const tenantsResult = await db.prepare(tenantsQuery).all() as any;
    console.log('Tenants query result:', tenantsResult);

    // If no tenants found in SystemLogs, try to get them from the Tenants table as fallback
    let finalTenants = tenantsResult.results || [];
    
    if (finalTenants.length === 0) {
      console.log('No tenants found in SystemLogs, trying Tenants table...');
      
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
        console.log('Fallback tenants result:', fallbackResult);
        
        if (fallbackResult.results && fallbackResult.results.length > 0) {
          finalTenants = fallbackResult.results;
          console.log('Using fallback tenants:', finalTenants.length);
        }
      } catch (fallbackError) {
        console.log('Fallback query failed:', fallbackError);
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
