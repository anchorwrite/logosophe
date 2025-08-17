import { default as openNextWorker } from './.open-next/worker.js';

export default {
  // Handle fetch events (pass through to OpenNext worker)
  async fetch(request, env, ctx) {
    return openNextWorker.fetch(request, env, ctx);
  },

  // Handle scheduled events (cron triggers)
  async scheduled(event, env, ctx) {
    console.log('Cron trigger executed at:', new Date().toISOString());
    
    try {
      // Get the current retention settings from the database
      const retentionSetting = await env.DB.prepare(`
        SELECT Value FROM SystemSettings WHERE Key = 'log_retention_days'
      `).first();
      
      const archiveEnabledSetting = await env.DB.prepare(`
        SELECT Value FROM SystemSettings WHERE Key = 'log_archive_enabled'
      `).first();
      
      const retentionDays = retentionSetting ? parseInt(retentionSetting.Value) : 90; // Default to 90 days
      const archiveEnabled = archiveEnabledSetting ? archiveEnabledSetting.Value === 'true' : true;
      
      if (!archiveEnabled) {
        console.log('Log archiving is disabled');
        return;
      }
      
      // Archive expired logs
      const archiveResult = await archiveExpiredLogs(env.DB, retentionDays);
      
      // Also check if we should hard delete old archived logs
      const hardDeleteDelaySetting = await env.DB.prepare(`
        SELECT Value FROM SystemSettings WHERE Key = 'log_hard_delete_delay'
      `).first();
      
      const hardDeleteDelay = hardDeleteDelaySetting ? parseInt(hardDeleteDelaySetting.Value) : 7;
      const hardDeleteResult = await hardDeleteArchivedLogs(env.DB, hardDeleteDelay);
      
      console.log('Log archiving completed:', {
        currentTime: new Date().toISOString(),
        retentionDays,
        archiveResult,
        hardDeleteResult
      });
      
    } catch (error) {
      console.error('Error in log archive cron job:', error);
    }
  }
};

// Archive expired logs
async function archiveExpiredLogs(db, retentionDays) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  const cutoffTimestamp = cutoffDate.toISOString();

  try {
    const result = await db.prepare(`
      UPDATE SystemLogs 
      SET IsDeleted = 1 
      WHERE IsDeleted = 0 
      AND Timestamp < ?
    `).bind(cutoffTimestamp).run();

    return { archived: result.meta.changes || 0, errors: 0 };
  } catch (error) {
    console.error('Error archiving expired logs:', error);
    return { archived: 0, errors: 1 };
  }
}

// Hard delete archived logs
async function hardDeleteArchivedLogs(db, olderThanDays) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
  const cutoffTimestamp = cutoffDate.toISOString();

  try {
    const result = await db.prepare(`
      DELETE FROM SystemLogs 
      WHERE IsDeleted = 1 
      AND Timestamp < ?
    `).bind(cutoffTimestamp).run();

    return { deleted: result.meta.changes || 0, errors: 0 };
  } catch (error) {
    console.error('Error hard deleting archived logs:', error);
    return { deleted: 0, errors: 1 };
  }
}
