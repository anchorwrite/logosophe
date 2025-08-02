// Script to check the current state of TestSessions table
// Run with: yarn wrangler d1 execute DB --local --file=scripts/check-test-sessions.js

export default {
  async fetch(request, env) {
    try {
      console.log('Checking TestSessions table...');
      
      // Get all sessions (active and inactive)
      const allSessionsResult = await env.DB.prepare(`
        SELECT Id, SessionToken, TestUserEmail, CreatedBy, CreatedAt, LastAccessed, IsActive
        FROM TestSessions 
        ORDER BY CreatedAt DESC
      `).all();
      
      console.log('All sessions in TestSessions table:');
      console.log('Total sessions:', allSessionsResult.results.length);
      
      allSessionsResult.results.forEach((session, index) => {
        console.log(`${index + 1}. ID: ${session.Id}, Email: ${session.TestUserEmail}, Active: ${session.IsActive}, Created: ${session.CreatedAt}`);
      });
      
      // Get only active sessions
      const activeSessionsResult = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM TestSessions WHERE IsActive = 1
      `).first();
      
      console.log('\nActive sessions count:', activeSessionsResult.count);
      
      // Get only inactive sessions
      const inactiveSessionsResult = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM TestSessions WHERE IsActive = 0
      `).first();
      
      console.log('Inactive sessions count:', inactiveSessionsResult.count);
      
      return new Response(JSON.stringify({
        totalSessions: allSessionsResult.results.length,
        activeSessions: activeSessionsResult.count,
        inactiveSessions: inactiveSessionsResult.count,
        sessions: allSessionsResult.results
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('Error checking TestSessions:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}; 