import { useState, useCallback } from 'react';

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
  description?: string;
  thumbnailUrl?: string;
  domain: string;
}

interface UseMessageAttachmentsReturn {
  attachments: Attachment[];
  links: Link[];
  addAttachment: (file: File) => void;
  removeAttachment: (index: number) => void;
  addLink: (url: string, title?: string, description?: string) => void;
  removeLink: (index: number) => void;
  clearAll: () => void;
  hasAttachments: boolean;
  hasLinks: boolean;
  totalAttachmentSize: number;
}

export const useMessageAttachments = (): UseMessageAttachmentsReturn => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [links, setLinks] = useState<Link[]>([]);

  const addAttachment = useCallback((file: File) => {
    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error(`File size exceeds maximum limit of 10MB. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
    }

    // Check file type
    const allowedTypes = [
      'image/', 'text/', 'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    const isAllowedType = allowedTypes.some(type => file.type.startsWith(type));
    if (!isAllowedType) {
      throw new Error(`File type not allowed: ${file.type}`);
    }

    const newAttachment: Attachment = {
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type,
      file
    };

    setAttachments(prev => [...prev, newAttachment]);
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const addLink = useCallback((url: string, title?: string, description?: string) => {
    // Validate URL
    try {
      const urlObj = new URL(url);
      if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
        throw new Error('Only HTTP and HTTPS URLs are allowed');
      }

      // Basic security check
      const domain = urlObj.hostname;
      const blockedDomains = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
      if (blockedDomains.includes(domain)) {
        throw new Error('URL not allowed');
      }

      const newLink: Link = {
        url,
        title: title || domain,
        description,
        domain
      };

      setLinks(prev => [...prev, newLink]);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Invalid URL: ${error.message}`);
      }
      throw new Error('Invalid URL format');
    }
  }, []);

  const removeLink = useCallback((index: number) => {
    setLinks(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearAll = useCallback(() => {
    setAttachments([]);
    setLinks([]);
  }, []);

  const hasAttachments = attachments.length > 0;
  const hasLinks = links.length > 0;
  const totalAttachmentSize = attachments.reduce((total, attachment) => total + attachment.fileSize, 0);

  return {
    attachments,
    links,
    addAttachment,
    removeAttachment,
    addLink,
    removeLink,
    clearAll,
    hasAttachments,
    hasLinks,
    totalAttachmentSize
  };
};
