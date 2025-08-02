/**
 * Complete a workflow (client-side version)
 */
export async function completeWorkflowClient(
  workflowId: string,
  userEmail: string,
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/workflow/${workflowId}?tenantId=${encodeURIComponent(tenantId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'completed',
        completedBy: userEmail,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Failed to complete workflow: ${error}` };
    }

    const result = await response.json() as { success: boolean; error?: string };
    return { success: result.success, error: result.error };
  } catch (error) {
    console.error('Error completing workflow:', error);
    return { success: false, error: 'Failed to complete workflow' };
  }
}

/**
 * Terminate a workflow (client-side version)
 */
export async function terminateWorkflowClient(
  workflowId: string,
  userEmail: string,
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/workflow/${workflowId}?tenantId=${encodeURIComponent(tenantId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'terminate',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Failed to terminate workflow: ${error}` };
    }

    const result = await response.json() as { success: boolean; error?: string };
    return { success: result.success, error: result.error };
  } catch (error) {
    console.error('Error terminating workflow:', error);
    return { success: false, error: 'Failed to terminate workflow' };
  }
}

/**
 * Delete a workflow (client-side version)
 */
export async function deleteWorkflowClient(
  workflowId: string,
  userEmail: string,
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/workflow/${workflowId}?tenantId=${encodeURIComponent(tenantId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'delete',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Failed to delete workflow: ${error}` };
    }

    const result = await response.json() as { success: boolean; error?: string };
    return { success: result.success, error: result.error };
  } catch (error) {
    console.error('Error deleting workflow:', error);
    return { success: false, error: 'Failed to delete workflow' };
  }
} 