'use client';

import React, { useState, useEffect } from 'react';
import { Box, Flex, Text, Button, Badge } from '@radix-ui/themes';
import { MessageAttachment } from '@/types/messaging';

// Define the API response type for attachment details
interface AttachmentDetailsResponse {
  success: boolean;
  attachments?: Array<{
    Id: number;
    FileKey?: string;
    [key: string]: any;
  }>;
}

interface MessageAttachmentDisplayProps {
  messageId: number;
  tenantId: string;
  attachments: MessageAttachment[];
  onAttachmentClick?: (attachment: MessageAttachment) => void;
  onAttachmentRemove?: (attachmentId: number) => void;
  canRemove?: boolean;
  lang: string;
}

export const MessageAttachmentDisplay: React.FC<MessageAttachmentDisplayProps> = ({
  messageId,
  tenantId,
  attachments,
  onAttachmentClick,
  onAttachmentRemove,
  canRemove = false,
  lang
}) => {
  const [attachmentDetails, setAttachmentDetails] = useState<Record<number, any>>({});

  useEffect(() => {
    // Fetch additional attachment details if needed
    const fetchAttachmentDetails = async () => {
      try {
        const response = await fetch(`/api/messaging/attachments/message/${messageId}`);
        if (response.ok) {
          const data = await response.json() as AttachmentDetailsResponse;
          if (data.success && data.attachments) {
            const detailsMap: Record<number, any> = {};
            data.attachments.forEach((att) => {
              detailsMap[att.Id] = att;
            });
            setAttachmentDetails(detailsMap);
          }
        }
      } catch (error) {
        console.error('Error fetching attachment details:', error);
      }
    };

    if (attachments.length > 0) {
      fetchAttachmentDetails();
    }
  }, [messageId, attachments.length]);

  const getFileIcon = (contentType: string) => {
    if (contentType.startsWith('image/')) return '🖼️';
    if (contentType.startsWith('video/')) return '🎥';
    if (contentType.startsWith('audio/')) return '🎵';
    if (contentType.includes('pdf')) return '📄';
    if (contentType.includes('word') || contentType.includes('document')) return '📝';
    if (contentType.includes('excel') || contentType.includes('spreadsheet')) return '📊';
    return '📁';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleAttachmentClick = (attachment: MessageAttachment) => {
    if (onAttachmentClick) {
      onAttachmentClick(attachment);
    } else {
      // Default behavior: open/download the file
      const details = attachmentDetails[attachment.Id];
      if (details?.FileKey) {
        // Generate download link
        const downloadUrl = `/api/media/download/${details.FileKey}`;
        window.open(downloadUrl, '_blank');
      }
    }
  };

  const handleAttachmentRemove = (attachmentId: number) => {
    if (onAttachmentRemove) {
      onAttachmentRemove(attachmentId);
    }
  };

  if (attachments.length === 0) {
    return null;
  }

  return (
    <Box className="message-attachments">
      <Flex direction="column" gap="2">
        <Flex align="center" gap="2">
          <span className="text-gray-500">📎</span>
          <Text size="1" color="gray">
            {attachments.length} attachment{attachments.length !== 1 ? 's' : ''}
          </Text>
        </Flex>
        
        <Flex direction="column" gap="1">
          {attachments.map((attachment) => {
            const details = attachmentDetails[attachment.Id];
            const fileIcon = getFileIcon(attachment.ContentType);
            
            return (
              <Flex 
                key={attachment.Id} 
                align="center" 
                gap="2" 
                p="2" 
                style={{
                  border: '1px solid var(--gray-6)',
                  borderRadius: 'var(--radius-2)',
                  backgroundColor: 'var(--gray-1)',
                  cursor: onAttachmentClick ? 'pointer' : 'default'
                }}
                onClick={() => handleAttachmentClick(attachment)}
              >
                <span className="text-gray-600">{fileIcon}</span>
                
                <Flex direction="column" gap="1" style={{ flex: 1 }}>
                  <Text size="2" weight="medium" style={{ color: 'var(--gray-12)' }}>
                    {attachment.FileName}
                  </Text>
                  <Flex align="center" gap="2">
                    <Text size="1" color="gray">
                      {formatFileSize(attachment.FileSize)}
                    </Text>
                    <Badge variant="soft" size="1">
                      {attachment.AttachmentType === 'media_library' ? 'Media Library' : 'Upload'}
                    </Badge>
                  </Flex>
                </Flex>
                
                {canRemove && (
                  <Button
                    variant="ghost"
                    size="1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAttachmentRemove(attachment.Id);
                    }}
                    style={{ color: 'var(--red-9)' }}
                  >
                    🗑️
                  </Button>
                )}
              </Flex>
            );
          })}
        </Flex>
      </Flex>
    </Box>
  );
};
