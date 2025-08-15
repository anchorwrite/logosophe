'use client';

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/common/Button';
import { CreateLinkRequest, LinkPreview } from '@/types/messaging';

// Define the API response type for link processing
interface ProcessLinkResponse {
  success: boolean;
  data?: LinkPreview;
  error?: string;
}

interface LinkAttachmentManagerProps {
  tenantId: string;
  onLinksChange: (links: CreateLinkRequest[]) => void;
  existingLinks?: CreateLinkRequest[];
  maxLinks?: number;
}

export const LinkAttachmentManager: React.FC<LinkAttachmentManagerProps> = ({
  tenantId,
  onLinksChange,
  existingLinks = [],
  maxLinks = 5
}) => {
  const { t } = useTranslation('translations');
  const [links, setLinks] = useState<CreateLinkRequest[]>(existingLinks);
  const [newUrl, setNewUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddLink = useCallback(async () => {
    if (!newUrl.trim()) {
      setError(t('messaging.pleaseEnterUrl'));
      return;
    }

    if (links.length >= maxLinks) {
      setError(t('messaging.maximumLinksAllowed').replace('{max}', maxLinks.toString()));
      return;
    }

    // Basic URL validation
    try {
      new URL(newUrl);
    } catch {
      setError(t('messaging.pleaseEnterValidUrl'));
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Process the link to get metadata
              const response = await fetch('/api/harbor/messaging/process-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: newUrl }),
      });

      if (response.ok) {
        const result = await response.json() as ProcessLinkResponse;
        if (result.success && result.data) {
          const linkPreview: LinkPreview = result.data;
          
          const newLink: CreateLinkRequest = {
            url: newUrl
          };

          const updatedLinks = [...links, newLink];
          setLinks(updatedLinks);
          onLinksChange(updatedLinks);
          setNewUrl('');
        } else {
          setError(result.error || t('messaging.failedToProcessLink'));
        }
      } else {
        const error = await response.json() as { error: string };
        setError(error.error || t('messaging.failedToProcessLink'));
      }
    } catch (error) {
      console.error('Error processing link:', error);
      setError(t('messaging.failedToProcessLink'));
    } finally {
      setIsProcessing(false);
    }
  }, [newUrl, links, maxLinks, onLinksChange]);

  const handleRemoveLink = useCallback((index: number) => {
    const updatedLinks = links.filter((_, i) => i !== index);
    setLinks(updatedLinks);
    onLinksChange(updatedLinks);
  }, [links, onLinksChange]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddLink();
    }
  }, [handleAddLink]);

  return (
    <div className="link-attachment-manager">
      <div className="add-link-section">
        <div className="input-group">
          <input
            type="url"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter URL to share..."
            className="url-input"
            disabled={isProcessing}
          />
          <Button
            onClick={handleAddLink}
            color="#fff"
          >
            {isProcessing ? t('messaging.processing') : t('messaging.addLink')}
          </Button>
        </div>
        
        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}
      </div>

      {links.length > 0 && (
        <div className="links-list">
          <h4>{t('messaging.attachedLinks').replace('{count}', links.length.toString()).replace('{max}', maxLinks.toString())}</h4>
          {links.map((link, index) => (
            <div key={index} className="link-item">
              <div className="link-info">
                <div className="link-url">
                  {link.url}
                </div>
              </div>
              <Button
                onClick={() => handleRemoveLink(index)}
                color="#fff"
              >
                🗑️
              </Button>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .link-attachment-manager {
          margin: 1rem 0;
        }

        .add-link-section {
          margin-bottom: 1rem;
        }

        .input-group {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .url-input {
          flex: 1;
          padding: 0.5rem;
          border: 1px solid var(--gray-6);
          border-radius: 4px;
          font-size: 0.875rem;
        }

        .add-link-btn {
          white-space: nowrap;
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--red-9);
          font-size: 0.875rem;
          margin-top: 0.5rem;
        }

        .error-icon {
          width: 16px;
          height: 16px;
        }

        .links-list {
          border: 1px solid var(--gray-6);
          border-radius: 4px;
          padding: 1rem;
        }

        .links-list h4 {
          margin: 0 0 1rem 0;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--gray-11);
        }

        .link-item {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 0.75rem;
          border: 1px solid var(--gray-5);
          border-radius: 4px;
          margin-bottom: 0.5rem;
          background: var(--gray-2);
        }

        .link-item:last-child {
          margin-bottom: 0;
        }

        .link-info {
          flex: 1;
          margin-right: 0.5rem;
        }

        .link-title {
          font-weight: 600;
          font-size: 0.875rem;
          margin-bottom: 0.25rem;
          color: var(--gray-12);
        }

        .link-description {
          font-size: 0.75rem;
          color: var(--gray-11);
          margin-bottom: 0.25rem;
          line-height: 1.4;
        }

        .link-url {
          font-size: 0.75rem;
          color: var(--blue-9);
          word-break: break-all;
        }

        .remove-link-btn {
          padding: 0.25rem;
          min-width: auto;
        }
      `}</style>
    </div>
  );
};
