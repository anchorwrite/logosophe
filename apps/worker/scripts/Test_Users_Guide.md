# Test User Management System

This system provides a comprehensive solution for creating and managing test users in your Logosophe application without requiring real email accounts.

## Overview

The test user system includes:
- **30 test users** with various roles and permissions
- **4 test tenants** for multi-tenant testing
- **Custom Auth.js provider** for test user authentication
- **Consolidated database scripts** for creating/deleting test data
- **Web interface** for easy test user sign-in
- **Session management** with configurable concurrent session limits

## Quick Start

### 1. Create Test Data

```bash
# For local development
yarn wrangler d1 execute logosophe --file=scripts/create-test-users-consolidated.sql

# For production (not recommended - test users should only be in development)
yarn wrangler d1 execute logosophe --remote --file=scripts/create-test-users-consolidated.sql
```

### 2. Access Test User Interface

Navigate to `/dashboard/test-users` in your application to access the test user sign-in interface (admin access required).

### 3. Sign In as Test User

Use any of the following test user emails:
- `test-user-201@logosophe.test` (signed user)
- `test-user-301@logosophe.test` (opted-in user)
- `test-user-411@logosophe.test` (tenant user)

## Test User Categories

### 1. Signed Users (201-205)
- **5 users** who have signed in but haven't opted in
- Exist in TenantUsers table with 'user' role
- Not in Subscribers table

### 2. Opted-in Users (301-305)
- **5 users** who have signed in and opted in
- Exist in both TenantUsers and Subscribers tables
- Have 'user' and 'subscriber' roles

### 3. Tenant Users (411-445)
- **20 users** distributed across 4 test tenants
- Each tenant has 5 users with various role combinations
- All have signed in and opted in
- Follows 4-X-Y pattern: 4 (class) - X (tenant 1-4) - Y (user 1-5)
- User ranges: 411-415, 421-425, 431-435, 441-445

## Test Tenants

Four test tenants are created:
- `test-tenant-1` through `test-tenant-4`
- Each tenant has 5 users with different role combinations
- Role combinations include: author, agent, reviewer, editor, and combinations
- User distribution: 411-415, 421-425, 431-435, 441-445

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
- **Preferences**: User preferences with 'Test' as CurrentProvider

## Management Commands

### Create Test Data
```bash
yarn wrangler d1 execute logosophe --file=scripts/create-test-users-consolidated.sql
```

### Delete Test Data
```bash
yarn wrangler d1 execute logosophe --file=scripts/delete-test-users-consolidated.sql
```

### Production Commands
Add the `--remote` flag for production database operations (not recommended for test users).

## Authentication Flow

1. **Test Provider**: Custom Auth.js provider handles test user authentication
2. **Email Validation**: Only accepts emails ending with `@logosophe.test`
3. **OAuth Bypass**: Test users bypass normal OAuth processing in auth.ts
4. **User Creation**: Automatically creates users in appropriate tables based on user number
5. **Role Assignment**: Assigns roles based on user category and tenant membership
6. **Dashboard Access**: Test user management is available at `/dashboard/test-users` (admin only)

## Session Management

### Concurrent Session Limits
- **Default limit**: 15 concurrent test sessions
- **Configurable**: Set via `MAX_CONCURRENT_TEST_SESSIONS` environment variable
- **Purpose**: Prevents resource overload and ensures system performance
- **Error handling**: Returns 429 error when limit is exceeded

### Increasing Session Limits
```bash
# Set as Cloudflare secret (recommended)
echo "30" | yarn wrangler secret put MAX_CONCURRENT_TEST_SESSIONS

# Or set in wrangler.jsonc
{
  "vars": {
    "MAX_CONCURRENT_TEST_SESSIONS": "30"
  }
}
```

### Session Monitoring
- Active sessions are displayed in the dashboard
- Shows current count vs. maximum limit (e.g., "Sessions: 5/15")
- Sessions can be terminated individually or all at once
- Session URLs are generated for easy testing across different browsers/devices

## Security Considerations

- Test users are only available in development/testing environments
- The test provider only accepts emails with the `@logosophe.test` domain
- Test data can be easily cleaned up using the delete script
- Test users are clearly identified in the database
- Test user management is restricted to system administrators only
- Foreign key constraints have been optimized to prevent insertion issues
- Session limits prevent abuse of the test system

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
yarn wrangler d1 execute logosophe --command="SELECT COUNT(*) as count FROM TenantUsers WHERE Email LIKE 'test-user-%@logosophe.test';"

# Check test tenants
yarn wrangler d1 execute logosophe --command="SELECT * FROM Tenants WHERE Id LIKE 'test-tenant-%';"

# Check user roles
yarn wrangler d1 execute logosophe --command="SELECT Email, RoleId FROM UserRoles WHERE Email LIKE 'test-user-%@logosophe.test' LIMIT 10;"
```

## Integration with Existing System

The test user system integrates seamlessly with your existing:
- **Auth.js v5** authentication flow
- **Role-based access control** system
- **Multi-tenant** architecture
- **Database schema** and relationships
- **Dashboard admin interface** at `/dashboard/test-users`

Test users follow the same authentication and authorization patterns as real users, making them perfect for testing all aspects of your application. The system is now properly organized under the dashboard structure and requires admin privileges for access. 