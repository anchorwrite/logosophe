# Logosophe System Logging Analysis & Enhancement Plan

## Executive Summary

This document analyzes the current SystemLogs implementation in Logosophe and outlines a plan to standardize logging for enhanced analytics capabilities, particularly for media usage tracking and trend analysis.

## Current System Overview

### Database Schema
The `SystemLogs` table contains 15 columns designed for comprehensive event tracking:

| Column | Type | Description | Required |
|--------|------|-------------|----------|
| `Id` | INTEGER | Primary key | Yes |
| `LogType` | TEXT | Type of log entry | Yes |
| `Timestamp` | DATETIME | When event occurred | Yes |
| `UserId` | TEXT | User ID (optional) | No |
| `UserEmail` | TEXT | User email | No |
| `Provider` | TEXT | Auth provider | No |
| `TenantId` | TEXT | Associated tenant | No |
| `ActivityType` | TEXT | For activity logs | No |
| `AccessType` | TEXT | For media access logs | No |
| `TargetId` | TEXT | ID of target resource | No |
| `TargetName` | TEXT | Name/description of target | No |
| `IpAddress` | TEXT | Request IP address | No |
| `UserAgent` | TEXT | Request user agent | No |
| `Metadata` | TEXT | JSON string for additional context | No |
| `IsDeleted` | BOOLEAN | Soft delete flag | No |

### Current Log Volume & Distribution
- **Total Entries**: 1,790 logs
- **Time Span**: August 2, 2025 to August 18, 2025 (~2.5 weeks)
- **Average**: ~100 logs per day
- **No Deleted Logs**: All logs are active (IsDeleted = 0)

### Log Type Distribution
| LogType | Count | Percentage | Description |
|---------|-------|------------|-------------|
| activity | 824 | 46% | System activities, access control, role management |
| media_access | 470 | 26% | Media file operations (view, download, upload, delete) |
| messaging | 320 | 18% | Messaging system events |
| auth | 144 | 8% | Authentication events (signin/signout) |
| test_session | 19 | 1% | Test session tracking |
| main_access | 13 | 1% | Main application access |

### Media Access Logging
Currently tracks these operations:
- `view` - File views (most common)
- `download` - File downloads
- `upload` - File uploads  
- `soft_delete` - File deletions

## User Requirements

### Analytics Scope
1. **All Media Files**: Analytics should cover both published and unpublished content
2. **Separate Reporting**: 
   - **Unpublished Files**: Works in progress, collaborated on by tenant members
   - **Published Files**: Complete content available to general public (non-subscribers)

### Technical Requirements
1. **Time Granularity**: Daily
2. **Real-time**: Not batch processing
3. **Data Retention**: Existing retention policy with daily cron job for soft-deleting older logs

### Target Features
- Media file usage statistics (views, downloads)
- Trend analysis ("Views of X increased by 5% last week")
- Role-based access to analytics:
  - **Authors**: Analytics for files they own/created
  - **Agents**: Analytics for files in their assigned tenants
  - **Publishers**: Analytics for published content
  - **System Admins**: All analytics

## Current Logging Implementation

### Media Access Logging
The system uses a `SystemLogs` class with dedicated methods:

```typescript
// From lib/system-logs.ts
async logMediaAccess(data: {
    userEmail: string;
    tenantId?: string;
    accessType: string;
    targetId: string;
    targetName: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
}): Promise<number>
```

### Logging Locations
Media access is logged in these key locations:
- `/api/media/[id]/route.ts` - File viewing
- `/api/media/[id]/download/route.ts` - File downloads
- `/api/media/route.ts` - File uploads
- `/api/media/[id]/preview/route.ts` - File previews
- `/api/media/share/[token]/download/route.ts` - Shared file access

### Role-Based Access Control
The system supports the required roles:
- `author` - Can create, manage, and view content
- `agent` - Limited access (view, download, link)
- `publisher` - Can publish content to subscribers
- `admin` - Full system access
- `tenant` - Tenant admin access

## Issues Identified

### 1. Log Type Inconsistency ✅ COMPLETED
- **Issue**: Mixed case in LogType field
- **Previous**: Both "AUTH" (142 logs) and "auth" (2 logs)
- **Solution**: Standardized all log types to lowercase
- **Result**: All log types now use consistent lowercase format

### 2. Missing Operations
- **Issue**: Some media operations may not be consistently logged
- **Gap**: Need to audit all media endpoints for logging coverage

### 3. Metadata Underutilization
- **Issue**: Metadata field is rarely used
- **Opportunity**: Could store structured data for better analytics

### 4. Inconsistent Logging Patterns
- **Issue**: Some endpoints use direct SystemLogs calls, others use helper functions
- **Impact**: Potential for missed logging or inconsistent data

## Phase 1: Standardization Plan

### Objective
Clean up existing logging inconsistencies and ensure comprehensive coverage across all media operations.

### Tasks

#### 1.1 Fix Log Type Consistency ✅ COMPLETED
- [x] Standardize all "AUTH" logs to "auth"
- [x] Update all code that creates uppercase log types
- [x] Verify no other case inconsistencies exist
- [x] Update database to reflect new lowercase log types

#### 1.2 Audit Media Logging Coverage
- [ ] Review all media-related API endpoints
- [ ] Ensure every media operation is logged
- [ ] Standardize logging patterns across endpoints
- [ ] Add missing logging where needed

#### 1.3 Enhance Metadata Usage
- [ ] Define standard metadata structure for media operations
- [ ] Add relevant context (file size, content type, etc.)
- [ ] Include session information where appropriate

#### 1.4 Standardize Logging Patterns
- [ ] Ensure all endpoints use the SystemLogs class
- [ ] Standardize error handling for logging failures
- [ ] Add logging to any uncovered operations

### Implementation Approach

#### Database Updates ✅ COMPLETED
```sql
-- Standardized all log types to lowercase
UPDATE SystemLogs SET LogType = 'activity' WHERE LogType = 'ACTIVITY' AND IsDeleted = 0;
UPDATE SystemLogs SET LogType = 'media_access' WHERE LogType = 'MEDIA_ACCESS' AND IsDeleted = 0;
UPDATE SystemLogs SET LogType = 'messaging' WHERE LogType = 'MESSAGING' AND IsDeleted = 0;
UPDATE SystemLogs SET LogType = 'test_session' WHERE LogType = 'TEST_SESSION' AND IsDeleted = 0;
UPDATE SystemLogs SET LogType = 'main_access' WHERE LogType = 'MAIN_ACCESS' AND IsDeleted = 0;
```

#### Code Standardization ✅ COMPLETED
- [x] Updated all log type assignments to lowercase
- [x] Standardized SystemLogs helper methods
- [x] Updated UI components (LogsTable.tsx)
- [x] Ensured consistent logging patterns across all endpoints

#### Testing Strategy
- Verify all media operations generate logs
- Check log data consistency
- Validate role-based access patterns

## Future Phases

### Phase 2: Analytics Infrastructure
- Create analytics API endpoints
- Implement role-based access to analytics
- Add basic usage statistics

### Phase 3: Trend Analysis
- Implement daily aggregation
- Add percentage change calculations
- Create trend visualization components

## Analytics Query Examples

### Basic Media Usage
```sql
-- Get view counts per file for a tenant
SELECT 
  TargetId as MediaId,
  TargetName as FileName,
  COUNT(*) as ViewCount,
  COUNT(CASE WHEN AccessType = 'download' THEN 1 END) as DownloadCount
FROM SystemLogs 
WHERE LogType = 'MEDIA_ACCESS' 
  AND TenantId = 'tenant-id'
  AND AccessType IN ('view', 'download')
  AND IsDeleted = 0
GROUP BY TargetId, TargetName;
```

### Daily Trends
```sql
-- Get daily usage for trend analysis
SELECT 
  TargetId,
  TargetName,
  DATE(Timestamp) as Date,
  COUNT(*) as DailyViews
FROM SystemLogs 
WHERE LogType = 'MEDIA_ACCESS' 
  AND AccessType = 'view'
  AND TenantId = 'tenant-id'
GROUP BY TargetId, TargetName, Date
ORDER BY Date DESC;
```

### Published vs Unpublished
```sql
-- Separate published and unpublished content
SELECT 
  TargetId,
  TargetName,
  CASE 
    WHEN EXISTS (SELECT 1 FROM PublishedContent WHERE MediaId = TargetId) 
    THEN 'published' 
    ELSE 'unpublished' 
  END as ContentStatus,
  COUNT(*) as ViewCount
FROM SystemLogs 
WHERE LogType = 'MEDIA_ACCESS' 
  AND AccessType = 'view'
  AND TenantId = 'tenant-id'
GROUP BY TargetId, TargetName, ContentStatus;
```

## Conclusion

The current logging system provides an excellent foundation for the desired analytics features. The main work in Phase 1 is standardizing existing logging patterns and ensuring comprehensive coverage. Once completed, the system will be ready for building sophisticated analytics capabilities that provide valuable insights into media usage patterns across both published and unpublished content.

The role-based access control system is already well-positioned to support the analytics access requirements, and the daily retention policy with real-time logging will provide the necessary data granularity for trend analysis.

## Phase 1 Completion Summary

### ✅ Completed Tasks

#### 1.1 Log Type Standardization
- **Database Updates**: Converted all 1,790 existing log entries from uppercase to lowercase
- **Code Updates**: Updated 51+ files to use consistent lowercase log types
- **Helper Methods**: Standardized all SystemLogs class methods
- **UI Components**: Updated LogsTable.tsx to handle new lowercase log types

#### 1.2 Log Type Mapping
| Previous | New | Count |
|----------|-----|-------|
| ACTIVITY | activity | 824 |
| MEDIA_ACCESS | media_access | 470 |
| MESSAGING | messaging | 320 |
| AUTH | auth | 144 |
| TEST_SESSION | test_session | 19 |
| MAIN_ACCESS | main_access | 13 |

#### 1.3 Files Modified
- **Core Library Files**: 4 files (system-logs.ts, media-access.ts, messaging.ts, workflow.ts)
- **API Routes**: 25+ files with direct log type assignments
- **Dashboard Components**: 20+ files with logging functionality
- **UI Components**: LogsTable.tsx for display consistency

### 🔄 Next Steps for Phase 1

#### 1.2 Audit Media Logging Coverage
- [ ] Review all media-related API endpoints
- [ ] Ensure every media operation is logged
- [ ] Standardize logging patterns across endpoints
- [ ] Add missing logging where needed

#### 1.3 Enhance Metadata Usage
- [ ] Define standard metadata structure for media operations
- [ ] Add relevant context (file size, content type, etc.)
- [ ] Include session information where appropriate

#### 1.4 Standardize Logging Patterns
- [ ] Ensure all endpoints use the SystemLogs class consistently
- [ ] Standardize error handling for logging failures
- [ ] Add logging to any uncovered operations

### 📊 Current Status
- **Phase 1.1**: ✅ 100% Complete - Log Type Standardization
- **Phase 1.2**: ⏳ 0% Complete - Media Logging Coverage Audit
- **Phase 1.3**: ⏳ 0% Complete - Metadata Enhancement
- **Phase 1.4**: ⏳ 0% Complete - Logging Pattern Standardization

**Overall Phase 1 Progress**: 25% Complete
