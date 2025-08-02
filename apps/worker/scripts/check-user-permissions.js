// Script to check user permissions
// Run with: node scripts/check-user-permissions.js

const { getCloudflareContext } = require('@opennextjs/cloudflare');

async function checkUserPermissions() {
  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  
  const userEmail = 'test-user-301@logosophe.test';
  const tenantId = 'default';
  
  console.log('Checking permissions for:', userEmail, 'in tenant:', tenantId);
  
  // Check user's roles
  const userRoles = await db.prepare(`
    SELECT RoleId FROM TenantUsers 
    WHERE Email = ? AND TenantId = ?
  `).bind(userEmail, tenantId).all();
  
  console.log('User roles:', userRoles.results);
  
  // Check role permissions
  for (const role of userRoles.results) {
    const rolePermissions = await db.prepare(`
      SELECT p.Name, p.Description, p.Resource, p.Action 
      FROM RolePermissions rp
      JOIN Permissions p ON rp.PermissionId = p.Id
      WHERE rp.RoleId = ?
    `).bind(role.RoleId).all();
    
    console.log(`Permissions for role ${role.RoleId}:`, rolePermissions.results);
  }
  
  // Check workflow permissions specifically
  const workflowPermissions = await db.prepare(`
    SELECT p.Name, p.Description, p.Resource, p.Action 
    FROM TenantUsers tu
    JOIN RolePermissions rp ON tu.RoleId = rp.RoleId
    JOIN Permissions p ON rp.PermissionId = p.Id
    WHERE tu.Email = ? AND tu.TenantId = ? AND p.Resource = 'workflow'
  `).bind(userEmail, tenantId).all();
  
  console.log('Workflow permissions:', workflowPermissions.results);
  
  // Check if workflow exists
  const workflow = await db.prepare(`
    SELECT Id, TenantId, Status FROM Workflows 
    WHERE Id = ? AND TenantId = ?
  `).bind('91b2078b-6f20-49c6-bf5f-a68dfe52c3a6', tenantId).first();
  
  console.log('Workflow exists:', !!workflow);
  if (workflow) {
    console.log('Workflow details:', workflow);
  }
}

checkUserPermissions().catch(console.error); 