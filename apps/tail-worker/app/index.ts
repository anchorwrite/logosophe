export default {
  async tail(events: any[]) {
    // Process each event from the producer worker
    for (const event of events) {
      const { scriptName, outcome, eventTimestamp, logs, exceptions, diagnosticsChannelEvents } = event;
      
      // Log the event details for debugging
      console.log(`Tail Worker: Processing event from ${scriptName}`);
      console.log(`Outcome: ${outcome}`);
      console.log(`Timestamp: ${new Date(eventTimestamp).toISOString()}`);
      
      // Handle different types of events
      if (logs && logs.length > 0) {
        console.log('Logs:', logs);
      }
      
      if (exceptions && exceptions.length > 0) {
        console.error('Exceptions:', exceptions);
        
        // You could send exceptions to an external service
        // await fetch('https://your-error-tracking-service.com/api/errors', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({ exceptions, scriptName, eventTimestamp })
        // });
      }
      
      if (diagnosticsChannelEvents && diagnosticsChannelEvents.length > 0) {
        console.log('Diagnostics:', diagnosticsChannelEvents);
      }
      
      // Store in database for analytics
      if (event.event?.request) {
        const request = event.event.request;
        console.log(`Request: ${request.method} ${request.url}`);
        
        // You could store request analytics in D1
        // await env.DB.prepare(`
        //   INSERT INTO request_logs (script_name, outcome, method, url, timestamp)
        //   VALUES (?, ?, ?, ?, ?)
        // `).bind(scriptName, outcome, request.method, request.url, eventTimestamp).run();
      }
    }
  }
}; 