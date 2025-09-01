'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from 'next-auth/react';
import { 
  Box, 
  Card, 
  Text, 
  Button, 
  TextArea, 
  Flex, 
  Badge,
  Separator,
  Heading,
  Container
} from '@radix-ui/themes';
import * as Dialog from '@radix-ui/react-dialog';
import { Plus, Edit3, Eye, Archive, Trash2, Globe, Lock, Calendar, Link, X, RefreshCw } from 'lucide-react';
import { SubscriberAnnouncement } from '@/types/subscriber-pages';
import ContentSelector from './ContentSelector';
import { useToast } from '@/components/Toast';

interface AnnouncementManagerProps {
  subscriberEmail: string;
  onAnnouncementAdded?: () => void;
}

const AnnouncementManager: React.FC<AnnouncementManagerProps> = ({ 
  subscriberEmail, 
  onAnnouncementAdded 
}) => {
  const { t } = useTranslation('translations');
  const { showToast } = useToast();
  const { data: session } = useSession();
  const [announcements, setAnnouncements] = useState<SubscriberAnnouncement[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showContentLinker, setShowContentLinker] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<SubscriberAnnouncement | null>(null);
  const [previewAnnouncement, setPreviewAnnouncement] = useState<SubscriberAnnouncement | null>(null);
  
  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [link, setLink] = useState('');
  const [linkText, setLinkText] = useState('');
  const [linkedContent, setLinkedContent] = useState<Array<{ id: number; mediaId: number; title: string; description: string; mediaType: string; fileSize: number; language: string; form: string; genre: string; publisher: { email: string; name: string }; publishedAt: string; accessToken: string }>>([]);
  const [selectedHandleId, setSelectedHandleId] = useState<number | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [language, setLanguage] = useState('en');
  
  // Handle list state
  const [handles, setHandles] = useState<Array<{ Id: number; Handle: string; DisplayName: string; IsActive: boolean }>>([]);
  
  // Filters
  const [filters, setFilters] = useState({
    status: 'all',
    language: 'all',
    handleId: 'all'
  });

  useEffect(() => {
    fetchAnnouncements();
    fetchHandles();
  }, [subscriberEmail, filters]);

  const fetchHandles = async () => {
    try {
      const response = await fetch(`/api/harbor/subscribers/${subscriberEmail}/handles`);
      if (response.ok) {
        const data = await response.json() as { success: boolean; data: Array<{ Id: number; Handle: string; DisplayName: string; IsActive: boolean }> };
        if (data.success) {
          setHandles(data.data);
          // Set the first active handle as default if none selected
          if (!selectedHandleId && data.data.length > 0) {
            const firstActiveHandle = data.data.find(h => h.IsActive);
            if (firstActiveHandle) {
              setSelectedHandleId(firstActiveHandle.Id);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching handles:', error);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (filters.status !== 'all') {
        params.append('status', filters.status);
      }
      if (filters.language !== 'all') {
        params.append('language', filters.language);
      }
      if (filters.handleId !== 'all') {
        params.append('handleId', filters.handleId);
      }
      
      const response = await fetch(`/api/harbor/subscribers/${subscriberEmail}/announcements?${params}`);
      if (response.ok) {
        const data = await response.json() as { success: boolean; data: SubscriberAnnouncement[] };
        if (data.success) {
          setAnnouncements(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleContentSelected = (content: Array<{ id: number; mediaId: number; title: string; description: string; mediaType: string; fileSize: number; language: string; form: string; genre: string; publisher: { email: string; name: string }; publishedAt: string; accessToken: string }>) => {
    setLinkedContent(content);
  };

  const removeLinkedContent = (contentId: number) => {
    setLinkedContent(linkedContent.filter(c => c.id !== contentId));
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setLink('');
    setLinkText('');
    setLinkedContent([]);
    setSelectedHandleId(handles.length > 0 ? handles.find(h => h.IsActive)?.Id || handles[0].Id : null);
    setIsPublic(false);
    setIsActive(false);
    setLanguage('en');
  };

  const handleCreate = () => {
    resetForm();
    setShowCreateDialog(true);
  };

  const handleEdit = (announcement: SubscriberAnnouncement) => {
    setEditingAnnouncement(announcement);
    setTitle(announcement.Title);
    setContent(announcement.Content);
    setLink(announcement.Link || '');
    setLinkText(announcement.LinkText || '');
    setSelectedHandleId(announcement.HandleId);
    setIsPublic(announcement.IsPublic);
    setIsActive(announcement.IsActive);
    setLanguage(announcement.Language);
    setShowEditDialog(true);
  };

  const handlePreview = (announcement: SubscriberAnnouncement) => {
    setPreviewAnnouncement(announcement);
    setShowPreviewDialog(true);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return;

    try {
      if (!selectedHandleId) {
        showToast({
          type: 'warning',
          title: 'Warning',
          content: 'Please select a handle for this announcement'
        });
        return;
      }

      const announcementData = {
        title: title.trim(),
        content: content.trim(),
        link: link.trim() || undefined,
        linkText: linkText.trim() || undefined,
        handleId: selectedHandleId,
        isPublic,
        isActive,
        language
      };

      const url = editingAnnouncement 
        ? `/api/harbor/subscribers/${subscriberEmail}/announcements/${editingAnnouncement.Id}`
        : `/api/harbor/subscribers/${subscriberEmail}/announcements`;

      const method = editingAnnouncement ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(announcementData)
      });

      if (response.ok) {
        const result = await response.json() as { success: boolean; data: { Id: number } };
        
        // Save content links if any are selected
        if (linkedContent.length > 0 && result.data?.Id) {
          try {
            const linksResponse = await fetch('/api/harbor/content-links', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sourceType: 'announcement',
                sourceId: result.data.Id,
                linkedContentIds: linkedContent.map(content => content.id)
              }),
            });

            if (!linksResponse.ok) {
              console.warn('Failed to save content links, but announcement was saved');
            }
          } catch (linkError) {
            console.warn('Failed to save content links:', linkError);
          }
        }
        
        setShowCreateDialog(false);
        setShowEditDialog(false);
        resetForm();
        fetchAnnouncements();
        onAnnouncementAdded?.();
      }
    } catch (error) {
      console.error('Error saving announcement:', error);
    }
  };

  const handleDelete = async (announcementId: number) => {
    if (!confirm(t('subscriber_pages.announcements.confirm.delete'))) {
      return;
    }
    
    try {
      const response = await fetch(`/api/harbor/subscribers/${subscriberEmail}/announcements/${announcementId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchAnnouncements();
      }
    } catch (error) {
      console.error('Error deleting announcement:', error);
    }
  };

  const handleHardDelete = async (announcementId: number) => {
    if (!confirm(t('subscriber_pages.announcements.confirm.hard_delete'))) {
      return;
    }
    
    try {
      const response = await fetch(`/api/harbor/subscribers/${subscriberEmail}/announcements/${announcementId}/hard-delete`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchAnnouncements();
      }
    } catch (error) {
      console.error('Error hard deleting announcement:', error);
    }
  };

  const handleToggleStatus = async (announcementId: number, newStatus: boolean) => {
    try {
      const response = await fetch(`/api/harbor/subscribers/${subscriberEmail}/announcements/${announcementId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newStatus })
      });

      if (response.ok) {
        fetchAnnouncements();
      }
    } catch (error) {
      console.error('Error updating announcement status:', error);
    }
  };

  const handleToggleVisibility = async (announcementId: number, newVisibility: boolean) => {
    try {
      const response = await fetch(`/api/harbor/subscribers/${subscriberEmail}/announcements/${announcementId}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: newVisibility })
      });

      if (response.ok) {
        fetchAnnouncements();
      }
    } catch (error) {
      console.error('Error updating announcement visibility:', error);
    }
  };

  const handlePublish = async (announcementId: number) => {
    try {
      // Publish = make active and public
      const statusResponse = await fetch(`/api/harbor/subscribers/${subscriberEmail}/announcements/${announcementId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true })
      });

      const visibilityResponse = await fetch(`/api/harbor/subscribers/${subscriberEmail}/announcements/${announcementId}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: true })
      });

      if (statusResponse.ok && visibilityResponse.ok) {
        fetchAnnouncements();
      }
    } catch (error) {
      console.error('Error publishing announcement:', error);
    }
  };

  const getStatusColor = (isActive: boolean, isPublic: boolean) => {
    if (isActive && isPublic) return 'green';    // Published
    if (isActive && !isPublic) return 'yellow';  // Draft (active but private)
    if (!isActive && isPublic) return 'gray';    // Archived
    return 'orange';                              // Draft (inactive and private)
  };

  const getStatusText = (isActive: boolean, isPublic: boolean) => {
    if (isActive && isPublic) return t('common.published');
    if (isActive && !isPublic) return t('common.draft');
    if (!isActive && isPublic) return t('common.archived');
    return t('common.draft');
  };

  if (loading) {
    return (
      <Box>
        <Text color="gray">{t('subscriber_pages.announcements.loading')}</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Flex justify="between" align="center" mb="4">
        <Heading size="5">{t('subscriber_pages.announcements.title')}</Heading>
        <Button onClick={handleCreate}>
          <Plus size={16} />
          {t('subscriber_pages.announcements.create')}
        </Button>
      </Flex>

      {/* Filter Controls */}
      <Box mb="4" p="3" style={{ backgroundColor: 'var(--gray-2)', borderRadius: 'var(--radius-3)' }}>
        <Flex gap="3" align="center" wrap="wrap">
          <Box>
            <Text size="2" color="gray" mb="1" style={{ display: 'block' }}>
              Status
            </Text>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              style={{
                padding: 'var(--space-2)',
                border: '1px solid var(--gray-6)',
                borderRadius: 'var(--radius-2)',
                fontSize: 'var(--font-size-2)'
              }}
            >
              <option value="all">{t('common.all')}</option>
              <option value="active">{t('common.active')}</option>
              <option value="inactive">{t('common.inactive')}</option>
              <option value="archived">{t('common.archived')}</option>
            </select>
          </Box>
          
          <Box>
            <Text size="2" color="gray" mb="1" style={{ display: 'block' }}>
              Language
            </Text>
            <select
              value={filters.language}
              onChange={(e) => setFilters(prev => ({ ...prev, language: e.target.value }))}
              style={{
                padding: 'var(--space-2)',
                border: '1px solid var(--gray-6)',
                borderRadius: 'var(--radius-2)',
                fontSize: 'var(--font-size-2)'
              }}
            >
              <option value="all">{t('common.all')}</option>
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="nl">Nederlands</option>
            </select>
          </Box>
          
          <Box>
            <Text size="2" color="gray" mb="1" style={{ display: 'block' }}>
              {t('subscriber_pages.announcements.handle_label')}
            </Text>
            <select
              value={filters.handleId}
              onChange={(e) => setFilters(prev => ({ ...prev, handleId: e.target.value }))}
              style={{
                padding: 'var(--space-2)',
                border: '1px solid var(--gray-2)',
                borderRadius: 'var(--radius-2)',
                fontSize: 'var(--font-size-2)'
              }}
            >
              <option value="all">{t('common.all')}</option>
              {handles.map((handle) => (
                <option key={handle.Id} value={handle.Id}>
                  {handle.DisplayName} ({handle.Handle})
                </option>
              ))}
            </select>
          </Box>
        </Flex>
      </Box>

      {announcements.length === 0 ? (
        <Card>
          <Box p="6" style={{ textAlign: 'center' }}>
            <Text color="gray">{t('subscriber_pages.announcements.no_announcements')}</Text>
          </Box>
        </Card>
      ) : (
        <Box style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {announcements.map((announcement) => (
            <Card key={announcement.Id} style={{ border: '1px solid var(--gray-6)' }}>
              <Box p="5">
                <Flex justify="between" align="start">
                  <Box style={{ flex: 1 }}>
                    <Flex align="center" gap="3" mb="3">
                      <Heading size="4">{announcement.Title}</Heading>
                      <Badge color={getStatusColor(announcement.IsActive, announcement.IsPublic)} size="2">
                        {getStatusText(announcement.IsActive, announcement.IsPublic)}
                      </Badge>
                      {announcement.HandleDisplayName && (
                        <Badge color="blue" size="2">
                          {announcement.HandleDisplayName}
                        </Badge>
                      )}
                    </Flex>
                    
                    <Text color="gray" mb="3" size="3" style={{ whiteSpace: 'pre-wrap' }}>
                      {announcement.Content}
                    </Text>
                    
                    {announcement.Link && (
                      <Flex align="center" gap="1" mb="3">
                        <Link size={14} />
                        <a 
                          href={announcement.Link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ color: 'var(--blue-9)', textDecoration: 'none' }}
                        >
                          {announcement.LinkText || announcement.Link}
                        </a>
                      </Flex>
                    )}
                    
                    <Flex gap="4" align="center" mb="3">
                      <Text size="2" color="gray">
                        {t('subscriber_pages.announcements.published_on')}: {new Date(announcement.CreatedAt || announcement.PublishedAt || new Date()).toLocaleDateString()}
                      </Text>
                      {announcement.Language && (
                        <Badge color="gray" size="1">
                          {announcement.Language.toUpperCase()}
                        </Badge>
                      )}
                    </Flex>
                  </Box>
                  
                  <Flex gap="2">
                    {/* Edit Button - Always visible */}
                    <Button
                      onClick={() => handleEdit(announcement)}
                      variant="outline"
                      size="2"
                    >
                      {t('common.edit')}
                    </Button>
                    
                    {/* Status Management Buttons */}
                    {(() => {
                      if (!announcement.IsActive && !announcement.IsPublic) {
                        return (
                          <Button
                            onClick={() => handlePublish(announcement.Id)}
                            variant="solid"
                            size="2"
                          >
                            {t('common.publish')}
                          </Button>
                        );
                      } else if (announcement.IsActive && announcement.IsPublic) {
                        return (
                          <Button
                            onClick={() => handleToggleStatus(announcement.Id, false)}
                            variant="soft"
                            size="2"
                          >
                            {t('common.archive')}
                          </Button>
                        );
                      } else if (!announcement.IsActive && announcement.IsPublic) {
                        return (
                          <>
                            <Button
                              onClick={() => handleToggleStatus(announcement.Id, true)}
                              variant="solid"
                              size="2"
                            >
                              {t('common.restore')}
                            </Button>
                            <Button
                              onClick={() => handleHardDelete(announcement.Id)}
                              variant="soft"
                              color="red"
                              size="2"
                            >
                              {t('common.delete')}
                            </Button>
                          </>
                        );
                      } else if (announcement.IsActive && !announcement.IsPublic) {
                        return (
                          <Button
                            onClick={() => handlePublish(announcement.Id)}
                            variant="solid"
                            size="2"
                          >
                            {t('common.publish')}
                          </Button>
                        );
                      }
                      return null;
                    })()}
                  </Flex>
                </Flex>
              </Box>
            </Card>
          ))}
        </Box>
      )}

      {/* Create/Edit Dialog */}
      <Dialog.Root open={showCreateDialog || showEditDialog} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setShowEditDialog(false);
          resetForm();
        }
      }}>
        <Dialog.Content style={{ maxWidth: 600 }}>
          <Dialog.Title>
            {editingAnnouncement 
              ? t('subscriber_pages.announcements.edit_announcement')
              : t('subscriber_pages.announcements.create_announcement')
            }
          </Dialog.Title>
          
          <Box style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Box>
              <Text size="2" color="gray" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>
                {t('subscriber_pages.announcements.title_label')} *
              </Text>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('subscriber_pages.announcements.title_placeholder')}
                style={{
                  width: '100%',
                  padding: 'var(--space-2)',
                  border: '1px solid var(--gray-6)',
                  borderRadius: 'var(--radius-2)',
                  fontSize: 'var(--font-size-2)'
                }}
              />
            </Box>

            <Box>
              <Text size="2" color="gray" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>
                {t('subscriber_pages.announcements.handle_label')} *
              </Text>
              <select
                value={selectedHandleId || ''}
                onChange={(e) => setSelectedHandleId(parseInt(e.target.value) || null)}
                style={{
                  width: '100%',
                  padding: 'var(--space-2)',
                  border: '1px solid var(--gray-6)',
                  borderRadius: 'var(--radius-2)',
                  fontSize: 'var(--font-size-2)'
                }}
              >
                <option value="">Select a handle</option>
                {handles.map((handle) => (
                  <option key={handle.Id} value={handle.Id}>
                    {handle.DisplayName} ({handle.Handle})
                  </option>
                ))}
              </select>
            </Box>

            <Box>
              <Text size="2" color="gray" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>
                {t('subscriber_pages.announcements.content_label')} *
              </Text>
              <TextArea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t('subscriber_pages.announcements.content_placeholder')}
                rows={4}
              />
            </Box>

            <Box>
              <Text size="2" color="gray" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>
                {t('subscriber_pages.announcements.link_label')} (Optional)
              </Text>
              <input
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder={t('subscriber_pages.announcements.link_placeholder')}
                style={{
                  width: '100%',
                  padding: 'var(--space-2)',
                  border: '1px solid var(--gray-6)',
                  borderRadius: 'var(--radius-2)',
                  fontSize: 'var(--font-size-2)',
                  marginBottom: 'var(--space-2)'
                }}
              />
              <input
                type="text"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder={t('subscriber_pages.announcements.link_text_placeholder')}
                style={{
                  width: '100%',
                  padding: 'var(--space-2)',
                  border: '1px solid var(--gray-6)',
                  borderRadius: 'var(--radius-2)',
                  fontSize: 'var(--font-size-2)'
                }}
              />
            </Box>

            <Box>
              <Text size="2" color="gray" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>
                {t('subscriber_pages.announcements.linked_content_label')} (Optional)
              </Text>
              
              {linkedContent.length > 0 && (
                <Box mb="2" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {linkedContent.map((content) => (
                    <Flex key={content.id} justify="between" align="center" p="2" style={{ backgroundColor: 'var(--gray-3)', borderRadius: 'var(--radius-2)' }}>
                      <Text size="2">{content.title}</Text>
                      <Button size="1" variant="soft" color="red" onClick={() => removeLinkedContent(content.id)}>
                        <X size={12} />
                      </Button>
                    </Flex>
                  ))}
                </Box>
              )}
              
              <Button 
                size="2" 
                variant="soft" 
                onClick={() => setShowContentLinker(true)}
                style={{ width: '100%' }}
              >
                <Link size={14} />
                {t('subscriber_pages.announcements.link_harbor_content')}
              </Button>
            </Box>

            <Flex gap="2" align="center">
              <Button
                size="1"
                variant={isActive ? "solid" : "soft"}
                color={isActive ? "green" : "gray"}
                onClick={() => setIsActive(!isActive)}
              >
                {isActive ? t('common.active') : t('common.inactive')}
              </Button>
              <Button
                size="1"
                variant={isPublic ? "solid" : "soft"}
                color={isPublic ? "blue" : "gray"}
                onClick={() => setIsPublic(!isPublic)}
              >
                {isPublic ? t('common.public') : t('common.private')}
              </Button>
            </Flex>

            <Box>
              <Text size="2" color="gray" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>
                {t('subscriber_pages.announcements.language_label')}
              </Text>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                style={{
                  width: '100%',
                  padding: 'var(--space-2)',
                  border: '1px solid var(--gray-6)',
                  borderRadius: 'var(--radius-2)',
                  fontSize: 'var(--font-size-2)'
                }}
              >
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="nl">Nederlands</option>
              </select>
            </Box>
          </Box>

          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close asChild>
              <Button variant="soft">
                {t('common.cancel')}
              </Button>
            </Dialog.Close>
            <Button onClick={handleSubmit} disabled={!title.trim() || !content.trim()}>
              {editingAnnouncement ? t('common.update') : t('common.create')}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* Preview Dialog */}
      <Dialog.Root open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <Dialog.Content style={{ maxWidth: 600 }}>
          <Dialog.Title>{t('subscriber_pages.announcements.preview')}</Dialog.Title>
          
          {previewAnnouncement && (
            <Box>
              <Heading size="4" mb="3">{previewAnnouncement.Title}</Heading>
              <Text size="3" mb="3">{previewAnnouncement.Content}</Text>
              {previewAnnouncement.Link && (
                <Box mb="3">
                  <Flex align="center" gap="1">
                    <Link size={14} />
                    <a 
                      href={previewAnnouncement.Link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: 'var(--blue-9)', textDecoration: 'none' }}
                    >
                      {previewAnnouncement.LinkText || previewAnnouncement.Link}
                    </a>
                  </Flex>
                </Box>
              )}
                             <Flex gap="2" align="center" mb="3">
                 <Calendar size={14} />
                 <Text size="2" color="gray">
                   {new Date(previewAnnouncement.PublishedAt).toLocaleDateString()}
                 </Text>
                 <Badge color={previewAnnouncement.Language === 'en' ? 'blue' : 'green'}>
                   {previewAnnouncement.Language.toUpperCase()}
                 </Badge>
                 <Badge color="purple" variant="soft">
                   {previewAnnouncement.HandleDisplayName || `Handle ${previewAnnouncement.HandleId}`}
                 </Badge>
               </Flex>
              <Flex gap="2" align="center">
                <Badge color={previewAnnouncement.IsActive ? "green" : "gray"}>
                  {previewAnnouncement.IsActive ? t('common.active') : t('common.inactive')}
                </Badge>
                <Badge color={previewAnnouncement.IsPublic ? "blue" : "gray"}>
                  {previewAnnouncement.IsPublic ? t('common.public') : t('common.private')}
                </Badge>
              </Flex>
            </Box>
          )}

          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close asChild>
              <Button variant="soft">
                {t('common.close')}
              </Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* Content Selector Dialog */}
      <Dialog.Root open={showContentLinker} onOpenChange={setShowContentLinker}>
        <Dialog.Content style={{ maxWidth: '1200px', maxHeight: '80vh' }}>
          <Dialog.Title>{t('subscriber_pages.content_linker.title')}</Dialog.Title>
          <ContentSelector
            selectedContent={linkedContent}
            onSelectionChange={handleContentSelected}
            onClose={() => setShowContentLinker(false)}
            lang={language}
          />
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
};

export default AnnouncementManager;
