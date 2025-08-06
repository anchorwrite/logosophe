import { WorkflowDurableObject, UserNotificationsDurableObject } from './durable-objects';

// Import the OpenNext worker handler
import { handler as nextHandler } from '../.open-next/server-functions/default/handler.mjs';

// Export Durable Object classes for the worker runtime
export { WorkflowDurableObject, UserNotificationsDurableObject };

interface CloudflareEnv {
  DB: D1Database;
  MEDIA_BUCKET: R2Bucket;
  NEXT_INC_CACHE_R2_BUCKET: R2Bucket;
  WORKER_SELF_REFERENCE: Fetcher;
  WORKFLOW_DO: DurableObjectNamespace;
  USER_NOTIFICATIONS_DO: DurableObjectNamespace;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    console.log('Worker entry: Handling request for path:', path);

    // Handle Durable Object requests
    if (path.startsWith('/durable-object/')) {
      return await this.handleDurableObjectRequest(request, env);
    }

    // Handle workflow-specific routes that bypass Next.js
    if (path.startsWith('/workflow/')) {
      return await this.handleWorkflowRequest(request, env);
    }

    // Handle user notifications routes
    if (path.startsWith('/notifications/')) {
      return await this.handleNotificationsRequest(request, env);
    }

    // For all other requests, delegate to Next.js
    return await nextHandler(request, env, ctx);
  },

  async handleDurableObjectRequest(request: Request, env: CloudflareEnv): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Extract the Durable Object type and ID from the path
    // Format: /durable-object/{type}/{id}/{action}
    const pathParts = path.split('/').filter(Boolean);
    if (pathParts.length < 3) {
      return new Response('Invalid Durable Object path', { status: 400 });
    }

    const [, type, id, action] = pathParts;
    const actionPath = action ? `/${action}` : '';

    console.log('Worker entry: Durable Object request. Type:', type, 'ID:', id, 'Action:', action);

    try {
      let durableObject: DurableObjectStub;

      if (type === 'workflow') {
        const workflowDO = env.WORKFLOW_DO;
        const workflowId = workflowDO.idFromName(id);
        durableObject = workflowDO.get(workflowId);
      } else if (type === 'notifications') {
        const notificationsDO = env.USER_NOTIFICATIONS_DO;
        const notificationsId = notificationsDO.idFromName(id);
        durableObject = notificationsDO.get(notificationsId);
      } else {
        return new Response('Invalid Durable Object type', { status: 400 });
      }

      // Forward the request to the Durable Object
      const durableObjectUrl = `http://localhost${actionPath}${url.search}`;
      const durableObjectRequest = new Request(durableObjectUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body
      });

      return await durableObject.fetch(durableObjectRequest);

    } catch (error) {
      console.error('Worker entry: Error handling Durable Object request:', error);
      return new Response('Internal server error', { status: 500 });
    }
  },

  async handleWorkflowRequest(request: Request, env: CloudflareEnv): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    console.log('Worker entry: Handling workflow request for path:', path);

    try {
      // Extract workflow ID from path
      // Format: /workflow/{id} or /workflow/{id}/messages
      const pathParts = path.split('/').filter(Boolean);
      if (pathParts.length < 2) {
        return new Response('Invalid workflow path', { status: 400 });
      }

      const workflowId = pathParts[1];
      const action = pathParts[2] || '';

      // Get authorization header
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response('Unauthorized', { status: 401 });
      }

      const userEmail = authHeader.replace('Bearer ', '');

      // Get tenant ID from query params or request body
      let tenantId = url.searchParams.get('tenantId');
      if (!tenantId && request.method === 'POST') {
        try {
          const body = await request.json() as { tenantId?: string };
          tenantId = body.tenantId || null;
        } catch (error) {
          // Ignore JSON parsing errors
        }
      }

      if (!tenantId) {
        return new Response('Tenant ID is required', { status: 400 });
      }

      // Get the WorkflowDurableObject for this workflow
      const workflowDO = env.WORKFLOW_DO;
      const workflowDurableObjectId = workflowDO.idFromName(workflowId);
      const workflowStub = workflowDO.get(workflowDurableObjectId);

      // Create the request URL for the Durable Object
      let durableObjectUrl = `http://localhost`;
      
      if (action === 'messages') {
        durableObjectUrl += '/messages';
      } else if (action === 'websocket') {
        durableObjectUrl += '/websocket';
      } else if (action === 'notification') {
        durableObjectUrl += '/notification';
      } else {
        // Default to the main workflow endpoint
        durableObjectUrl += '/';
      }

      // Add query parameters
      const searchParams = new URLSearchParams();
      searchParams.set('userEmail', userEmail);
      searchParams.set('tenantId', tenantId);
      if (url.searchParams.has('status')) {
        searchParams.set('status', url.searchParams.get('status')!);
      }
      durableObjectUrl += `?${searchParams.toString()}`;

      // Forward the request to the Durable Object
      const durableObjectRequest = new Request(durableObjectUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body
      });

      return await workflowStub.fetch(durableObjectRequest);

    } catch (error) {
      console.error('Worker entry: Error handling workflow request:', error);
      return new Response('Internal server error', { status: 500 });
    }
  },

  async handleNotificationsRequest(request: Request, env: CloudflareEnv): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    console.log('Worker entry: Handling notifications request for path:', path);

    try {
      // Extract user email from path
      // Format: /notifications/{userEmail} or /notifications/{userEmail}/clear
      const pathParts = path.split('/').filter(Boolean);
      if (pathParts.length < 2) {
        return new Response('Invalid notifications path', { status: 400 });
      }

      const userEmail = pathParts[1];
      const action = pathParts[2] || '';

      // Get the UserNotificationsDurableObject for this user
      const notificationsDO = env.USER_NOTIFICATIONS_DO;
      const notificationsId = notificationsDO.idFromName(userEmail);
      const notificationsStub = notificationsDO.get(notificationsId);

      // Create the request URL for the Durable Object
      let durableObjectUrl = `http://localhost`;
      
      if (action === 'clear') {
        durableObjectUrl += '/clear';
      } else if (action === 'check') {
        durableObjectUrl += '/check';
      } else if (action === 'websocket') {
        durableObjectUrl += '/websocket';
      } else if (action === 'notification') {
        durableObjectUrl += '/notification';
      } else {
        // Default to the main notifications endpoint
        durableObjectUrl += '/';
      }

      // Add query parameters
      const searchParams = new URLSearchParams();
      searchParams.set('userEmail', userEmail);
      durableObjectUrl += `?${searchParams.toString()}`;

      // Forward the request to the Durable Object
      const durableObjectRequest = new Request(durableObjectUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body
      });

      return await notificationsStub.fetch(durableObjectRequest);

    } catch (error) {
      console.error('Worker entry: Error handling notifications request:', error);
      return new Response('Internal server error', { status: 500 });
    }
  }
}; 