# Test User Management System

This system provides a comprehensive solution for creating and managing test users in your Logosophe application without requiring real email accounts.

## Overview

The test user system includes:
- **50 test users** with various roles and permissions
- **6 test tenants** for multi-tenant testing
- **Custom Auth.js provider** for test user authentication
- **Database scripts** for creating/deleting test data
- **Web interface** for easy test user sign-in

## Quick Start

### 1. Create Test Data

```bash
# For local development
yarn wrangler d1 execute DB --local --file=scripts/create-test-users.sql

# For production (not recommended - test users should only be in development)
yarn wrangler d1 execute DB --remote --file=scripts/create-test-users.sql
```

### 2. Access Test User Interface

Navigate to `/dashboard/test-users` in your application to access the test user sign-in interface (admin access required).

### 3. Sign In as Test User

Use any of the following test user emails:
- `test-user-101@logosophe.test` (unsigned user)
- `test-user-201@logosophe.test` (signed user)
- `test-user-301@logosophe.test` (opted-in user)
- `test-user-311@logosophe.test` (tenant user)

## Test User Categories

### 1. Unsigned Users (101-105)
- **5 users** who haven't signed in yet
- Will be created automatically on first sign-in
- Have basic 'user' role in default tenant

### 2. Signed Users (201-205)
- **5 users** who have signed in but haven't opted in
- Exist in TenantUsers table with 'user' role
- Not in Subscribers table

### 3. Opted-in Users (301-310)
- **10 users** who have signed in and opted in
- Exist in both TenantUsers and Subscribers tables
- Have 'user' and 'subscriber' roles

### 4. Tenant Users (311-340)
- **30 users** distributed across 6 test tenants
- Each tenant has 5 users with various role combinations
- All have signed in and opted in

## Test Tenants

Six test tenants are created:
- `test-tenant-1` through `test-tenant-6`
- Each tenant has 5 users with different role combinations
- Role combinations include: author, agent, reviewer, editor, and combinations

## Role Combinations

Tenant users have various role combinations:
- Single roles: author, agent, reviewer, editor
- Dual roles: author+reviewer, agent+reviewer, author+editor, agent+editor, reviewer+editor, author+agent

## Database Schema

Test users are created in the following tables:
- **TenantUsers**: Base user membership with 'user' role
- **Subscribers**: For opted-in users
- **UserRoles**: Additional roles beyond 'user'
- **Tenants**: Test tenant definitions

## Management Commands

### Create Test Data
```bash
yarn wrangler d1 execute DB --local --file=scripts/manage-test-users.js -- --create
```

### Delete Test Data
```bash
yarn wrangler d1 execute DB --local --file=scripts/delete-test-users.sql
```

### Production Commands
Remove the `--local` flag for production database operations (not recommended for test users).

## Authentication Flow

1. **Test Provider**: Custom Auth.js provider handles test user authentication
2. **Email Validation**: Only accepts emails ending with `@logosophe.test`
3. **User Creation**: Automatically creates users in appropriate tables based on user number
4. **Role Assignment**: Assigns roles based on user category and tenant membership
5. **Dashboard Access**: Test user management is available at `/dashboard/test-users` (admin only)

## Security Considerations

- Test users are only available in development/testing environments
- The test provider only accepts emails with the `@logosophe.test` domain
- Test data can be easily cleaned up using the delete script
- Test users are clearly identified in the database
- Test user management is restricted to system administrators only
- Foreign key constraints have been optimized to prevent insertion issues

## Troubleshooting

### Common Issues

1. **Test users not appearing**: Ensure the database script has been run
2. **Sign-in failures**: Check that the test provider is properly configured in auth.ts
3. **Role issues**: Verify that the Roles table contains the expected roles (user, subscriber, author, agent, reviewer, editor)
4. **Foreign key constraint errors**: These have been resolved by removing the restrictive PublisherId constraint from PublishedContent table
5. **Access denied**: Ensure you have system administrator privileges to access `/dashboard/test-users`

### Verification Commands

```bash
# Check test users in database
yarn wrangler d1 execute DB --local --command="SELECT COUNT(*) as count FROM TenantUsers WHERE Email LIKE 'test-user-%@logosophe.test';"

# Check test tenants
yarn wrangler d1 execute DB --local --command="SELECT * FROM Tenants WHERE Id LIKE 'test-tenant-%';"

# Check user roles
yarn wrangler d1 execute DB --local --command="SELECT Email, RoleId FROM UserRoles WHERE Email LIKE 'test-user-%@logosophe.test' LIMIT 10;"
```

## Integration with Existing System

The test user system integrates seamlessly with your existing:
- **Auth.js v5** authentication flow
- **Role-based access control** system
- **Multi-tenant** architecture
- **Database schema** and relationships
- **Dashboard admin interface** at `/dashboard/test-users`

Test users follow the same authentication and authorization patterns as real users, making them perfect for testing all aspects of your application. The system is now properly organized under the dashboard structure and requires admin privileges for access. 