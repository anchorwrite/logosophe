# Log Retention and Archiving System

This document describes the log retention and archiving system implemented for the Logosophe application.

## Overview

The system provides automated log retention management with configurable policies, soft deletion (archiving), and eventual hard deletion to free up database space while maintaining audit trails.

## Features

### 1. **Configurable Retention Policies**
- **Retention Period**: Configurable number of days to keep logs active (default: 90 days)
- **Archive Enabled**: Toggle to enable/disable automatic archiving
- **Hard Delete Delay**: Days to wait after archiving before permanent deletion (default: 7 days)
- **Cron Schedule**: Configurable cron expression for automatic archiving (default: daily at 2 AM UTC)

### 2. **Soft Deletion (Archiving)**
- Logs older than the retention period are marked with `IsDeleted = 1`
- Archived logs remain accessible for compliance and audit purposes
- No data is lost during the archiving process

### 3. **Hard Deletion**
- Archived logs are permanently deleted after the hard delete delay
- Provides option to export archived logs before deletion
- Frees up database space while maintaining audit trail

### 4. **Dashboard Management**
- **Log Statistics**: View total, active, and archived log counts
- **Retention Settings**: Configure retention policies through the UI
- **Archive Management**: Export archived logs and trigger hard deletion
- **Manual Trigger**: Run archive jobs manually for testing or immediate processing

## Configuration

### System Settings

The following settings are stored in the `SystemSettings` table:

| Key | Description | Default | Range |
|-----|-------------|---------|-------|
| `log_retention_days` | Days to keep logs active | 90 | 1-3650 |
| `log_archive_enabled` | Enable automatic archiving | true | true/false |
| `log_hard_delete_delay` | Days to wait before hard deletion | 7 | 1-365 |
| `log_archive_cron_schedule` | Cron schedule for archiving | `0 2 * * *` | Cron expression |

### Cron Schedule Format

The cron schedule follows the standard format: `minute hour day month weekday`

- `0 2 * * *` = Daily at 2:00 AM UTC
- `0 */6 * * *` = Every 6 hours
- `0 0 * * 0` = Weekly on Sunday at midnight

## API Endpoints

### Log Management
- `GET /api/logs` - Query logs with optional `showArchived` parameter
- `GET /api/logs/stats` - Get log statistics (admin only)
- `GET /api/logs/settings` - Get retention settings (admin only)
- `PUT /api/logs/settings` - Update retention settings (admin only)

### Archive Operations
- `POST /api/logs/archive-now` - Manually trigger archiving (admin only)
- `POST /api/logs/export-archived` - Export archived logs as CSV (admin only)
- `POST /api/logs/hard-delete-archived` - Hard delete old archived logs (admin only)

### Cron Job
- `GET /api/cron/log-archive` - Automated archiving endpoint (called by Cloudflare cron)

## Usage

### 1. **Access the Log Retention Manager**
Navigate to `/dashboard/logs` and you'll see the new Log Retention Manager section above the existing logs table.

### 2. **Configure Retention Policies**
- Set the retention period in days
- Enable/disable automatic archiving
- Configure hard delete delay
- Set cron schedule for automatic processing

### 3. **Monitor Archive Status**
- View real-time statistics of active vs archived logs
- See oldest and newest log timestamps
- Monitor archive job results

### 4. **Export and Cleanup**
- Export archived logs as compressed CSV before deletion
- Manually trigger hard deletion when ready
- Use the "Run Archive Now" button for immediate processing

### 5. **Switch Between Active and Archived Logs**
Use the toggle button in the logs table to switch between viewing active and archived logs.

## Implementation Details

### Database Schema
- Uses existing `SystemLogs` table with `IsDeleted` column
- Soft deletion sets `IsDeleted = 1` instead of removing records
- Hard deletion permanently removes archived records

### Cloudflare Integration
- Cron triggers configured in `wrangler.jsonc`
- Automatic daily execution at 2 AM UTC
- Manual triggering available through dashboard

### Security
- All retention management requires system admin privileges
- API endpoints properly authenticated and authorized
- Audit trail maintained for all retention operations

## Monitoring and Troubleshooting

### Check Archive Status
```bash
# View current settings
yarn wrangler d1 execute logosophe --command "SELECT * FROM SystemSettings WHERE Key LIKE 'log_%';"

# Check log counts
yarn wrangler d1 execute logosophe --command "SELECT COUNT(*) as total, SUM(CASE WHEN IsDeleted = 0 THEN 1 ELSE 0 END) as active, SUM(CASE WHEN IsDeleted = 1 THEN 1 ELSE 0 END) as archived FROM SystemLogs;"
```

### Manual Archive Execution
```bash
# Test the archive endpoint
curl -X POST https://your-domain.com/api/logs/archive-now \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

### View Archive Results
Check the dashboard logs page for:
- Archive job execution logs
- Updated log counts
- Any error messages or warnings

## Best Practices

1. **Start Conservative**: Begin with longer retention periods and adjust based on needs
2. **Monitor Space Usage**: Regularly check database size and adjust policies accordingly
3. **Export Before Deletion**: Always export archived logs before hard deletion
4. **Test Policies**: Use manual triggers to test retention policies before relying on automation
5. **Document Changes**: Keep records of policy changes for compliance purposes

## Troubleshooting

### Common Issues

1. **Archive Job Not Running**
   - Check cron schedule in wrangler.jsonc
   - Verify Cloudflare cron triggers are enabled
   - Check worker logs for errors

2. **Settings Not Saving**
   - Ensure user has system admin privileges
   - Check browser console for JavaScript errors
   - Verify API endpoint responses

3. **Export Fails**
   - Check if there are archived logs to export
   - Verify user permissions
   - Check browser download settings

### Support
For issues or questions about the log retention system, check:
- Worker logs in Cloudflare dashboard
- Browser developer console
- Network tab for API call failures
- Database queries for data consistency
