'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Button, TextArea, TextField, Box, Flex, Text } from '@radix-ui/themes';

interface Attachment {
  id?: number;
  fileName: string;
  fileSize: number;
  contentType: string;
  file?: File;
}

interface Link {
  id?: number;
  url: string;
  title?: string;
  domain: string;
}

interface EnhancedMessageComposerProps {
  tenantId: string;
  recipientEmail: string;
  onSend: (message: {
    subject: string;
    body: string;
    attachments: Attachment[];
    links: Link[];
  }) => void;
  onCancel?: () => void;
  isSending?: boolean;
}

export const EnhancedMessageComposer: React.FC<EnhancedMessageComposerProps> = ({
  tenantId,
  recipientEmail,
  onSend,
  onCancel,
  isSending = false
}) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;
    const newAttachments: Attachment[] = Array.from(files).map(file => ({
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type,
      file
    }));
    setAttachments(prev => [...prev, ...newAttachments]);
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const addLink = useCallback(() => {
    if (linkUrl.trim()) {
      const domain = new URL(linkUrl).hostname;
      const newLink: Link = {
        url: linkUrl,
        title: domain,
        domain
      };
      setLinks(prev => [...prev, newLink]);
      setLinkUrl('');
      setShowLinkInput(false);
    }
  }, [linkUrl]);

  const removeLink = useCallback((index: number) => {
    setLinks(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSend = useCallback(() => {
    if (!subject.trim() || !body.trim()) return;
    onSend({
      subject: subject.trim(),
      body: body.trim(),
      attachments,
      links
    });
  }, [subject, body, attachments, links, onSend]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Box className="enhanced-message-composer">
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          To: {recipientEmail}
        </label>
      </div>

      <div className="mb-4">
        <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
          Subject
        </label>
        <TextField.Root>
          <TextField.Input
            id="subject"
            value={subject}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSubject(e.target.value)}
            placeholder="Enter subject..."
            disabled={isSending}
          />
        </TextField.Root>
      </div>

      <div className="mb-4">
        <label htmlFor="body" className="block text-sm font-medium text-gray-700 mb-2">
          Message
        </label>
        <TextArea
          id="body"
          value={body}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)}
          placeholder="Type your message here..."
          rows={6}
          disabled={isSending}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Attachments
          </label>
          <Button
            variant="outline"
            size="2"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending}
          >
            Add Files
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
          accept="image/*,text/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        />

        {attachments.length > 0 && (
          <div className="mt-3 space-y-2">
            {attachments.map((attachment, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-gray-50 rounded border"
              >
                <div className="flex items-center space-x-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {attachment.fileName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(attachment.fileSize)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="2"
                  onClick={() => removeAttachment(index)}
                  disabled={isSending}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Links
          </label>
          <Button
            variant="outline"
            size="2"
            onClick={() => setShowLinkInput(true)}
            disabled={isSending}
          >
            Add Link
          </Button>
        </div>

        {showLinkInput && (
          <div className="flex space-x-2 mb-3">
            <TextField.Root style={{ flex: 1 }}>
              <TextField.Input
                type="url"
                value={linkUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLinkUrl(e.target.value)}
                placeholder="Enter URL..."
                onKeyPress={(e) => e.key === 'Enter' && addLink()}
              />
            </TextField.Root>
            <Button onClick={addLink} disabled={!linkUrl.trim()} size="2">
              Add
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowLinkInput(false);
                setLinkUrl('');
              }}
              size="2"
            >
              Cancel
            </Button>
          </div>
        )}

        {links.length > 0 && (
          <div className="mt-3 space-y-2">
            {links.map((link, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-gray-50 rounded border"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {link.title || link.domain}
                  </p>
                  <p className="text-xs text-gray-500">
                    {link.url}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="2"
                  onClick={() => removeLink(index)}
                  disabled={isSending}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-3 mt-6">
        {onCancel && (
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isSending}
            size="2"
          >
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSend}
          disabled={!subject.trim() || !body.trim() || isSending}
          size="2"
        >
          {isSending ? 'Sending...' : 'Send Message'}
        </Button>
      </div>
    </Box>
  );
};
