#!/usr/bin/env tsx

import { D1Database } from '@cloudflare/workers-types';

interface TestUser {
  email: string;
  name: string;
  tenantId?: string;
  roles: string[];
  signedIn: boolean;
  optedIn: boolean;
}

interface TestTenant {
  id: string;
  name: string;
  description: string;
}

class TestUserManager {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async createTestUsers(action: 'create' | 'delete'): Promise<void> {
    console.log(`Starting ${action} operation for test users and tenants...`);

    if (action === 'delete') {
      await this.deleteAllTestData();
      return;
    }

    // Create test tenants first
    await this.createTestTenants();

    // Create test users
    await this.createSignedUsers();
    await this.createOptedInUsers();
    await this.createTenantUsers();

    console.log('Test data creation completed successfully!');
  }

  private async createTestTenants(): Promise<void> {
    console.log('Creating test tenants...');
    
    const tenants: TestTenant[] = [
      { id: 'test-tenant-1', name: 'Test Tenant 1', description: 'Test Tenant 1' },
      { id: 'test-tenant-2', name: 'Test Tenant 2', description: 'Test Tenant 2' },
      { id: 'test-tenant-3', name: 'Test Tenant 3', description: 'Test Tenant 3' },
      { id: 'test-tenant-4', name: 'Test Tenant 4', description: 'Test Tenant 4' },
      { id: 'test-tenant-5', name: 'Test Tenant 5', description: 'Test Tenant 5' },
      { id: 'test-tenant-6', name: 'Test Tenant 6', description: 'Test Tenant 6' },
    ];

    for (const tenant of tenants) {
      try {
        await this.db.prepare(`
          INSERT OR IGNORE INTO Tenants (Id, Name, Description, CreatedAt, UpdatedAt)
          VALUES (?, ?, ?, datetime('now'), datetime('now'))
        `).bind(tenant.id, tenant.name, tenant.description).run();
        console.log(`Created tenant: ${tenant.id}`);
      } catch (error) {
        console.log(`Tenant ${tenant.id} already exists or error:`, error);
      }
    }
  }

  private async createSignedUsers(): Promise<void> {
    console.log('Creating signed users (101-105, 201-205)...');
    
    const users: TestUser[] = [
      // Users 101-105 (previously unsigned, now signed)
      { email: 'test-user-101@logosophe.test', name: 'Test User 101', roles: ['user'], signedIn: true, optedIn: false },
      { email: 'test-user-102@logosophe.test', name: 'Test User 102', roles: ['user'], signedIn: true, optedIn: false },
      { email: 'test-user-103@logosophe.test', name: 'Test User 103', roles: ['user'], signedIn: true, optedIn: false },
      { email: 'test-user-104@logosophe.test', name: 'Test User 104', roles: ['user'], signedIn: true, optedIn: false },
      { email: 'test-user-105@logosophe.test', name: 'Test User 105', roles: ['user'], signedIn: true, optedIn: false },
      // Users 201-205 (previously signed)
      { email: 'test-user-201@logosophe.test', name: 'Test User 201', roles: ['user'], signedIn: true, optedIn: false },
      { email: 'test-user-202@logosophe.test', name: 'Test User 202', roles: ['user'], signedIn: true, optedIn: false },
      { email: 'test-user-203@logosophe.test', name: 'Test User 203', roles: ['user'], signedIn: true, optedIn: false },
      { email: 'test-user-204@logosophe.test', name: 'Test User 204', roles: ['user'], signedIn: true, optedIn: false },
      { email: 'test-user-205@logosophe.test', name: 'Test User 205', roles: ['user'], signedIn: true, optedIn: false },
    ];

    for (const user of users) {
      await this.createUserInTenantUsers(user);
    }
  }

  private async createOptedInUsers(): Promise<void> {
    console.log('Creating opted-in users (301-305)...');
    
    const users: TestUser[] = [
      { email: 'test-user-301@logosophe.test', name: 'Test User 301', roles: ['user', 'subscriber'], signedIn: true, optedIn: true },
      { email: 'test-user-302@logosophe.test', name: 'Test User 302', roles: ['user', 'subscriber'], signedIn: true, optedIn: true },
      { email: 'test-user-303@logosophe.test', name: 'Test User 303', roles: ['user', 'subscriber'], signedIn: true, optedIn: true },
      { email: 'test-user-304@logosophe.test', name: 'Test User 304', roles: ['user', 'subscriber'], signedIn: true, optedIn: true },
      { email: 'test-user-305@logosophe.test', name: 'Test User 305', roles: ['user', 'subscriber'], signedIn: true, optedIn: true },
    ];

    for (const user of users) {
      await this.createUserInTenantUsers(user);
      await this.createUserInSubscribers(user);
      await this.createUserRoles(user);
    }
  }

  private async createTenantUsers(): Promise<void> {
    console.log('Creating tenant users (410-469)...');
    
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
        const user: TestUser = {
          email: `test-user-${userNumber}@logosophe.test`,
          name: `Test User ${userNumber}`,
          tenantId,
          roles: ['user', 'subscriber', ...roleCombinations[i]],
          signedIn: true,
          optedIn: true,
        };

        await this.createUserInTenantUsers(user);
        await this.createUserInSubscribers(user);
        await this.createUserRoles(user);
      }
    }
  }

  private async createUserInTenantUsers(user: TestUser): Promise<void> {
    try {
      await this.db.prepare(`
        INSERT OR IGNORE INTO TenantUsers (TenantId, Email, RoleId, CreatedAt, UpdatedAt)
        VALUES (?, ?, ?, datetime('now'), datetime('now'))
      `).bind(user.tenantId || 'default', user.email, 'user').run();
      console.log(`Created TenantUsers entry for: ${user.email}`);
    } catch (error) {
      console.log(`Error creating TenantUsers entry for ${user.email}:`, error);
    }
  }

  private async createUserInSubscribers(user: TestUser): Promise<void> {
    try {
      await this.db.prepare(`
        INSERT OR IGNORE INTO Subscribers (Email, Name, Active, Provider, CreatedAt, UpdatedAt)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(user.email, user.name, true, 'test', new Date().toISOString(), new Date().toISOString()).run();
      console.log(`Created Subscribers entry for: ${user.email}`);
    } catch (error) {
      console.log(`Error creating Subscribers entry for ${user.email}:`, error);
    }
  }

  private async createUserRoles(user: TestUser): Promise<void> {
    for (const role of user.roles) {
      if (role === 'user') continue; // Skip base user role as it's already in TenantUsers
      
      try {
        await this.db.prepare(`
          INSERT OR IGNORE INTO UserRoles (TenantId, Email, RoleId)
          VALUES (?, ?, ?)
        `).bind(user.tenantId || 'default', user.email, role).run();
        console.log(`Added role ${role} for: ${user.email}`);
      } catch (error) {
        console.log(`Error adding role ${role} for ${user.email}:`, error);
      }
    }
  }

  private async deleteAllTestData(): Promise<void> {
    console.log('Deleting all test data...');

    // Delete test users from UserRoles
    await this.db.prepare(`
      DELETE FROM UserRoles 
      WHERE Email LIKE 'test-user-%@logosophe.test'
    `).run();

    // Delete test users from TenantUsers
    await this.db.prepare(`
      DELETE FROM TenantUsers 
      WHERE Email LIKE 'test-user-%@logosophe.test'
    `).run();

    // Delete test users from Subscribers
    await this.db.prepare(`
      DELETE FROM Subscribers 
      WHERE Email LIKE 'test-user-%@logosophe.test'
    `).run();

    // Delete test tenants
    await this.db.prepare(`
      DELETE FROM Tenants 
      WHERE Id LIKE 'test-tenant-%'
    `).run();

    console.log('All test data deleted successfully!');
  }
}

// Main execution
async function main() {
  const action = process.argv[2] as 'create' | 'delete';
  
  if (!action || !['create', 'delete'].includes(action)) {
    console.error('Usage: tsx create-test-users.ts <create|delete>');
    process.exit(1);
  }

  // This script is designed to be run in a Cloudflare Workers environment
  // where the database is available via the environment
  console.log(`Starting test user management with action: ${action}`);
  
  // Note: In a real implementation, you would get the database from the environment
  // For now, this is a template that needs to be adapted to your specific setup
  console.log('This script needs to be adapted to your specific database setup.');
  console.log('You can run it using wrangler or integrate it into your deployment process.');
}

if (require.main === module) {
  main().catch(console.error);
}

export { TestUserManager }; 