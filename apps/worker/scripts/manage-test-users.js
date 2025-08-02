#!/usr/bin/env node

/**
 * Test User Management Script
 * 
 * This script creates or deletes 50 test users and 6 test tenants.
 * 
 * Usage:
 *   yarn wrangler d1 execute DB --local --file=scripts/manage-test-users.js -- --create
 *   yarn wrangler d1 execute DB --local --file=scripts/manage-test-users.js -- --delete
 *   yarn wrangler d1 execute DB --file=scripts/manage-test-users.js -- --create
 *   yarn wrangler d1 execute DB --file=scripts/manage-test-users.js -- --delete
 */

// Get the action from command line arguments
const args = process.argv.slice(2);
const action = args.find(arg => arg === '--create' || arg === '--delete');

if (!action) {
  console.error('Usage: node manage-test-users.js --create|--delete');
  process.exit(1);
}

const isCreate = action === '--create';

console.log(`Starting ${isCreate ? 'creation' : 'deletion'} of test users and tenants...`);

if (isCreate) {
  // Create test tenants
  console.log('Creating test tenants...');
  
  for (let i = 1; i <= 6; i++) {
    const tenantId = `test-tenant-${i}`;
    const tenantName = `Test Tenant ${i}`;
    const tenantDescription = `Test Tenant ${i}`;
    
    console.log(`Creating tenant: ${tenantId}`);
    
    // Insert tenant
    await db.prepare(`
      INSERT OR IGNORE INTO Tenants (Id, Name, Description, CreatedAt, UpdatedAt)
      VALUES (?, ?, ?, datetime('now'), datetime('now'))
    `).bind(tenantId, tenantName, tenantDescription).run();
  }

  // Create signed users (201-205) - users who have signed in but haven't opted in
  console.log('Creating signed users (201-205)...');
  
  for (let i = 201; i <= 205; i++) {
    const email = `test-user-${i}@logosophe.test`;
    const name = `Test User ${i}`;
    
    console.log(`Creating signed user: ${email}`);
    
    // Add to TenantUsers with 'user' role
    await db.prepare(`
      INSERT OR IGNORE INTO TenantUsers (TenantId, Email, RoleId, CreatedAt, UpdatedAt)
      VALUES (?, ?, ?, datetime('now'), datetime('now'))
    `).bind('default', email, 'user').run();
  }

  // Create opted-in users (301-305) - users who have signed in and opted in
  console.log('Creating opted-in users (301-305)...');
  
  for (let i = 301; i <= 305; i++) {
    const email = `test-user-${i}@logosophe.test`;
    const name = `Test User ${i}`;
    
    console.log(`Creating opted-in user: ${email}`);
    
    // Add to TenantUsers with 'user' role
    await db.prepare(`
      INSERT OR IGNORE INTO TenantUsers (TenantId, Email, RoleId, CreatedAt, UpdatedAt)
      VALUES (?, ?, ?, datetime('now'), datetime('now'))
    `).bind('default', email, 'user').run();
    
    // Add to Subscribers
    await db.prepare(`
      INSERT OR IGNORE INTO Subscribers (Email, Name, Active, Provider, CreatedAt, UpdatedAt)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(email, name, true, 'Test', new Date().toISOString(), new Date().toISOString()).run();
    
    // Add subscriber role
    await db.prepare(`
      INSERT OR IGNORE INTO UserRoles (TenantId, Email, RoleId)
      VALUES (?, ?, ?)
    `).bind('default', email, 'subscriber').run();
  }

  // Create tenant users (410-479) - 60 users distributed across 6 tenants
  console.log('Creating tenant users (410-479)...');
  
  // Define role combinations for variety
  const roleCombinations = [
    ['author'],
    ['agent'],
    ['reviewer'],
    ['editor'],
    ['author', 'reviewer'],
    ['agent', 'reviewer'],
    ['author', 'editor'],
    ['agent', 'editor'],
    ['reviewer', 'editor'],
    ['author', 'agent'],
  ];

  for (let tenantNum = 1; tenantNum <= 6; tenantNum++) {
    const tenantId = `test-tenant-${tenantNum}`;
    console.log(`Creating users for ${tenantId}...`);

    for (let i = 0; i < 10; i++) {
      const userNumber = 410 + (tenantNum - 1) * 10 + i;
      const email = `test-user-${userNumber}@logosophe.test`;
      const name = `Test User ${userNumber}`;
      const roles = ['user', 'subscriber', ...roleCombinations[i]];
      
      console.log(`Creating tenant user: ${email} with roles: ${roles.join(', ')}`);
      
      // Add to TenantUsers with 'user' role
      await db.prepare(`
        INSERT OR IGNORE INTO TenantUsers (TenantId, Email, RoleId, CreatedAt, UpdatedAt)
        VALUES (?, ?, ?, datetime('now'), datetime('now'))
      `).bind(tenantId, email, 'user').run();
      
      // Add to Subscribers
      await db.prepare(`
        INSERT OR IGNORE INTO Subscribers (Email, Name, Active, Provider, CreatedAt, UpdatedAt)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(email, name, true, 'Test', new Date().toISOString(), new Date().toISOString()).run();
      
      // Add all roles except 'user' (which is already in TenantUsers)
      for (const role of roles) {
        if (role === 'user') continue;
        
        await db.prepare(`
          INSERT OR IGNORE INTO UserRoles (TenantId, Email, RoleId)
          VALUES (?, ?, ?)
        `).bind(tenantId, email, role).run();
      }
    }
  }

  console.log('Test data creation completed successfully!');
  console.log('');
  console.log('Summary:');
  console.log('- 6 test tenants created (test-tenant-1 through test-tenant-6)');
  console.log('- 5 unsigned users (test-user-101 through test-user-105) - will be created on first sign-in');
  console.log('- 5 signed users (test-user-201 through test-user-205) - signed in but not opted in');
  console.log('- 5 opted-in users (test-user-301 through test-user-305) - signed in and opted in');
  console.log('- 60 tenant users (test-user-410 through test-user-469) - distributed across 6 tenants with various roles');

} else {
  // Delete all test data
  console.log('Deleting all test data...');
  
  // Delete test users from UserRoles
  const userRolesDeleted = await db.prepare(`
    DELETE FROM UserRoles 
    WHERE Email LIKE 'test-user-%@logosophe.test'
  `).run();
  console.log(`Deleted ${userRolesDeleted.changes} UserRoles entries`);
  
  // Delete test users from TenantUsers
  const tenantUsersDeleted = await db.prepare(`
    DELETE FROM TenantUsers 
    WHERE Email LIKE 'test-user-%@logosophe.test'
  `).run();
  console.log(`Deleted ${tenantUsersDeleted.changes} TenantUsers entries`);
  
  // Delete test users from Subscribers
  const subscribersDeleted = await db.prepare(`
    DELETE FROM Subscribers 
    WHERE Email LIKE 'test-user-%@logosophe.test'
  `).run();
  console.log(`Deleted ${subscribersDeleted.changes} Subscribers entries`);
  
  // Delete test tenants
  const tenantsDeleted = await db.prepare(`
    DELETE FROM Tenants 
    WHERE Id LIKE 'test-tenant-%'
  `).run();
  console.log(`Deleted ${tenantsDeleted.changes} Tenants entries`);
  
  console.log('All test data deleted successfully!');
} 