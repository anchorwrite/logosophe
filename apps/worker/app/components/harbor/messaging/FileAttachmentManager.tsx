'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Box, Button, Text, Flex, Checkbox, Select, Card } from '@radix-ui/themes';
import { Upload, X, Check, Paperclip } from 'lucide-react';
import { MessageAttachment, CreateAttachmentRequest } from '@/types/messaging';

interface FileAttachmentManagerProps {
  tenantId: string;
  userEmail: string;
  lang: string;
  onAttachmentsChange: (attachments: CreateAttachmentRequest[]) => void;
  existingAttachments?: MessageAttachment[];
  maxFileSize?: number; // in bytes
  maxFiles?: number;
  allowedTypes?: string[];
}

export const FileAttachmentManager: React.FC<FileAttachmentManagerProps> = ({
  tenantId,
  userEmail,
  lang,
  onAttachmentsChange,
  existingAttachments = [],
  maxFileSize = 50 * 1024 * 1024, // 50MB default
  maxFiles = 10,
  allowedTypes = ['image/*', 'application/pdf', 'text/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
}) => {
  const [attachments, setAttachments] = useState<CreateAttachmentRequest[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Check file count limit
    if (attachments.length + files.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`);
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    const newAttachments: CreateAttachmentRequest[] = [];

    for (const file of files) {
      // Check file size
      if (file.size > maxFileSize) {
        alert(`File ${file.name} is too large. Maximum size is ${formatFileSize(maxFileSize)}`);
        continue;
      }

      // Check file type
      if (!isFileTypeAllowed(file.type, allowedTypes)) {
        alert(`File type ${file.type} is not allowed`);
        continue;
      }

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('tenantId', tenantId);

        const response = await fetch('/api/messaging/upload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const result = await response.json() as any;
          if (result.success && result.data?.key) {
            newAttachments.push({
              mediaId: Date.now(), // Generate temporary ID for frontend tracking
              attachmentType: 'upload' as const,
              fileName: result.data.fileName,
              fileSize: result.data.fileSize,
              contentType: result.data.contentType,
              r2Key: result.data.key
            });
          } else {
            setUploadError(`Failed to upload ${file.name}: Invalid response format`);
          }
        } else {
          const error = await response.json() as { error: string };
          setUploadError(`Failed to upload ${file.name}: ${error.error}`);
        }
      } catch (error) {
        console.error('Upload error:', error);
        setUploadError(`Failed to upload ${file.name}`);
      }
    }

    const updatedAttachments = [...attachments, ...newAttachments];
    setAttachments(updatedAttachments);
    onAttachmentsChange(updatedAttachments);
    setIsUploading(false);
    setUploadProgress({});

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setSelectedFile(null);
  }, [attachments, maxFiles, maxFileSize, allowedTypes, tenantId, onAttachmentsChange]);

  const removeAttachment = (mediaId: number) => {
    const updatedAttachments = attachments.filter(att => att.mediaId !== mediaId);
    setAttachments(updatedAttachments);
    onAttachmentsChange(updatedAttachments);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isFileTypeAllowed = (fileType: string, allowedTypes: string[]) => {
    return allowedTypes.some(allowed => {
      if (allowed.endsWith('/*')) {
        return fileType.startsWith(allowed.slice(0, -1));
      }
      return fileType === allowed;
    });
  };

  return (
    <Box>
      <Flex direction="column" gap="4">
        {/* File Upload Area */}
        <Card size="2" style={{ 
          border: '2px dashed var(--gray-6)', 
          borderRadius: 'var(--radius-3)', 
          padding: 'var(--space-6)', 
          textAlign: 'center',
          backgroundColor: 'var(--gray-1)'
        }}>
          <label
            htmlFor="file-upload"
            style={{ cursor: 'pointer', display: 'block' }}
          >
            <Flex direction="column" align="center" gap="4">
              <Paperclip style={{ width: '2rem', height: '2rem', color: 'var(--gray-9)' }} />
              <Flex direction="column" gap="2">
                <Text size="4" weight="medium">
                  {isUploading ? 'Uploading...' : 'Click to attach files'}
                </Text>
                <Text size="2" color="gray">
                  Supports images, documents, and other file types
                </Text>
                <Text size="1" color="gray">
                  Max file size: {formatFileSize(maxFileSize)}
                </Text>
              </Flex>
            </Flex>
          </label>
          <input
            id="file-upload"
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileSelect}
            disabled={isUploading}
            accept={allowedTypes.join(',')}
          />
        </Card>

        {/* Error Display */}
        {uploadError && (
          <Card size="2" style={{ 
            backgroundColor: 'var(--red-3)', 
            border: '1px solid var(--red-6)',
            color: 'var(--red-11)'
          }}>
            <Text size="2">{uploadError}</Text>
            <Button 
              size="1" 
              variant="soft" 
              color="red" 
              onClick={() => setUploadError(null)}
              style={{ marginLeft: '1rem' }}
            >
              <X size={12} />
            </Button>
          </Card>
        )}

        {/* Current Attachments */}
        {attachments.length > 0 && (
          <Box>
            <Text size="2" weight="medium" mb="2">Attached Files ({attachments.length})</Text>
            <Flex direction="column" gap="2">
              {attachments.map((attachment) => (
                <Card key={attachment.mediaId} size="1" style={{ 
                  backgroundColor: 'var(--gray-2)',
                  border: '1px solid var(--gray-6)'
                }}>
                  <Flex justify="between" align="center">
                    <Flex align="center" gap="2">
                      <Paperclip size={14} />
                      <Text size="2">{attachment.fileName || `File ID: ${attachment.mediaId}`}</Text>
                      {attachment.fileSize && (
                        <Text size="1" color="gray">({formatFileSize(attachment.fileSize)})</Text>
                      )}
                    </Flex>
                    <Button 
                      size="1" 
                      variant="soft" 
                      color="red"
                      onClick={() => attachment.mediaId && removeAttachment(attachment.mediaId)}
                    >
                      <X size={12} />
                    </Button>
                  </Flex>
                </Card>
              ))}
            </Flex>
          </Box>
        )}

        {/* Upload Progress */}
        {isUploading && (
          <Card size="2" style={{ backgroundColor: 'var(--blue-2)' }}>
            <Text size="2" color="blue">Uploading files...</Text>
          </Card>
        )}
      </Flex>
    </Box>
  );
};
