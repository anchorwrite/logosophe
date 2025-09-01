'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/common/Button';
import { MessageAttachment } from '@/types/messaging';
import { useToast } from '@/components/Toast';

interface MessageAttachmentsProps {
  attachments: MessageAttachment[];
  messageId: number;
  onAttachmentDelete?: (attachmentId: number) => void;
  canDelete?: boolean;
}

export const MessageAttachments: React.FC<MessageAttachmentsProps> = ({
  attachments,
  messageId,
  onAttachmentDelete,
  canDelete = false
}) => {
  const { t } = useTranslation('translations');
  const { showToast } = useToast();
  const [downloading, setDownloading] = useState<Record<number, boolean>>({});
  const [previewing, setPreviewing] = useState<Record<number, boolean>>({});

  if (attachments.length === 0) {
    return null;
  }

  const handleDownload = async (attachment: MessageAttachment) => {
    if (downloading[attachment.Id]) return;

    setDownloading(prev => ({ ...prev, [attachment.Id]: true }));

    try {
      // Use the messaging-specific download endpoint
              const response = await fetch(`/api/harbor/messaging/attachments/${attachment.Id}/download`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = attachment.FileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error('Failed to download file');
        showToast({
          type: 'error',
          title: 'Error',
          content: t('messaging.downloadFailed')
        });
      }
    } catch (error) {
      console.error('Download error:', error);
      showToast({
        type: 'error',
        title: 'Error',
        content: t('messaging.downloadFailed')
      });
    } finally {
      setDownloading(prev => ({ ...prev, [attachment.Id]: false }));
    }
  };

  const handlePreview = async (attachment: MessageAttachment) => {
    if (previewing[attachment.Id]) return;

    setPreviewing(prev => ({ ...prev, [attachment.Id]: true }));

    try {
      // For images, we can show a preview using the messaging-specific preview endpoint
      if (attachment.ContentType.startsWith('image/')) {
        const response = await fetch(`/api/harbor/messaging/attachments/${attachment.Id}/preview`);
        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          
          // Open in new window/tab
          window.open(url, '_blank');
        }
      } else {
        // For other file types, try to open in browser or download
        const response = await fetch(`/api/harbor/messaging/attachments/${attachment.Id}/download`);
        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          
          // Try to open in new window
          const newWindow = window.open(url, '_blank');
          if (!newWindow) {
            // Fallback to download
            handleDownload(attachment);
          }
        }
      }
    } catch (error) {
      console.error('Preview error:', error);
      // Fallback to download
      handleDownload(attachment);
    } finally {
      setPreviewing(prev => ({ ...prev, [attachment.Id]: false }));
    }
  };

  const getFileIcon = (contentType: string): string => {
    if (contentType.startsWith('image/')) return '🖼️';
    if (contentType.startsWith('video/')) return '🎥';
    if (contentType.startsWith('audio/')) return '🎵';
    if (contentType.includes('pdf')) return '📄';
    if (contentType.includes('word') || contentType.includes('document')) return '📝';
    if (contentType.includes('excel') || contentType.includes('spreadsheet')) return '📊';
    if (contentType.includes('powerpoint') || contentType.includes('presentation')) return '📊';
    return '📁';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const canPreview = (contentType: string): boolean => {
    return contentType.startsWith('image/') || 
           contentType.includes('pdf') || 
           contentType.includes('text/');
  };

  return (
    <div className="message-attachments">
      <div className="attachments-header">
        <h4 className="text-sm font-medium text-gray-700">
          Attachments ({attachments.length})
        </h4>
      </div>
      
      <div className="attachments-grid">
        {attachments.map((attachment) => (
          <div key={attachment.Id} className="attachment-card">
            <div className="attachment-icon">
              <span className="text-gray-500 text-2xl">
                {getFileIcon(attachment.ContentType)}
              </span>
            </div>
            
            <div className="attachment-details">
              <div className="attachment-name" title={attachment.FileName}>
                {attachment.FileName}
              </div>
              <div className="attachment-meta">
                <span className="file-size">
                  {formatFileSize(attachment.FileSize)}
                </span>
                <span className="file-type">
                  {attachment.ContentType}
                </span>
              </div>
            </div>
            
            <div className="attachment-actions">
              {canPreview(attachment.ContentType) && (
                <Button
                  onClick={() => handlePreview(attachment)}
                  color="#fff"
                >
                  {previewing[attachment.Id] ? '⏳' : '👁️'}
                </Button>
              )}
              
              <Button
                onClick={() => handleDownload(attachment)}
                color="#fff"
              >
                {downloading[attachment.Id] ? '⏳' : '⬇️'}
              </Button>
              
              {canDelete && onAttachmentDelete && (
                <Button
                  onClick={() => onAttachmentDelete(attachment.Id)}
                  color="#fff"
                >
                  🗑️
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .message-attachments {
          margin: 1rem 0;
          padding: 1rem;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          background-color: #f9fafb;
        }

        .attachments-header {
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .attachments-grid {
          display: grid;
          gap: 0.75rem;
        }

        .attachment-card {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          background-color: white;
          border: 1px solid #e5e7eb;
          border-radius: 0.375rem;
          transition: all 0.2s ease;
        }

        .attachment-card:hover {
          border-color: #d1d5db;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        }

        .attachment-icon {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 3rem;
          height: 3rem;
          background-color: #f3f4f6;
          border-radius: 0.375rem;
        }

        .attachment-details {
          flex: 1;
          min-width: 0;
        }

        .attachment-name {
          font-weight: 500;
          color: #374151;
          margin-bottom: 0.25rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .attachment-meta {
          display: flex;
          gap: 0.75rem;
          font-size: 0.75rem;
          color: #6b7280;
        }

        .file-size {
          font-weight: 500;
        }

        .file-type {
          background-color: #f3f4f6;
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
        }

        .attachment-actions {
          display: flex;
          gap: 0.25rem;
          flex-shrink: 0;
        }

        @media (max-width: 640px) {
          .attachment-card {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }

          .attachment-actions {
            align-self: flex-end;
          }
        }
      `}</style>
    </div>
  );
};
