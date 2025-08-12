// This file is no longer used - messaging SSE now uses polling-based approach like workflow SSE
// Connection management has been replaced with simple database polling in the SSE endpoint

export function broadcastToTenant(tenantId: string, eventType: string, eventData: any) {
  // This function is no longer used - events are now sent directly from the SSE endpoint
  console.log(`SSE: ${eventType} event for tenant ${tenantId} - now handled by polling endpoint`);
}

export function addConnection(tenantId: string, connectionInfo: any) {
  // This function is no longer used - connections are now self-contained in each SSE stream
  console.log(`SSE: Connection management no longer needed - using polling approach`);
}

export function removeConnection(tenantId: string, controller: any) {
  // This function is no longer used - connections are now self-contained in each SSE stream
  console.log(`SSE: Connection management no longer needed - using polling approach`);
}

export function getConnectionCount(tenantId: string): number {
  // This function is no longer used - connections are now self-contained in each SSE stream
  return 0;
}
