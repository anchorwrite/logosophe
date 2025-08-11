'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Button } from '@/common/Button';
import MediaFileSelector from '@/components/MediaFileSelector';
import { MessageAttachment, CreateAttachmentRequest, FileUploadResult } from '@/types/messaging';

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
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
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

        const response = await fetch('/api/messaging/attachments/upload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const result: FileUploadResult = await response.json();
          if (result.success && result.mediaFileId) {
            newAttachments.push({
              mediaId: result.mediaFileId,
              attachmentType: 'upload' as const
            });
          }
        } else {
          const error = await response.json() as { error: string };
          alert(`Failed to upload ${file.name}: ${error.error}`);
        }
      } catch (error) {
        console.error('Upload error:', error);
        alert(`Failed to upload ${file.name}`);
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
  }, [attachments, maxFiles, maxFileSize, allowedTypes, tenantId, onAttachmentsChange]);

  const handleMediaLibrarySelect = useCallback((fileIds: number[]) => {
    const newAttachments: CreateAttachmentRequest[] = fileIds.map(mediaId => ({
      mediaId,
      attachmentType: 'media_library' as const
    }));

    const updatedAttachments = [...attachments, ...newAttachments];
    setAttachments(updatedAttachments);
    onAttachmentsChange(updatedAttachments);
    setShowMediaLibrary(false);
  }, [attachments, onAttachmentsChange]);

  const removeAttachment = useCallback((index: number) => {
    const updatedAttachments = attachments.filter((_, i) => i !== index);
    setAttachments(updatedAttachments);
    onAttachmentsChange(updatedAttachments);
  }, [attachments, onAttachmentsChange]);

  const isFileTypeAllowed = (fileType: string, allowedTypes: string[]): boolean => {
    return allowedTypes.some(allowed => {
      if (allowed.endsWith('/*')) {
        return fileType.startsWith(allowed.slice(0, -1));
      }
      return fileType === allowed;
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getAttachmentDisplayName = (attachment: CreateAttachmentRequest): string => {
    if (attachment.mediaId && attachment.attachmentType === 'media_library') {
      // For media library files, we'd need to fetch the name
      // For now, show a placeholder
      return `Media File ${attachment.mediaId}`;
    }
    return 'Uploaded File';
  };

  return (
    <div className="file-attachment-manager">
      <div className="attachment-controls">
        <div className="control-buttons">
          <Button
            onClick={() => fileInputRef.current?.click()}
            color="#fff"
          >
            📤 {isUploading ? 'Uploading...' : 'Upload Files'}
          </Button>
          
          <Button
            onClick={() => setShowMediaLibrary(true)}
            color="#fff"
          >
            📁 Media Library
          </Button>
        </div>
        
        <div className="file-limits">
          <span className="text-sm text-gray-500">
            {attachments.length}/{maxFiles} files • Max {formatFileSize(maxFileSize)} per file
          </span>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        accept={allowedTypes.join(',')}
      />

      {attachments.length > 0 && (
        <div className="attachments-list">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Attachments ({attachments.length}/{maxFiles})
          </h4>
          {attachments.map((attachment, index) => (
            <div key={index} className="attachment-item">
              <div className="attachment-info">
                <span className="attachment-icon">
                  {attachment.attachmentType === 'media_library' ? '📁' : '📄'}
                </span>
                <span className="attachment-name">
                  {getAttachmentDisplayName(attachment)}
                </span>
                <span className="attachment-type">
                  {attachment.attachmentType === 'media_library' ? 'Media Library' : 'Upload'}
                </span>
              </div>
              <Button
                onClick={() => removeAttachment(index)}
                color="#fff"
              >
                🗑️
              </Button>
            </div>
          ))}
        </div>
      )}

      {showMediaLibrary && (
        <MediaFileSelector
          userEmail={userEmail}
          userTenantId={tenantId}
          selectedFiles={[]}
          onSelectionChange={handleMediaLibrarySelect}
          onClose={() => setShowMediaLibrary(false)}
          lang={lang}
        />
      )}
    </div>
  );
};
