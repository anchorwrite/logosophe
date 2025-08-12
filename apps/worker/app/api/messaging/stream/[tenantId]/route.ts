import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  
  try {
    // Get user session
    const session = await auth();
    if (!session?.user?.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    const userEmail = session.user.email;

    // Get database context
    const { env } = await getCloudflareContext({async: true});
    const db = env.DB;

    // Verify user has access to this tenant
    const userTenantQuery = `
      SELECT ur.TenantId, ur.RoleId, t.Name as TenantName
      FROM UserRoles ur
      LEFT JOIN Tenants t ON ur.TenantId = t.Id
      WHERE ur.Email = ? AND ur.TenantId = ?
    `;

    const userTenantResult = await db.prepare(userTenantQuery)
      .bind(userEmail, tenantId)
      .first() as any;

    if (!userTenantResult?.TenantId) {
      return new Response('Access denied to this tenant', { status: 403 });
    }

    // Get messaging polling interval from system settings (default 10 seconds)
    const pollingIntervalSetting = await db.prepare(`
      SELECT Value FROM SystemSettings 
      WHERE Key = 'messaging_ssePollingIntervalMs'
    `).first() as { Value: string } | null;
    
    const pollingInterval = pollingIntervalSetting 
      ? parseInt(pollingIntervalSetting.Value) 
      : 30000; // Default to 30 seconds to reduce re-renders

    // Create SSE stream
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection message
        const initialMessage = `data: ${JSON.stringify({
          type: 'connection:established',
          data: {
            tenantId,
            userEmail,
            timestamp: new Date().toISOString()
          }
        })}\n\n`;
        
        controller.enqueue(new TextEncoder().encode(initialMessage));

        // Set up polling for new messages
        let lastMessageId: number | null = null;
        let lastMessageTime: string | null = null;
        let lastUnreadCount: number | null = null;
        
        // Initialize with current latest message to establish baseline
        const initializeBaseline = async () => {
          const baselineQuery = `
            SELECT Id, CreatedAt FROM Messages 
            WHERE TenantId = ? AND IsDeleted = FALSE
            ORDER BY CreatedAt DESC, Id DESC
            LIMIT 1
          `;
          
          const baselineMessage = await db.prepare(baselineQuery)
            .bind(tenantId)
            .first() as { Id: number; CreatedAt: string } | null;
          
          if (baselineMessage) {
            lastMessageId = baselineMessage.Id;
            lastMessageTime = baselineMessage.CreatedAt;
            console.log(`SSE baseline initialized for tenant ${tenantId}: messageId=${lastMessageId}, time=${lastMessageTime}`);
          } else {
            console.log(`SSE baseline initialized for tenant ${tenantId}: no existing messages`);
          }
        };
        
        // Initialize baseline immediately and wait for it to complete
        initializeBaseline().then(() => {
          console.log(`SSE baseline initialization completed for tenant ${tenantId}`);
        }).catch(error => {
          console.error(`SSE baseline initialization failed for tenant ${tenantId}:`, error);
        });
    
        const pollInterval = setInterval(async () => {
          try {
            // Get the latest message ID to check for new messages
            const latestMessageQuery = `
              SELECT Id, CreatedAt FROM Messages 
              WHERE TenantId = ? AND IsDeleted = FALSE
              ORDER BY CreatedAt DESC, Id DESC
              LIMIT 1
            `;
            
            const latestMessage = await db.prepare(latestMessageQuery)
              .bind(tenantId)
              .first() as { Id: number; CreatedAt: string } | null;

            if (latestMessage && (latestMessage.Id !== lastMessageId || latestMessage.CreatedAt !== lastMessageTime)) {
              console.log(`SSE polling detected new message for tenant ${tenantId}: latestId=${latestMessage.Id}, lastId=${lastMessageId}, latestTime=${latestMessage.CreatedAt}, lastTime=${lastMessageTime}`);
              
              // Get new messages since last check
              let newMessagesQuery = `
                SELECT m.*, 
                       GROUP_CONCAT(mr.RecipientEmail) as Recipients,
                       GROUP_CONCAT(mr.IsRead) as ReadStatuses,
                       GROUP_CONCAT(ml.Url) as LinkUrls,
                       GROUP_CONCAT(ml.Title) as LinkTitles
                FROM Messages m
                LEFT JOIN MessageRecipients mr ON m.Id = mr.MessageId AND mr.IsDeleted = FALSE
                LEFT JOIN MessageLinks ml ON m.Id = ml.MessageId
                WHERE m.TenantId = ? AND m.IsDeleted = FALSE
              `;

              let queryParams = [tenantId];

              if (lastMessageId && lastMessageTime) {
                // Use both time and ID to ensure we don't miss messages or get duplicates
                newMessagesQuery += ` AND (m.CreatedAt > ? OR (m.CreatedAt = ? AND m.Id > ?))`;
                queryParams.push(lastMessageTime, lastMessageTime, lastMessageId.toString());
              }

              newMessagesQuery += ` GROUP BY m.Id ORDER BY m.CreatedAt ASC, m.Id ASC`;

              const newMessages = await db.prepare(newMessagesQuery)
                .bind(...queryParams)
                .all() as any;

              if (newMessages.results && newMessages.results.length > 0) {
                console.log(`SSE sending ${newMessages.results.length} new messages for tenant ${tenantId}`);
                
                for (const message of newMessages.results) {
                  // Parse recipients and read statuses
                  const recipients = message.Recipients ? message.Recipients.split(',') : [];
                  const readStatuses = message.ReadStatuses ? message.ReadStatuses.split(',').map((s: string) => s === '1') : [];
                  
                  // Parse links
                  const linkUrls = message.LinkUrls ? message.LinkUrls.split(',') : [];
                  const linkTitles = message.LinkTitles ? message.LinkTitles.split(',') : [];
                  const links = linkUrls.map((url: string, index: number) => ({
                    url,
                    title: linkTitles[index] || url
                  }));

                  const sseMessage = `data: ${JSON.stringify({
                    type: 'message:new',
                    data: {
                      messageId: message.Id,
                      tenantId: message.TenantId,
                      senderEmail: message.SenderEmail,
                      recipients,
                      subject: message.Subject,
                      body: message.Body,
                      hasAttachments: message.HasAttachments,
                      attachmentCount: message.AttachmentCount,
                      links,
                      timestamp: message.CreatedAt
                    }
                  })}\n\n`;
                  
                  controller.enqueue(new TextEncoder().encode(sseMessage));
                }
                
                lastMessageId = latestMessage.Id;
                lastMessageTime = latestMessage.CreatedAt;
                console.log(`SSE updated baseline for tenant ${tenantId}: newLastId=${lastMessageId}, newLastTime=${lastMessageTime}`);
              } else {
                console.log(`SSE no new messages found for tenant ${tenantId} despite change detection`);
              }
            } else {
              console.log(`SSE polling no change detected for tenant ${tenantId}: latestId=${latestMessage?.Id}, lastId=${lastMessageId}`);
            }

            // Check for unread count changes
            const unreadCountQuery = `
              SELECT COUNT(DISTINCT m.Id) as unreadCount 
              FROM Messages m 
              LEFT JOIN MessageRecipients mr ON m.Id = mr.MessageId AND mr.IsDeleted = FALSE
              LEFT JOIN TenantUsers tu_sender ON m.SenderEmail = tu_sender.Email 
              LEFT JOIN TenantUsers tu_recipient ON mr.RecipientEmail = tu_recipient.Email 
              WHERE mr.RecipientEmail = ? 
                AND mr.IsRead = FALSE 
                AND (tu_sender.TenantId = ? OR tu_recipient.TenantId = ?) 
                AND m.IsDeleted = FALSE 
                AND m.MessageType = 'subscriber'
            `;
            
            const unreadResult = await db.prepare(unreadCountQuery)
              .bind(userEmail, tenantId, tenantId)
              .first() as { unreadCount: number } | null;

            if (unreadResult && unreadResult.unreadCount !== lastUnreadCount) {
              const unreadMessage = `data: ${JSON.stringify({
                type: 'unread:update',
                data: {
                  count: unreadResult.unreadCount,
                  timestamp: new Date().toISOString()
                }
              })}\n\n`;
              
              controller.enqueue(new TextEncoder().encode(unreadMessage));
              lastUnreadCount = unreadResult.unreadCount;
            }

          } catch (error) {
            console.error('SSE polling error:', error);
            const errorMessage = `data: ${JSON.stringify({
              type: 'error',
              error: 'Failed to poll for updates',
              timestamp: new Date().toISOString()
            })}\n\n`;
            
            controller.enqueue(new TextEncoder().encode(errorMessage));
          }
        }, pollingInterval); // Use configurable polling interval

        // Clean up on close
        request.signal.addEventListener('abort', () => {
          clearInterval(pollInterval);
          controller.close();
        });
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    });

  } catch (error) {
    console.error('SSE connection error:', error);
    
    // Log specific error details for debugging
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        tenantId: (await params).tenantId
      });
    }
    
    return new Response('Internal Server Error', { status: 500 });
  }
}


