const { D1Database } = require('@cloudflare/workers-types');

async function resetRateLimit() {
  // This would need to be run in the context of your application
  // For now, let's create a simple API endpoint to reset rate limits
  
  console.log('Rate limit reset script');
  console.log('This script would reset rate limits for a user');
  console.log('You can also manually delete the rate limit record from the database');
}

resetRateLimit().catch(console.error); 