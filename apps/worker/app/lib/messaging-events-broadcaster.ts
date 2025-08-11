// Store active connections per tenant with metadata
interface ConnectionInfo {
  controller: ReadableStreamDefaultController;
  userEmail: string;
  connectedAt: Date;
  lastActivity: Date;
}

const connections = new Map<string, Set<ConnectionInfo>>();

// Cleanup interval for dead connections (every 30 seconds)
let cleanupInterval: NodeJS.Timeout | null = null;

// Initialize cleanup interval if not already running
if (!cleanupInterval) {
  cleanupInterval = setInterval(() => {
    const now = new Date();
    connections.forEach((tenantConnections, tenantId) => {
      tenantConnections.forEach(connection => {
        // Remove connections inactive for more than 5 minutes
        if (now.getTime() - connection.lastActivity.getTime() > 5 * 60 * 1000) {
          try {
            connection.controller.close();
            tenantConnections.delete(connection);
          } catch (error) {
            // Connection already closed
            tenantConnections.delete(connection);
          }
        }
      });
      
      // Clean up empty connection sets
      if (tenantConnections.size === 0) {
        connections.delete(tenantId);
      }
    });
  }, 30000);
}

// Function to broadcast events to all connections for a specific tenant
export function broadcastToTenant(tenantId: string, eventType: string, eventData: any) {
  const tenantConnections = connections.get(tenantId);
  if (!tenantConnections) return;

  const event = JSON.stringify({
    type: eventType,
    data: {
      ...eventData,
      timestamp: new Date().toISOString()
    }
  });

  const message = `data: ${event}\n\n`;
  const encoder = new TextEncoder();

  // Send to all connections for this tenant
  const deadConnections: ConnectionInfo[] = [];
  
  tenantConnections.forEach(connection => {
    try {
      connection.controller.enqueue(encoder.encode(message));
      // Update last activity
      connection.lastActivity = new Date();
    } catch (error) {
      // Mark dead connections for removal
      deadConnections.push(connection);
    }
  });

  // Remove dead connections
  deadConnections.forEach(deadConnection => {
    tenantConnections.delete(deadConnection);
  });

  // Clean up empty connection sets
  if (tenantConnections.size === 0) {
    connections.delete(tenantId);
  }
}

// Function to broadcast to multiple tenants (for admin broadcast messages)
export function broadcastToMultipleTenants(tenantIds: string[], eventType: string, eventData: any) {
  tenantIds.forEach(tenantId => {
    broadcastToTenant(tenantId, eventType, eventData);
  });
}

// Function to broadcast to all tenants (for global admin messages)
export function broadcastToAllTenants(eventType: string, eventData: any) {
  connections.forEach((_, tenantId) => {
    broadcastToTenant(tenantId, eventType, eventData);
  });
}

// Function to add a connection to the tenant's connection set
export function addConnection(tenantId: string, connectionInfo: ConnectionInfo) {
  if (!connections.has(tenantId)) {
    connections.set(tenantId, new Set());
  }
  connections.get(tenantId)!.add(connectionInfo);
}

// Function to remove a connection from the tenant's connection set
export function removeConnection(tenantId: string, controller: ReadableStreamDefaultController) {
  const tenantConnections = connections.get(tenantId);
  if (tenantConnections) {
    // Find and remove the specific connection
    tenantConnections.forEach(conn => {
      if (conn.controller === controller) {
        tenantConnections.delete(conn);
      }
    });
    
    // Clean up empty connection sets
    if (tenantConnections.size === 0) {
      connections.delete(tenantId);
    }
  }
}

// Function to get connection count for a tenant (for monitoring)
export function getConnectionCount(tenantId: string): number {
  return connections.get(tenantId)?.size || 0;
}

// Function to get total connection count (for monitoring)
export function getTotalConnectionCount(): number {
  let total = 0;
  connections.forEach(tenantConnections => {
    total += tenantConnections.size;
  });
  return total;
}
