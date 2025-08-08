# Workflow Reactivate and Hard Delete Test Plan

## Overview

This document outlines the test plan for implementing two new workflow features:
1. **Reactivate Feature**: Allow reactivation of completed/terminated workflows
2. **Hard Delete Feature**: Allow permanent deletion of soft-deleted workflows

## Feature Specifications

### Reactivate Feature

#### Purpose
Allow workflow initiators and admins to reactivate workflows that are in `completed` or `terminated` status.

#### Access Control
- **System Admins**: Can reactivate any workflow
- **Tenant Admins**: Can reactivate workflows in their tenant(s)
- **Workflow Initiators**: Can reactivate their own workflows
- **Regular Users**: No reactivate access

#### UI Placement
- **WorkflowDetail**: Summary section for completed/terminated workflows
- **WorkflowHistory**: Summary section for completed/terminated workflows
- **Dashboard**: Admin workflow management interface

#### Expected Behavior
- Changes workflow status from `completed`/`terminated` to `active`
- Clears `CompletedAt` and `CompletedBy` fields
- Logs `reactivated` event in WorkflowHistory
- Updates UI to show workflow as active

### Hard Delete Feature

#### Purpose
Allow admins to permanently delete workflows that are already soft-deleted (status = 'deleted').

#### Access Control
- **System Admins**: Can permanently delete any deleted workflow
- **Tenant Admins**: Can permanently delete deleted workflows in their tenant(s)
- **Regular Users**: No permanent delete access

#### UI Placement
- **WorkflowDetail**: Summary section for deleted workflows (admin only)
- **WorkflowHistory**: Summary section for deleted workflows (admin only)
- **Dashboard**: Bulk operations interface for admins

#### Expected Behavior
- Permanently removes data from Workflows, WorkflowParticipants, WorkflowMessages, WorkflowInvitations tables
- Preserves audit trail in WorkflowHistory table
- Logs `permanently_deleted` event in WorkflowHistory
- Updates UI to remove workflow from lists

## Test Scenarios

### Phase 1: Reactivate Feature Testing

#### Test Case 1.1: Reactivate Completed Workflow (Initiator)
**Preconditions:**
- User is workflow initiator
- Workflow status is 'completed'

**Steps:**
1. Navigate to workflow detail page
2. Verify "Reactivate Workflow" button is visible
3. Click "Reactivate Workflow" button
4. Confirm action in dialog

**Expected Results:**
- Workflow status changes to 'active'
- CompletedAt and CompletedBy fields are cleared
- WorkflowHistory shows 'reactivated' event
- UI updates to show workflow as active
- User can send messages to workflow again

#### Test Case 1.2: Reactivate Terminated Workflow (Admin)
**Preconditions:**
- User is system admin or tenant admin
- Workflow status is 'terminated'

**Steps:**
1. Navigate to workflow history page
2. Find terminated workflow
3. Click "Reactivate" button
4. Confirm action

**Expected Results:**
- Workflow status changes to 'active'
- WorkflowHistory shows 'reactivated' event
- Workflow appears in active workflows list

#### Test Case 1.3: Reactivate Access Control (Regular User)
**Preconditions:**
- User is not initiator or admin
- Workflow status is 'completed'

**Steps:**
1. Navigate to workflow detail page
2. Look for reactivate button

**Expected Results:**
- "Reactivate Workflow" button is not visible
- User cannot reactivate workflow

#### Test Case 1.4: Reactivate Active Workflow
**Preconditions:**
- Workflow status is 'active'

**Steps:**
1. Navigate to workflow detail page
2. Look for reactivate button

**Expected Results:**
- "Reactivate Workflow" button is not visible
- Reactivate action is not available for active workflows

### Phase 2: Hard Delete Feature Testing

#### Test Case 2.1: Permanent Delete (System Admin)
**Preconditions:**
- User is system admin
- Workflow status is 'deleted'

**Steps:**
1. Navigate to workflow detail page
2. Verify "Permanently Delete Workflow" button is visible
3. Click button
4. Confirm action in warning dialog

**Expected Results:**
- Workflow data removed from Workflows table
- WorkflowParticipants data removed
- WorkflowMessages data removed
- WorkflowInvitations data removed
- WorkflowHistory records preserved
- New 'permanently_deleted' event logged
- Workflow no longer appears in any lists

#### Test Case 2.2: Permanent Delete (Tenant Admin)
**Preconditions:**
- User is tenant admin
- Workflow belongs to user's tenant
- Workflow status is 'deleted'

**Steps:**
1. Navigate to workflow history page
2. Find deleted workflow
3. Click "Delete Permanently" button
4. Confirm action

**Expected Results:**
- Same as Test Case 2.1
- Access control properly enforced

#### Test Case 2.3: Permanent Delete Access Control
**Preconditions:**
- User is not admin
- Workflow status is 'deleted'

**Steps:**
1. Navigate to workflow detail page
2. Look for permanent delete button

**Expected Results:**
- "Permanently Delete Workflow" button is not visible
- User cannot permanently delete workflow

#### Test Case 2.4: Permanent Delete Non-Deleted Workflow
**Preconditions:**
- User is system admin
- Workflow status is 'active'

**Steps:**
1. Navigate to workflow detail page
2. Look for permanent delete button

**Expected Results:**
- "Permanently Delete Workflow" button is not visible
- Permanent delete action is not available for non-deleted workflows

### Phase 3: Bulk Operations Testing

#### Test Case 3.1: Bulk Permanent Delete (System Admin)
**Preconditions:**
- User is system admin
- Multiple workflows have status 'deleted'

**Steps:**
1. Navigate to dashboard admin interface
2. Select multiple deleted workflows
3. Choose "Bulk Permanent Delete" action
4. Confirm action

**Expected Results:**
- All selected workflows permanently deleted
- WorkflowHistory records preserved for all workflows
- 'permanently_deleted' events logged for all workflows
- UI updates to remove deleted workflows from list

#### Test Case 3.2: Bulk Permanent Delete (Tenant Admin)
**Preconditions:**
- User is tenant admin
- Multiple deleted workflows belong to user's tenant

**Steps:**
1. Navigate to dashboard admin interface
2. Select multiple deleted workflows
3. Choose "Bulk Permanent Delete" action
4. Confirm action

**Expected Results:**
- Only workflows in user's tenant are deleted
- Access control properly enforced
- WorkflowHistory records preserved

### Phase 4: Database Verification Testing

#### Test Case 4.1: Reactivate Database Verification
**Preconditions:**
- Workflow is reactivated

**Steps:**
1. Query Workflows table
2. Query WorkflowHistory table

**Expected Results:**
- Workflows table: status = 'active', CompletedAt = NULL, CompletedBy = NULL
- WorkflowHistory table: contains 'reactivated' event with correct metadata

#### Test Case 4.2: Hard Delete Database Verification
**Preconditions:**
- Workflow is permanently deleted

**Steps:**
1. Query Workflows table
2. Query WorkflowParticipants table
3. Query WorkflowMessages table
4. Query WorkflowInvitations table
5. Query WorkflowHistory table

**Expected Results:**
- Workflows table: workflow record removed
- WorkflowParticipants table: participant records removed
- WorkflowMessages table: message records removed
- WorkflowInvitations table: invitation records removed
- WorkflowHistory table: all history records preserved, includes 'permanently_deleted' event

### Phase 5: Error Handling Testing

#### Test Case 5.1: Reactivate Network Error
**Preconditions:**
- Network connection unstable

**Steps:**
1. Attempt to reactivate workflow
2. Simulate network error

**Expected Results:**
- Error message displayed to user
- Workflow status unchanged
- No WorkflowHistory event logged

#### Test Case 5.2: Hard Delete Database Error
**Preconditions:**
- Database connection issues

**Steps:**
1. Attempt to permanently delete workflow
2. Simulate database error

**Expected Results:**
- Error message displayed to user
- Workflow data unchanged
- No WorkflowHistory event logged

#### Test Case 5.3: Concurrent Operations
**Preconditions:**
- Multiple users accessing same workflow

**Steps:**
1. User A attempts to reactivate workflow
2. User B attempts to permanently delete same workflow
3. Both operations execute simultaneously

**Expected Results:**
- Database constraints prevent conflicting operations
- One operation succeeds, other fails gracefully
- Appropriate error messages displayed

## Test Data Requirements

### Test Workflows Needed
1. **Active Workflow**: For testing that reactivate is not available
2. **Completed Workflow**: For testing reactivate functionality
3. **Terminated Workflow**: For testing reactivate functionality
4. **Deleted Workflow**: For testing permanent delete functionality
5. **Multiple Deleted Workflows**: For testing bulk operations

### Test Users Needed
1. **System Admin**: Full access to all workflows
2. **Tenant Admin**: Access to workflows in specific tenant
3. **Workflow Initiator**: Can reactivate own workflows
4. **Regular User**: No special permissions
5. **Different Tenant User**: For testing access control

## Test Environment Setup

### Database Setup
```sql
-- Create test workflows with different statuses
INSERT INTO Workflows (Id, Title, Status, ...) VALUES (...);

-- Create test users with different roles
INSERT INTO Credentials (Email, Role) VALUES (...);
INSERT INTO TenantUsers (Email, TenantId, RoleId) VALUES (...);

-- Create test workflow participants
INSERT INTO WorkflowParticipants (WorkflowId, ParticipantEmail, Role) VALUES (...);

-- Create test workflow messages
INSERT INTO WorkflowMessages (Id, WorkflowId, SenderEmail, Content) VALUES (...);
```

### Test Scripts
```bash
# Clear test data
yarn wrangler d1 execute logosophe --local --file=scripts/clear-workflow-data.sql

# Create test data
yarn wrangler d1 execute logosophe --local --file=scripts/create-test-workflows.sql
```

## Success Criteria

### Reactivate Feature
- ✅ Reactivate button appears for completed/terminated workflows
- ✅ Only initiators and admins see reactivate button
- ✅ Workflow status changes to 'active' after reactivate
- ✅ WorkflowHistory logs 'reactivated' event
- ✅ UI updates correctly after reactivation
- ✅ Access control properly enforced

### Hard Delete Feature
- ✅ Permanent delete button appears for deleted workflows (admin only)
- ✅ Workflow data completely removed from main tables
- ✅ WorkflowHistory records preserved
- ✅ 'permanently_deleted' event logged
- ✅ UI updates correctly after permanent deletion
- ✅ Access control properly enforced

### Bulk Operations
- ✅ Bulk delete interface available to admins
- ✅ Multiple workflows can be selected and deleted
- ✅ Access control enforced for bulk operations
- ✅ All selected workflows properly deleted
- ✅ WorkflowHistory preserved for all deleted workflows

## Rollback Plan

If issues are discovered during testing:

1. **Database Rollback**: Use database backups to restore state
2. **Code Rollback**: Revert to previous git commit
3. **Feature Toggle**: Disable features via configuration if needed
4. **Monitoring**: Watch for any unexpected behavior in production

## Performance Considerations

### Testing Performance Impact
- Test with large number of workflows (100+)
- Test bulk operations with 50+ workflows
- Monitor database query performance
- Verify UI responsiveness during operations

### Expected Performance
- Reactivate: < 1 second
- Single hard delete: < 2 seconds
- Bulk delete (10 workflows): < 5 seconds
- UI updates: < 500ms

## Security Considerations

### Access Control Testing
- Verify all access control rules are enforced
- Test with different user roles and permissions
- Ensure no unauthorized access to features
- Verify audit trail is complete and accurate

### Data Protection
- Ensure deleted data is properly removed
- Verify audit trail cannot be tampered with
- Test that sensitive data is not exposed
- Verify proper error handling for security issues
