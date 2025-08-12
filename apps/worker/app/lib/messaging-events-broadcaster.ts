// Store active connections per tenant with metadata
interface ConnectionInfo {
  controller: ReadableStreamDefaultController;
  userEmail: string;
  connectedAt: Date;
  lastActivity: Date;
}

// GLOBAL STATE: Use a true global that persists across module reloads
// Store connections in a global variable that survives module reloads
declare global {
  var __messagingConnections: Map<string, Set<ConnectionInfo>> | undefined;
  var __messagingCleanupInterval: NodeJS.Timeout | null | undefined;
  var __messagingInitialized: boolean | undefined;
}

// Initialize global state (only once, even across module reloads)
function initializeGlobalState() {
  if (global.__messagingInitialized) {
    console.log('Using existing global messaging state');
    return;
  }
  
  // Initialize global variables
  global.__messagingConnections = new Map<string, Set<ConnectionInfo>>();
  global.__messagingCleanupInterval = null;
  global.__messagingInitialized = true;
  
  startCleanupInterval();
  console.log('Global messaging state initialized');
  
  // Log the module path to debug multiple initializations
  console.log('Module path:', import.meta.url || 'unknown');
}

// Start cleanup interval (only once)
function startCleanupInterval() {
  if (global.__messagingCleanupInterval) return;
  
  global.__messagingCleanupInterval = setInterval(() => {
    const now = new Date();
    const totalConnections = getTotalConnectionCount();
    
    if (totalConnections > 0) {
      console.log(`Cleanup: ${totalConnections} total connections`);
      
      global.__messagingConnections!.forEach((tenantConnections, tenantId) => {
        if (tenantConnections.size > 0) {
          console.log(`  Tenant ${tenantId}: ${tenantConnections.size} connections`);
        }
      });
    }
    
    // Only log cleanup details if there are connections to check
    if (totalConnections > 0) {
      global.__messagingConnections!.forEach((tenantConnections, tenantId) => {
        tenantConnections.forEach(connection => {
          const inactiveTime = now.getTime() - connection.lastActivity.getTime();
          
          // Remove connections inactive for more than 5 minutes
          if (inactiveTime > 5 * 60 * 1000) {
            console.log(`Removing inactive connection: ${connection.userEmail} (${Math.floor(inactiveTime / 1000)}s)`);
            try {
              connection.controller.close();
              tenantConnections.delete(connection);
            } catch (error) {
              tenantConnections.delete(connection);
            }
          }
        });
        
        // Clean up empty connection sets
        if (tenantConnections.size === 0) {
          global.__messagingConnections!.delete(tenantId);
        }
      });
    }
  }, 120000); // 2 minutes
}

// Get the global connections Map
function getConnections(): Map<string, Set<ConnectionInfo>> {
  if (!global.__messagingConnections) {
    initializeGlobalState();
  }
  return global.__messagingConnections!;
}

// Initialize immediately
initializeGlobalState();

// Export the connections getter
const connections = getConnections();

// Function to broadcast events to all connections for a specific tenant
export function broadcastToTenant(tenantId: string, eventType: string, eventData: any) {
  const currentConnections = getConnections();
  const tenantConnections = currentConnections.get(tenantId);
  
  if (!tenantConnections) {
    console.log(`SSE: No connections found for tenant ${tenantId}`);
    return;
  }
  
  console.log(`SSE: Broadcasting ${eventType} to ${tenantConnections.size} connections in ${tenantId}`);

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
  let sentCount = 0;
  
  tenantConnections.forEach(connection => {
    try {
      connection.controller.enqueue(encoder.encode(message));
      // Update last activity
      connection.lastActivity = new Date();
      sentCount++;
    } catch (error) {
      console.error('Error sending to connection:', error);
      // Mark dead connections for removal
      deadConnections.push(connection);
    }
  });

  console.log(`Sent ${eventType} event to ${sentCount} connections for tenant ${tenantId}`);

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
  const currentConnections = getConnections();
  
  if (!currentConnections.has(tenantId)) {
    currentConnections.set(tenantId, new Set());
  }
  
  const tenantConnections = currentConnections.get(tenantId)!;
  
  // CONNECTION DEDUPLICATION: Remove any existing connections for this user
  const existingConnections = Array.from(tenantConnections).filter(
    conn => conn.userEmail === connectionInfo.userEmail
  );
  
  if (existingConnections.length > 0) {
    console.log(`SSE: Replacing ${existingConnections.length} existing connections for ${connectionInfo.userEmail}`);
    existingConnections.forEach(existingConn => {
      try {
        existingConn.controller.close();
        tenantConnections.delete(existingConn);
      } catch (error) {
        tenantConnections.delete(existingConn);
      }
    });
  }
  
  // Add the new connection
  tenantConnections.add(connectionInfo);
  
  console.log(`SSE: ${connectionInfo.userEmail} connected to ${tenantId} (total: ${tenantConnections.size}) at ${new Date().toISOString()}`);
}

// Function to remove a connection from the tenant's connection set
export function removeConnection(tenantId: string, controller: ReadableStreamDefaultController) {
  const tenantConnections = connections.get(tenantId);
  if (tenantConnections) {
    // Find and remove the specific connection
    let removed = false;
    tenantConnections.forEach(conn => {
      if (conn.controller === controller) {
        console.log(`SSE: Removing connection for ${conn.userEmail} from ${tenantId} at ${new Date().toISOString()}`);
        tenantConnections.delete(conn);
        removed = true;
      }
    });
    
    if (!removed) {
      console.log(`SSE: Connection removal requested but not found for tenant ${tenantId}`);
    }
    
    // Clean up empty connection sets
    if (tenantConnections.size === 0) {
      connections.delete(tenantId);
      console.log(`SSE: Removed empty connection set for tenant ${tenantId}`);
    }
  } else {
    console.log(`SSE: Remove connection requested for non-existent tenant ${tenantId}`);
  }
}

// Function to get connection count for a tenant (for monitoring)
export function getConnectionCount(tenantId: string): number {
  return getConnections().get(tenantId)?.size || 0;
}

// Function to get total connection count (for monitoring)
export function getTotalConnectionCount(): number {
  let total = 0;
  connections.forEach(tenantConnections => {
    total += tenantConnections.size;
  });
  return total;
}
