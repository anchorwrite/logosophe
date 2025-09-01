'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Button, Card, Flex, Heading, Text, TextArea, Badge, Dialog, Select, TextField } from '@radix-ui/themes';
import { Plus, Edit, Trash2, Eye, EyeOff, Globe, Lock } from 'lucide-react';
import { SubscriberBiography, SubscriberHandle } from '@/types/subscriber-pages';
import { useToast } from '@/components/Toast';

interface BiographyManagerProps {
  subscriberEmail: string;
}

export default function BiographyManager({ subscriberEmail }: BiographyManagerProps) {
  const { t } = useTranslation('translations');
  const { showToast } = useToast();
  const [biographies, setBiographies] = useState<SubscriberBiography[]>([]);
  const [handles, setHandles] = useState<Array<{ Id: number; Handle: string; DisplayName: string; IsActive: boolean }>>([]);
  const [handlesLoading, setHandlesLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [editingBiography, setEditingBiography] = useState<SubscriberBiography | null>(null);
  const [previewBiography, setPreviewBiography] = useState<SubscriberBiography | null>(null);
  
  // Form state
  const [selectedHandleId, setSelectedHandleId] = useState<number | null>(null);
  const [bio, setBio] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [language, setLanguage] = useState('en');

  // Filters
  const [filters, setFilters] = useState({
    status: 'all',
    language: 'all',
    handleId: 'all',
    search: ''
  });

  useEffect(() => {
    fetchBiographies();
    fetchHandles();
  }, [subscriberEmail, filters]);

  const fetchHandles = async () => {
    try {
      console.log('🔗 Fetching handles for:', subscriberEmail);
      const response = await fetch(`/api/harbor/subscribers/${subscriberEmail}/handles`);
      if (response.ok) {
        const data = await response.json() as { success: boolean; data: Array<{ Id: number; Handle: string; DisplayName: string; IsActive: boolean }> };
        console.log('🔗 Handles response:', data);
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
      } else {
        console.error('❌ Handles response not ok:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('❌ Handles error body:', errorText);
      }
    } catch (error) {
      console.error('❌ Error fetching handles:', error);
    } finally {
      setHandlesLoading(false);
    }
  };

  const fetchBiographies = async () => {
    try {
      console.log('📖 Fetching biographies for:', subscriberEmail);
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
      if (filters.search) {
        params.append('search', filters.search);
      }
      
      const response = await fetch(`/api/harbor/subscribers/${subscriberEmail}/biographies?${params}`);
      if (response.ok) {
        const data = await response.json() as { success: boolean; data: SubscriberBiography[] };
        console.log('📖 Biographies response:', data);
        if (data.success) {
          setBiographies(data.data);
        }
      }
    } catch (error) {
      console.error('❌ Error fetching biographies:', error);
      setError('Failed to load biographies');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const getStatusColor = (isPublic: boolean, isActive: boolean) => {
    if (!isActive) return 'gray'; // archived
    return isPublic ? 'green' : 'orange';
  };

  const getStatusText = (isPublic: boolean, isActive: boolean) => {
    if (!isActive) return t('common.archived');
    return isPublic ? t('common.public') : t('common.private');
  };

  const resetForm = () => {
    setSelectedHandleId(null);
    setBio('');
    setIsPublic(true);
    setLanguage('en');
    setEditingBiography(null);
  };

  const handleCreate = () => {
    resetForm();
    setShowCreateDialog(true);
  };

  const handleEdit = (biography: SubscriberBiography) => {
    setEditingBiography(biography);
    setSelectedHandleId(biography.HandleId);
    setBio(biography.Bio);
    setIsPublic(biography.IsPublic);
    setLanguage(biography.Language);
    setShowEditDialog(true);
  };

  const handlePreview = (biography: SubscriberBiography) => {
    setPreviewBiography(biography);
    setShowPreviewDialog(true);
  };

  const reloadData = async () => {
    try {
      console.log('🔄 Starting reloadData...');
      await Promise.all([
        fetchBiographies(),
        fetchHandles()
      ]);
      console.log('🎯 Reload completed');
    } catch (error) {
      console.error('❌ Error reloading data:', error);
    }
  };

  const handleSubmit = async () => {
    if (!selectedHandleId || !bio.trim()) {
      setError('Please select a handle and enter biography content');
      return;
    }

    try {
      const url = editingBiography 
        ? `/api/harbor/subscribers/${subscriberEmail}/biographies/${editingBiography.Id}`
        : `/api/harbor/subscribers/${subscriberEmail}/biographies`;
      
      const method = editingBiography ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handleId: selectedHandleId,
          bio: bio.trim(),
          isPublic,
          language
        })
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log('Biography saved:', responseData);
        
        await reloadData();
        setShowCreateDialog(false);
        setShowEditDialog(false);
        resetForm();
        setError(null);
      } else {
        const errorData = await response.json() as { error?: string };
        setError(errorData.error || 'Failed to save biography');
      }
    } catch (error) {
      console.error('Error saving biography:', error);
      setError('Failed to save biography');
    }
  };

  const handleArchive = async (biographyId: number) => {
    if (!confirm(t('subscriber_pages.biography.confirm.archive'))) return;

    try {
      const response = await fetch(`/api/harbor/subscribers/${subscriberEmail}/biographies/${biographyId}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false })
      });

      if (response.ok) {
        await reloadData();
        showToast({
          type: 'success',
          title: 'Success',
          content: t('subscriber_pages.biography.success.archived')
        });
      }
    } catch (error) {
      console.error('Error archiving biography:', error);
    }
  };

  const handleRestore = async (biographyId: number) => {
    try {
      const response = await fetch(`/api/harbor/subscribers/${subscriberEmail}/biographies/${biographyId}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true })
      });

      if (response.ok) {
        await reloadData();
        showToast({
          type: 'success',
          title: 'Success',
          content: t('subscriber_pages.biography.success.restored')
        });
      }
    } catch (error) {
      console.error('Error restoring biography:', error);
    }
  };

  const handleDelete = async (biographyId: number) => {
    if (!confirm(t('subscriber_pages.biography.confirm.delete'))) return;

    try {
      const response = await fetch(`/api/harbor/subscribers/${subscriberEmail}/biographies/${biographyId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await reloadData();
        showToast({
          type: 'success',
          title: 'Success',
          content: t('subscriber_pages.biography.success.deleted')
        });
      }
    } catch (error) {
      console.error('Error deleting biography:', error);
    }
  };

  if (loading) {
    return (
      <Box>
        <Text>{t('subscriber_pages.biography.loading')}</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Flex justify="between" align="center" mb="4">
        <Heading size="5">{t('subscriber_pages.biography.title')}</Heading>
        <Button onClick={handleCreate}>
          <Plus size={16} />
          {t('subscriber_pages.biography.create')}
        </Button>
      </Flex>

      {error && (
        <Box mb="4" p="3" style={{ backgroundColor: 'var(--red-2)', borderRadius: 'var(--radius-2)' }}>
          <Text color="red">{error}</Text>
        </Box>
      )}

      {/* Filters Section */}
      <Card mb="4">
        <Box p="6">
          <Heading size="5" mb="4">
            {t('subscriber_pages.biography.filters.title')}
          </Heading>
          
          <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <Box>
              <Text weight="medium" size="2" mb="2">
                {t('subscriber_pages.biography.filters.status')}
              </Text>
              <Select.Root value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                <Select.Trigger />
                <Select.Content>
                  <Select.Item value="all">{t('common.all')}</Select.Item>
                  <Select.Item value="public">{t('common.public')}</Select.Item>
                  <Select.Item value="private">{t('common.private')}</Select.Item>
                  <Select.Item value="archived">{t('common.archived')}</Select.Item>
                </Select.Content>
              </Select.Root>
            </Box>

            <Box>
              <Text weight="medium" size="2" mb="2">
                {t('subscriber_pages.biography.filters.language')}
              </Text>
              <Select.Root value={filters.language} onValueChange={(value) => handleFilterChange('language', value)}>
                <Select.Trigger />
                <Select.Content>
                  <Select.Item value="all">{t('common.all')}</Select.Item>
                  <Select.Item value="en">{t('subscriber_pages.biography.language_names.en')}</Select.Item>
                  <Select.Item value="es">{t('subscriber_pages.biography.language_names.es')}</Select.Item>
                  <Select.Item value="fr">{t('subscriber_pages.biography.language_names.fr')}</Select.Item>
                  <Select.Item value="de">{t('subscriber_pages.biography.language_names.de')}</Select.Item>
                  <Select.Item value="nl">{t('subscriber_pages.biography.language_names.nl')}</Select.Item>
                </Select.Content>
              </Select.Root>
            </Box>

            <Box>
              <Text weight="medium" size="2" mb="2">
                {t('subscriber_pages.biography.filters.handle')}
              </Text>
              <Select.Root value={filters.handleId} onValueChange={(value) => handleFilterChange('handleId', value)}>
                <Select.Trigger />
                <Select.Content>
                  <Select.Item value="all">{t('common.all')}</Select.Item>
                  {handles.map(handle => (
                    <Select.Item key={handle.Id} value={handle.Id.toString()}>
                      {handle.DisplayName}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Box>

            <Box>
              <Text weight="medium" size="2" mb="2">
                {t('subscriber_pages.biography.filters.search')}
              </Text>
              <TextField.Root>
                <TextField.Input
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  placeholder={t('subscriber_pages.biography.filters.search_placeholder')}
                />
              </TextField.Root>
            </Box>
          </Box>
        </Box>
      </Card>

      {loading ? (
        <Card>
          <Box p="6" style={{ textAlign: 'center' }}>
            <Text color="gray">Loading biographies...</Text>
          </Box>
        </Card>
      ) : biographies && biographies.length === 0 ? (
        <Card>
          <Box p="6" style={{ textAlign: 'center' }}>
            <Text color="gray">{t('subscriber_pages.biography.no_biographies')}</Text>
          </Box>
        </Card>
      ) : biographies && biographies.length > 0 ? (
        <Box style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {biographies.map((biography) => (
            <Card key={biography.Id}>
              <Box p="4">
                <Flex justify="between" align="start" mb="3">
                  <Box style={{ flex: 1 }}>
                    <Text size="3" weight="bold" mb="2" style={{ display: 'block' }}>
                      {biography.HandleDisplayName || `Handle ${biography.HandleId}`}
                    </Text>
                    <Text size="2" color="gray" mb="2" style={{ display: 'block' }}>
                      {biography.Bio.length > 150 
                        ? `${biography.Bio.substring(0, 150)}...` 
                        : biography.Bio
                      }
                    </Text>
                    <Flex gap="2" align="center">
                      <Badge color={getStatusColor(biography.IsPublic, biography.IsActive)}>
                        {getStatusText(biography.IsPublic, biography.IsActive)}
                      </Badge>
                      <Badge color="blue">
                        {biography.Language.toUpperCase()}
                      </Badge>
                      <Text size="1" color="gray">
                        {new Date(biography.UpdatedAt).toLocaleDateString()}
                      </Text>
                    </Flex>
                  </Box>
                  <Flex gap="2">
                    <Button size="1" variant="soft" onClick={() => handlePreview(biography)}>
                      <Eye size={14} />
                      {t('common.preview')}
                    </Button>
                    <Button size="1" variant="soft" onClick={() => handleEdit(biography)}>
                      <Edit size={14} />
                      {t('common.edit')}
                    </Button>
                    {biography.IsActive ? (
                      <Button size="1" variant="soft" color="orange" onClick={() => handleArchive(biography.Id)}>
                        <EyeOff size={14} />
                        {t('common.archive')}
                      </Button>
                    ) : (
                      <Button size="1" variant="soft" color="green" onClick={() => handleRestore(biography.Id)}>
                        <Eye size={14} />
                        {t('common.restore')}
                      </Button>
                    )}
                    <Button size="1" variant="soft" color="red" onClick={() => handleDelete(biography.Id)}>
                      <Trash2 size={14} />
                      {t('common.delete')}
                    </Button>
                  </Flex>
                </Flex>
              </Box>
            </Card>
          ))}
        </Box>
      ) : null}

      {/* Create/Edit Dialog */}
      <Dialog.Root open={showCreateDialog || showEditDialog} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setShowEditDialog(false);
          resetForm();
        }
      }}>
        {/* Only render dialog content if handles have loaded */}
        {handles && handles.length > 0 ? (
        <Dialog.Content style={{ maxWidth: '600px' }}>
          <Dialog.Title>
            {editingBiography ? t('subscriber_pages.biography.edit_biography') : t('subscriber_pages.biography.create_biography')}
          </Dialog.Title>
          
          <Box mt="4">
            <Box mb="4">
              <Text size="2" color="gray" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>
                {t('subscriber_pages.biography.handle_label')} *
              </Text>
              {handlesLoading ? (
                <Text size="2" color="gray">Loading handles...</Text>
              ) : handles.length === 0 ? (
                <Text size="2" color="red">No handles available. Please create a handle first.</Text>
              ) : (
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
              )}
            </Box>

            <Box mb="4">
              <Text size="2" color="gray" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>
                {t('subscriber_pages.biography.content_label')} *
              </Text>
              <TextArea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={t('subscriber_pages.biography.content_placeholder')}
                style={{ minHeight: '120px' }}
              />
            </Box>

            <Flex gap="4" mb="4">
              <Box>
                <Text size="2" color="gray" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>
                  {t('common.language')}
                </Text>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  style={{
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

              <Box>
                <Text size="2" color="gray" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>
                  {t('common.visibility')}
                </Text>
                <Button
                  variant={isPublic ? 'solid' : 'soft'}
                  color={isPublic ? 'green' : 'orange'}
                  onClick={() => setIsPublic(!isPublic)}
                  style={{ minWidth: '100px' }}
                >
                  {isPublic ? <Globe size={14} /> : <Lock size={14} />}
                  {isPublic ? t('common.public') : t('common.private')}
                </Button>
              </Box>
            </Flex>
          </Box>

          <Flex gap="3" mt="6" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">
                {t('common.cancel')}
              </Button>
            </Dialog.Close>
            <Button onClick={handleSubmit}>
              {editingBiography ? t('common.update') : t('common.create')}
            </Button>
          </Flex>
        </Dialog.Content>
        ) : (
          <Dialog.Content style={{ maxWidth: '600px' }}>
            <Dialog.Title>Loading...</Dialog.Title>
            <Box p="6" style={{ textAlign: 'center' }}>
              <Text>Please wait while handles are loading...</Text>
            </Box>
          </Dialog.Content>
        )}
      </Dialog.Root>

      {/* Preview Dialog */}
      <Dialog.Root open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <Dialog.Content style={{ maxWidth: '600px' }}>
          <Dialog.Title>{t('common.preview')}</Dialog.Title>
          
          {previewBiography && (
            <Box mt="4">
              <Box mb="4">
                <Text size="2" color="gray" mb="2" style={{ display: 'block' }}>
                  {t('subscriber_pages.biography.handle_label')}
                </Text>
                <Text weight="bold">
                  {previewBiography.HandleDisplayName || `Handle ${previewBiography.HandleId}`}
                </Text>
              </Box>

              <Box mb="4">
                <Text size="2" color="gray" mb="2" style={{ display: 'block' }}>
                  {t('subscriber_pages.biography.content_label')}
                </Text>
                <Text style={{ whiteSpace: 'pre-wrap' }}>{previewBiography.Bio}</Text>
              </Box>

              <Flex gap="2" align="center">
                <Badge color={previewBiography.IsPublic ? 'green' : 'orange'}>
                  {previewBiography.IsPublic ? t('common.public') : t('common.private')}
                </Badge>
                <Badge color="blue">
                  {previewBiography.Language.toUpperCase()}
                </Badge>
                <Text size="2" color="gray">
                  {new Date(previewBiography.UpdatedAt).toLocaleDateString()}
                </Text>
              </Flex>
            </Box>
          )}

          <Dialog.Close>
            <Button variant="soft" color="gray" mt="6">
              {t('common.close')}
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
}
