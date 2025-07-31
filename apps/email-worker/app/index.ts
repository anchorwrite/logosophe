export default {
  async fetch(request: Request, env: any, ctx: any) {
    if (request.method === 'POST') {
      try {
        const body = await request.json()
        
        // Handle email sending logic here
        // This would integrate with your existing email system
        
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }
    
    return new Response('Email Worker - Logosophe', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    })
  }
} 