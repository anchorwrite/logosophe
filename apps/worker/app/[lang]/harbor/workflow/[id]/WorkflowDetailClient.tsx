"use client";

import { useEffect, useState, useRef } from 'react';
import { Box, Flex, Heading, Text, Card, Button, Badge, TextArea, Table, Dialog } from "@radix-ui/themes";
import Link from "next/link";
import { useTranslation } from 'react-i18next';
import type { Locale } from '@/types/i18n';
import { completeWorkflowClient, terminateWorkflowClient, deleteWorkflowClient } from '@/lib/workflow-client';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { useToast } from '@/components/Toast';
import MediaFileSelector from '@/components/MediaFileSelector';
import WorkflowInvitations from '@/components/WorkflowInvitations';

import { Eye, Download, Paperclip } from 'lucide-react';

interface WorkflowMessage {
  Id: string;
  WorkflowId: string;
  SenderEmail: string;
  MessageType: string;
  Content: string;
  MediaFileId?: number;
  ShareToken?: string;
  CreatedAt: string;
}

interface SharedMediaFile {
  Id: number;
  FileName: string;
  FileSize: number;
  ContentType: string;
  MediaType: 'audio' | 'video' | 'image' | 'document';
  UploadDate: string;
  Description?: string;
  Duration?: number;
  Width?: number;
  Height?: number;
  TenantId: string;
  TenantName: string;
  R2Key: string;
  UploadedBy: string;
}

interface Workflow {
  Id: string;
  TenantId: string;
  InitiatorEmail: string;
  Title: string;
  Status: string;
  CreatedAt: string;
  UpdatedAt: string;
  CompletedAt?: string;
  CompletedBy?: string;
}

interface WorkflowResponse {
  success: boolean;
  workflow?: Workflow;
  participants?: any[];
  messages?: WorkflowMessage[];
  error?: string;
}

interface SendMessageRequest {
  workflowId: string;
  content: string;
  senderEmail: string;
  messageType: string;
  mediaFileIds?: number[];
}

interface SendMessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface WorkflowDetailClientProps {
  workflowId: string;
  userEmail: string;
  userTenantId: string;
  lang: Locale;
  dict: any;
}

export function WorkflowDetailClient({ workflowId, userEmail, userTenantId, lang, dict }: WorkflowDetailClientProps) {
  const { t, i18n } = useTranslation('translations');
  
  // Ensure the language is set correctly
  useEffect(() => {
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
  }, [lang, i18n]);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [messages, setMessages] = useState<WorkflowMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sseConnected, setSseConnected] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isTerminating, setIsTerminating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sharedMediaFiles, setSharedMediaFiles] = useState<SharedMediaFile[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { showToast } = useToast();

  // Debug: Log message state changes
  useEffect(() => {
    console.log('Messages state updated:', messages.length, 'messages');
    const messageIds = messages.map(m => m.Id);
    const uniqueIds = new Set(messageIds);
    if (messageIds.length !== uniqueIds.size) {
      console.warn('Duplicate message IDs detected:', messageIds.filter((id, index) => messageIds.indexOf(id) !== index));
    }
  }, [messages]);
  
  // Confirmation dialog states
  const [terminateDialog, setTerminateDialog] = useState<{
    isOpen: boolean;
  }>({ isOpen: false });
  
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
  }>({ isOpen: false });

  // Media file attachment state
  const [selectedMediaFiles, setSelectedMediaFiles] = useState<number[]>([]);
  const [showMediaSelector, setShowMediaSelector] = useState(false);

  // Fetch workflow from API
  useEffect(() => {
    const fetchWorkflow = async () => {
      try {
        const response = await fetch(`/api/workflow/${workflowId}`);
        const result: WorkflowResponse = await response.json();

        if (result.success && result.workflow) {
          setWorkflow(result.workflow);
          setParticipants(result.participants || []);
          setMessages(result.messages || []);
        } else {
          showToast({
            type: 'error',
            title: t('common.error'),
            content: result.error || t('workflow.errors.fetchFailed')
          });
          setWorkflow(null);
        }
      } catch (error) {
        console.error('Error fetching workflow:', error);
        showToast({
          type: 'error',
          title: t('common.error'),
          content: t('workflow.errors.fetchFailed')
        });
        setWorkflow(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkflow();
  }, [workflowId]);

  // Fetch shared media files for this workflow
  useEffect(() => {
    const fetchSharedMediaFiles = async () => {
      if (!workflow) return;
      
      setIsLoadingMedia(true);
      try {
        // Get media file IDs from workflow messages
        const mediaFileIds = messages
          .filter(msg => msg.MediaFileId)
          .map(msg => msg.MediaFileId!)
          .filter((id, index, arr) => arr.indexOf(id) === index); // Remove duplicates

        if (mediaFileIds.length === 0) {
          setSharedMediaFiles([]);
          return;
        }

        // Fetch specific media files by their IDs
        const sharedFiles: SharedMediaFile[] = [];
        
        for (const mediaFileId of mediaFileIds) {
          try {
            const response = await fetch(`/api/media/${mediaFileId}`);
            if (response.ok) {
              const file = await response.json() as SharedMediaFile;
              sharedFiles.push(file);
            }
          } catch (error) {
            console.error(`Failed to fetch media file ${mediaFileId}:`, error);
          }
        }
        
        setSharedMediaFiles(sharedFiles);
      } catch (error) {
        console.error('Error fetching shared media files:', error);
        setSharedMediaFiles([]);
      } finally {
        setIsLoadingMedia(false);
      }
    };

    fetchSharedMediaFiles();
  }, [workflow, messages]);

  // Cleanup WebSocket connection on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        console.log('Component unmounting, closing EventSource connection');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // Close WebSocket connection when workflow becomes non-active
  useEffect(() => {
    if (workflow && workflow.Status !== 'active' && eventSourceRef.current) {
      console.log('Workflow is no longer active, closing EventSource connection. Status:', workflow.Status);
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, [workflow?.Status]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!workflow || !userEmail || !userTenantId) {
      return;
    }

    // Only connect to WebSocket for active workflows
    if (workflow.Status !== 'active') {
      console.log('Workflow is not active, skipping EventSource connection. Status:', workflow.Status);
      return;
    }

    // Check if workflow exists and is valid
    if (!workflow.Id || workflow.Id === 'undefined' || workflow.Id === 'null') {
      console.log('Invalid workflow ID, skipping EventSource connection:', workflow.Id);
      return;
    }

    // Check if workflow data is properly loaded
    if (isLoading) {
      console.log('Workflow data not ready, skipping EventSource connection. Loading:', isLoading);
      return;
    }

    const connectEventSource = async () => {
      // Close existing connection if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      try {
        // Connect directly to the SSE stream endpoint
        const sseUrl = `/api/workflow/${workflow.Id}/stream`;
        
        console.log('Connecting to EventSource:', sseUrl);
        
        const eventSource = new EventSource(sseUrl);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          console.log('EventSource connected successfully');
          setSseConnected(true);
        };
        
        eventSource.onmessage = (event) => {
          console.log('EventSource message received:', event.data);
          try {
            const data = JSON.parse(event.data);
            console.log('Parsed EventSource message:', data);
            
            if (data.type === 'message' && data.data) {
              console.log('Adding new message to state:', data.data);
              setMessages(prev => {
                // Check if message already exists to prevent duplicates
                const messageExists = prev.some(msg => msg.Id === data.data.Id);
                if (messageExists) {
                  console.log('Message already exists, skipping:', data.data.Id);
                  return prev;
                }
                
                // Add new message and sort by creation time
                const newMessages = [...prev, data.data];
                return newMessages.sort((a, b) => 
                  new Date(a.CreatedAt).getTime() - new Date(b.CreatedAt).getTime()
                );
              });
            } else if (data.type === 'participant_joined') {
              console.log('Participant joined:', data.data);
            } else if (data.type === 'participant_left') {
              console.log('Participant left:', data.data);
            } else if (data.type === 'status_update') {
              console.log('Status update:', data.data);
              // Update the workflow status in the UI
              setWorkflow(prev => {
                if (!prev) return prev;
                return {
                  ...prev,
                  Status: data.data.status,
                  UpdatedAt: data.data.updatedAt,
                  ...(data.data.status === 'completed' && {
                    CompletedAt: data.data.updatedAt,
                    CompletedBy: data.data.completedBy
                  }),
                  ...(data.data.status === 'terminated' && {
                    TerminatedAt: data.data.updatedAt,
                    TerminatedBy: data.data.terminatedBy
                  })
                };
              });
            } else {
              console.log('Unknown message type:', data.type);
            }
          } catch (error) {
            console.error('Error parsing EventSource message:', error);
          }
        };

        eventSource.onerror = (error) => {
          console.error('EventSource error:', error);
          setSseConnected(false);
        };
      } catch (error) {
        console.error('Error creating EventSource:', error);
        setSseConnected(false);
        
        // Retry on error
        reconnectTimeoutRef.current = setTimeout(async () => {
          await connectEventSource();
        }, 2000);
      }
    };

    // Connect when we have all required data and no existing connection
    if (!eventSourceRef.current && workflow && userEmail && userTenantId) {
      console.log('Establishing EventSource connection with data:', { workflowId: workflow.Id, userEmail, userTenantId });
      connectEventSource();
    }

    // Add page unload event listener to close WebSocket
    const handleBeforeUnload = () => {
      console.log('Page unloading, closing EventSource connection');
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup function
    return () => {
      console.log('Cleaning up EventSource connection');
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [workflow, userEmail, userTenantId]); // Include workflow in dependencies so connection is established when workflow data is available



  const handleSendMessage = async () => {
    if (!newMessage.trim() || !workflow) return;

    setIsSending(true);
    try {
      const requestData: SendMessageRequest = {
        workflowId: workflow.Id,
        senderEmail: userEmail,
        content: newMessage,
        messageType: 'response' as const,
        mediaFileIds: selectedMediaFiles.length > 0 ? selectedMediaFiles : undefined
      };

      const response = await fetch(`/api/harbor/workflow/messages?tenantId=${workflow.TenantId}&workflowId=${workflow.Id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const result: SendMessageResponse = await response.json();

      if (result.success) {
        setNewMessage('');
        setSelectedMediaFiles([]); // Clear selected media files after successful send
      } else {
        showToast({
          type: 'error',
          title: t('common.error'),
          content: result.error || t('workflow.errors.sendMessageFailed')
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      showToast({
        type: 'error',
        title: t('common.error'),
        content: t('workflow.errors.sendMessageFailed')
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleCompleteWorkflow = async () => {
    if (!workflow || workflow.Status === 'completed') return;

    setIsCompleting(true);
    
    try {
      const result = await completeWorkflowClient(workflow.Id, userEmail, userTenantId);
      
      if (result.success) {
        // Update the workflow status locally
        setWorkflow(prev => prev ? {
          ...prev,
          Status: 'completed',
          CompletedAt: new Date().toISOString(),
          CompletedBy: userEmail,
          UpdatedAt: new Date().toISOString()
        } : null);
        
        showToast({
          type: 'success',
          title: t('common.success'),
          content: t('workflow.messages.completedSuccessfully')
        });
      } else {
        showToast({
          type: 'error',
          title: t('common.error'),
          content: result.error || t('workflow.errors.completeFailed')
        });
      }
    } catch (error) {
      console.error('Error completing workflow:', error);
      showToast({
        type: 'error',
        title: t('common.error'),
        content: t('workflow.errors.completeFailed')
      });
    } finally {
      setIsCompleting(false);
    }
  };

  const handleTerminateWorkflow = async () => {
    if (!workflow || workflow.Status !== 'active') return;

    setIsTerminating(true);
    
    try {
      const result = await terminateWorkflowClient(workflow.Id, userEmail, userTenantId);
      
      if (result.success) {
        // Update the workflow status locally
        setWorkflow(prev => prev ? {
          ...prev,
          Status: 'terminated',
          UpdatedAt: new Date().toISOString()
        } : null);
        
        showToast({
          type: 'success',
          title: t('common.success'),
          content: t('workflow.messages.terminatedSuccessfully')
        });
      } else {
        showToast({
          type: 'error',
          title: t('common.error'),
          content: result.error || t('workflow.errors.terminateFailed')
        });
      }
    } catch (error) {
      console.error('Error terminating workflow:', error);
      showToast({
        type: 'error',
        title: t('common.error'),
        content: t('workflow.errors.terminateFailed')
      });
    } finally {
      setIsTerminating(false);
    }
  };

  const handleDeleteWorkflow = async () => {
    if (!workflow) return;

    setIsDeleting(true);
    
    try {
      const result = await deleteWorkflowClient(workflow.Id, userEmail, userTenantId);
      
      if (result.success) {
        showToast({
          type: 'success',
          title: t('common.success'),
          content: t('workflow.messages.deletedSuccessfully')
        });
        // Redirect to active workflows page after a short delay
        setTimeout(() => {
          window.location.href = `/${lang}/harbor/workflow/active`;
        }, 1500);
      } else {
        showToast({
          type: 'error',
          title: t('common.error'),
          content: result.error || t('workflow.errors.deleteFailed')
        });
      }
    } catch (error) {
      console.error('Error deleting workflow:', error);
      showToast({
        type: 'error',
        title: t('common.error'),
        content: t('workflow.errors.deleteFailed')
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'green';
      case 'completed':
        return 'blue';
      case 'paused':
        return 'orange';
      default:
        return 'gray';
    }
  };

  // Simple function to translate workflow messages
  const translateMessage = (message: WorkflowMessage) => {
    const { Content, MessageType } = message;

    // Handle workflow initiation message
    if (MessageType === 'request' && Content.includes('Workflow "') && Content.includes('" initiated')) {
      const titleMatch = Content.match(/Workflow "([^"]+)" initiated/);
      if (titleMatch) {
        const title = titleMatch[1];
        let translatedMessage = (dict as any).workflow.history.detail.messageTranslations.workflowInitiated.replace('{{title}}', title);

        // Check if there's a description
        if (Content.includes(': ')) {
          const parts = Content.split(': ');
          if (parts.length > 1) {
            const description = parts[1];
            const descriptionOnly = description.replace(/\n\nShared \d+ media file\(s\)/, '');
            if (descriptionOnly.trim()) {
              translatedMessage += ': ' + descriptionOnly.trim();
            }
          }
        }

        // Check if there are shared media files
        const sharedMatch = Content.match(/Shared (\d+) media file\(s\)/);
        if (sharedMatch) {
          const count = parseInt(sharedMatch[1]);
          translatedMessage += '\n\n' + (dict as any).workflow.history.detail.messageTranslations.sharedMediaFiles.replace('{{count}}', count.toString());
        }

        return translatedMessage;
      }
    }

    // Handle media attachment messages
    if (MessageType === 'share_link' && Content.startsWith('📎 Attached:')) {
      const attachedMatch = Content.match(/📎 Attached: (.+?) \((\d+\.\d+) MB\)/);
      if (attachedMatch) {
        const filename = attachedMatch[1];
        const size = attachedMatch[2];
        return (dict as any).workflow.history.detail.messageTranslations.attachedFile.replace('{{filename}}', filename).replace('{{size}}', size.toString());
      }

      const attachedNoSizeMatch = Content.match(/📎 Attached: (.+)/);
      if (attachedNoSizeMatch) {
        const filename = attachedNoSizeMatch[1];
        return (dict as any).workflow.history.detail.messageTranslations.attachedFileNoSize.replace('{{filename}}', filename);
      }
    }

    // For other messages, return the original content
    return Content;
  };

  if (isLoading) {
    return (
      <Box p="6" style={{ textAlign: 'center' }}>
        <Text size="5" color="gray">{(dict as any).workflow.history.detail.loading}</Text>
      </Box>
    );
  }

  if (!workflow) {
    return (
      <Card>
        <Box p="6" style={{ textAlign: 'center' }}>
          <Heading size="4" mb="3">{(dict as any).workflow.history.detail.notFound}</Heading>
          <Text color="gray" mb="4">
            {t('workflow.errors.notFound')}
          </Text>
          <Button asChild>
            <Link href={`/${lang}/harbor/workflow/active`}>
              {(dict as any).workflow.history.detail.backToActive}
            </Link>
          </Button>
        </Box>
      </Card>
    );
  }

  return (
    <>
      <Flex gap="6" direction="column">
        {/* Workflow Info */}
        <Box>
          <Card>
            <Box p="4">
              <Flex justify="between" align="center" mb="3">
                <Heading size="4">{workflow.Title}</Heading>
                <Flex gap="2">
                  {workflow.Status === 'active' && (
                    <>
                      <Button 
                        color="green" 
                        onClick={handleCompleteWorkflow}
                        disabled={isCompleting}
                      >
                        {isCompleting ? (dict as any).workflow.history.detail.completing : (dict as any).workflow.history.detail.completeWorkflow}
                      </Button>
                      <Button 
                        color="orange" 
                        variant="soft"
                        onClick={() => setTerminateDialog({ isOpen: true })}
                        disabled={isTerminating}
                      >
                        {isTerminating ? (dict as any).workflow.history.detail.terminating : (dict as any).workflow.history.detail.terminateWorkflow}
                      </Button>
                    </>
                  )}
                  {(workflow.Status === 'completed' || workflow.Status === 'terminated') && (
                    <Button 
                      color="red" 
                      variant="soft"
                      onClick={() => setDeleteDialog({ isOpen: true })}
                      disabled={isDeleting}
                    >
                      {isDeleting ? (dict as any).workflow.history.detail.deleting : (dict as any).workflow.history.detail.deleteWorkflow}
                    </Button>
                  )}
                </Flex>
              </Flex>
              <Flex direction="column" gap="3">
                <Box>
                  <Text weight="bold">{(dict as any).workflow.history.detail.status}</Text>
                  <Badge color={getStatusColor(workflow.Status)}>
                    {t(`workflow.status.${workflow.Status}`)}
                  </Badge>
                </Box>
                <Box>
                  <Text weight="bold">{(dict as any).workflow.history.detail.initiator}</Text>
                  <Text>{workflow.InitiatorEmail}</Text>
                </Box>
                <Box>
                  <Text weight="bold">{(dict as any).workflow.history.detail.created}</Text>
                  <Text>{new Date(workflow.CreatedAt).toLocaleDateString()}</Text>
                </Box>
                {workflow.UpdatedAt && (
                  <Box>
                    <Text weight="bold">{(dict as any).workflow.history.detail.updated}</Text>
                    <Text>{new Date(workflow.UpdatedAt).toLocaleDateString()}</Text>
                  </Box>
                )}
                {workflow.CompletedAt && (
                  <Box>
                    <Text weight="bold">{(dict as any).workflow.history.detail.completed}</Text>
                    <Text>{new Date(workflow.CompletedAt).toLocaleDateString()}</Text>
                  </Box>
                )}
                {workflow.CompletedBy && (
                  <Box>
                    <Text weight="bold">{(dict as any).workflow.history.detail.completedBy}</Text>
                    <Text>{workflow.CompletedBy}</Text>
                  </Box>
                )}
                <Box>
                                  <Text weight="bold">{(dict as any).workflow.history.detail.participants}</Text>
                <Text>{participants.length} {(dict as any).workflow.history.detail.members}</Text>
                  {participants.length > 0 && (
                    <Box mt="2">
                      {participants.map((participant, index) => (
                        <Text key={index} size="2" color="gray" style={{ display: 'block' }}>
                          {participant.ParticipantEmail} ({participant.Role})
                        </Text>
                      ))}
                    </Box>
                  )}
                </Box>
              </Flex>
            </Box>
          </Card>
        </Box>

        {/* File(s) Shared */}
        <Box>
          <Card>
            <Box p="4">
              <Flex justify="between" align="center" mb="3">
                <Heading size="4">{(dict as any).workflow.history.detail.filesShared}</Heading>
                <Badge color="blue" size="1">
                                      {sharedMediaFiles.length} {(dict as any).workflow.history.detail.file}(s)
                </Badge>
              </Flex>
              
              {isLoadingMedia ? (
                <Box p="4" style={{ textAlign: 'center' }}>
                  <Text color="gray">{(dict as any).workflow.history.detail.loadingSharedFiles}</Text>
                </Box>
              ) : sharedMediaFiles.length === 0 ? (
                <Box p="4" style={{ textAlign: 'center' }}>
                  <Text color="gray">{(dict as any).workflow.history.detail.noFilesShared}</Text>
                </Box>
              ) : (
                <Table.Root>
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell style={{ width: '50px' }}></Table.ColumnHeaderCell>
                                          <Table.ColumnHeaderCell>{(dict as any).workflow.history.detail.table.name}</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>{(dict as any).workflow.history.detail.table.type}</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>{(dict as any).workflow.history.detail.table.size}</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>{(dict as any).workflow.history.detail.table.uploaded}</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>{(dict as any).workflow.history.detail.table.uploadedBy}</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>{(dict as any).workflow.history.detail.table.actions}</Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {sharedMediaFiles.map((file) => (
                      <Table.Row key={`${file.TenantId}-${file.Id}`}>
                        <Table.Cell>
                          <Box style={{ width: '40px', height: '40px', backgroundColor: 'var(--gray-3)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Text size="1" color="gray">
                              {file.MediaType === 'audio' ? '🎵' : 
                               file.MediaType === 'video' ? '🎬' : 
                               file.MediaType === 'image' ? '🖼️' : '📄'}
                            </Text>
                          </Box>
                        </Table.Cell>
                        <Table.Cell>
                          <Text weight="medium">{file.FileName}</Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="2" color="gray">{file.ContentType}</Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="2" color="gray">
                            {(file.FileSize / 1024 / 1024).toFixed(2)} MB
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="2" color="gray">
                            {new Date(file.UploadDate).toLocaleDateString()}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="2" color="gray">{file.UploadedBy}</Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Flex gap="2" justify="end">
                            <Button
                              variant="soft"
                              size="1"
                              onClick={() => window.open(`/api/media/${file.Id}/preview`, '_blank')}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="soft"
                              size="1"
                              onClick={() => window.open(`/api/media/${file.Id}/download`, '_blank')}
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          </Flex>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              )}
            </Box>
          </Card>
        </Box>

        {/* Workflow Invitations */}
        <Box>
          <WorkflowInvitations 
            workflowId={workflowId}
            workflowTitle={workflow.Title}
            currentUserEmail={userEmail}
            workflowTenantId={workflow.TenantId}
            existingParticipants={participants.map(p => ({ email: p.ParticipantEmail, role: p.Role }))}
          />
        </Box>

        {/* Messages */}
        <Box>
          <Card>
            <Box p="4">
              <Flex justify="between" align="center" mb="3">
                <Heading size="4">{(dict as any).workflow.history.detail.messages}</Heading>
                <Badge color={sseConnected ? 'green' : 'red'} size="1">
                                      {sseConnected ? (dict as any).workflow.history.detail.live : (dict as any).workflow.history.detail.offline}
                </Badge>
              </Flex>
              
              {messages.length === 0 ? (
                <Box p="4" style={{ textAlign: 'center' }}>
                  <Text color="gray">{(dict as any).workflow.history.detail.noMessages}</Text>
                </Box>
              ) : (
                <Flex direction="column" gap="3" mb="4">
                  {messages.map((message) => (
                    <Box key={`${message.Id}-${message.CreatedAt}`} p="3" style={{ border: '1px solid var(--gray-6)', borderRadius: '4px' }}>
                      <Flex justify="between" align="center" mb="2">
                        <Text weight="bold">{message.SenderEmail}</Text>
                        <Text size="2" color="gray">{new Date(message.CreatedAt).toLocaleString()}</Text>
                      </Flex>
                      <Text>{translateMessage(message)}</Text>
                    </Box>
                  ))}
                </Flex>
              )}

              {/* Send Message */}
              {workflow.Status === 'active' && (
                <Box>
                  <TextArea
                    placeholder={(dict as any).workflow.history.detail.messagePlaceholder}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    rows={3}
                    mb="3"
                  />
                  
                  {/* Media File Attachment */}
                  <Flex gap="2" align="center" mb="3">
                    <Button
                      variant="soft"
                      size="2"
                      onClick={() => setShowMediaSelector(true)}
                    >
                      <Paperclip className="h-4 w-4 mr-2" />
                      {(dict as any).workflow.history.detail.attachFiles} ({selectedMediaFiles.length})
                    </Button>
                    {selectedMediaFiles.length > 0 && (
                      <Text size="2" color="gray">
                        {selectedMediaFiles.length} {(dict as any).workflow.history.detail.file}(s) {(dict as any).workflow.history.detail.selected}
                      </Text>
                    )}
                  </Flex>
                  
                  <Button 
                    onClick={handleSendMessage}
                    disabled={isSending || (!newMessage.trim() && selectedMediaFiles.length === 0)}
                    size="3"
                  >
                    {isSending ? (dict as any).workflow.history.detail.sending : (dict as any).workflow.history.detail.sendMessage}
                  </Button>
                </Box>
              )}
            </Box>
          </Card>
        </Box>
      </Flex>

      {/* Quick Actions */}
      <Box mt="6">
        <Card>
          <Box p="4">
                          <Heading size="4" mb="3">{(dict as any).workflow.history.detail.quickActions}</Heading>
            <Flex gap="3" wrap="wrap">
              <Button variant="soft" asChild>
                <Link href={`/${lang}/harbor/workflow/active`}>
                  {(dict as any).workflow.history.detail.viewAllActive}
                </Link>
              </Button>
              <Button variant="soft" asChild>
                <Link href={`/${lang}/harbor/workflow/create`}>
                  {(dict as any).workflow.history.detail.createNewWorkflow}
                </Link>
              </Button>
            </Flex>
          </Box>
        </Card>
      </Box>

      {/* Terminate Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={terminateDialog.isOpen}
        onClose={() => setTerminateDialog({ isOpen: false })}
        onConfirm={handleTerminateWorkflow}
        title={(dict as any).workflow.history.detail.terminateDialog.title}
        message={(dict as any).workflow.history.detail.terminateDialog.message.replace('{{title}}', workflow?.Title || '')}
        confirmText={(dict as any).workflow.history.detail.terminateDialog.confirm}
        cancelText={(dict as any).workflow.history.detail.terminateDialog.cancel}
        variant="warning"
        isLoading={isTerminating}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false })}
        onConfirm={handleDeleteWorkflow}
        title={(dict as any).workflow.history.detail.deleteDialog.title}
        message={(dict as any).workflow.history.detail.deleteDialog.message.replace('{{title}}', workflow?.Title || '')}
        confirmText={(dict as any).workflow.history.detail.deleteDialog.confirm}
        cancelText={(dict as any).workflow.history.detail.deleteDialog.cancel}
        variant="danger"
        isLoading={isDeleting}
      />

      {/* Media File Selector Dialog */}
      <Dialog.Root open={showMediaSelector} onOpenChange={setShowMediaSelector}>
        <Dialog.Content style={{ maxWidth: '1000px', maxHeight: '80vh' }}>
          <MediaFileSelector
            userEmail={userEmail}
            userTenantId={userTenantId}
            selectedFiles={selectedMediaFiles}
            onSelectionChange={(fileIds) => setSelectedMediaFiles(fileIds)}
            onClose={() => setShowMediaSelector(false)}
          />
        </Dialog.Content>
      </Dialog.Root>
    </>
  );
} 