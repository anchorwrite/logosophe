'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Box, Flex, Heading, Text, Card, TextField, Checkbox, Badge, Separator } from '@radix-ui/themes';
import Container from '@/common/Container';
import TextArea from '@/common/TextArea';

interface SubscriberHandle {
  Id: number;
  SubscriberEmail: string;
  Handle: string;
  DisplayName: string;
  Description?: string;
  IsActive: boolean;
  IsPublic: boolean;
  CreatedAt: string;
  UpdatedAt: string;
}

interface HandleLimit {
  Id: number;
  LimitType: 'default' | 'premium' | 'enterprise';
  MaxHandles: number;
  Description?: string;
  IsActive: boolean;
  CreatedAt: string;
  UpdatedAt: string;
}

interface CreateHandleRequest {
  handle: string;
  displayName: string;
  description?: string;
  isPublic: boolean;
}

interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
  handleLimit?: HandleLimit;
}

interface HandleValidationResponse {
  data: {
    isValid: boolean;
    errors: string[];
    suggestions?: string[];
  };
  success: boolean;
  error?: string;
}

export default function HandleManager({ subscriberEmail }: { subscriberEmail: string }) {
  const { t } = useTranslation('translations');
  const [handles, setHandles] = useState<SubscriberHandle[]>([]);
  const [handleLimit, setHandleLimit] = useState<HandleLimit | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingHandle, setEditingHandle] = useState<SubscriberHandle | null>(null);
  const [formData, setFormData] = useState<CreateHandleRequest>({
    handle: '',
    displayName: '',
    description: '',
    isPublic: true
  });
  const [handleValidation, setHandleValidation] = useState<{
    isValid: boolean;
    errors: string[];
    suggestions?: string[];
  } | null>(null);

  // Fetch handles and limit
  useEffect(() => {
    fetchHandles();
  }, [subscriberEmail]);

  const fetchHandles = async () => {
    try {
      setLoading(true);
      setError(null);
      // Always include inactive handles so users can see and reactivate them
      const response = await fetch(`/api/harbor/subscribers/${encodeURIComponent(subscriberEmail)}/handles?includeInactive=true`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch handles');
      }
      
      const data = await response.json() as ApiResponse<SubscriberHandle[]>;
      
      // Ensure handles is always an array
      if (data.data && Array.isArray(data.data)) {
        setHandles(data.data);
      } else {
        setHandles([]);
      }
      
      if (data.handleLimit) {
        setHandleLimit(data.handleLimit);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch handles');
      setHandles([]); // Ensure handles is an array even on error
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof CreateHandleRequest, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Validate handle in real-time
    if (field === 'handle' && typeof value === 'string') {
      // Use the value directly, not from formData which might not be updated yet
      validateHandle(value);
    }
  };

  const validateHandle = async (handle: string) => {
    if (!handle.trim()) {
      setHandleValidation(null);
      return;
    }

    try {
      const response = await fetch(`/api/harbor/subscribers/${encodeURIComponent(subscriberEmail)}/handles/suggestions?handle=${encodeURIComponent(handle)}`);
      
      if (response.ok) {
        const data = await response.json() as HandleValidationResponse;
        setHandleValidation(data.data);
      }
    } catch (err) {
      console.error('Handle validation error:', err);
    }
  };

  const createHandle = async () => {
    if (!formData.handle.trim() || !formData.displayName.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const response = await fetch(`/api/harbor/subscribers/${encodeURIComponent(subscriberEmail)}/handles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error || 'Failed to create handle');
      }

      const data = await response.json() as ApiResponse<SubscriberHandle>;
      setHandles(prev => [data.data, ...prev]);
      setShowCreateForm(false);
      setFormData({ handle: '', displayName: '', description: '', isPublic: true });
      setHandleValidation(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create handle');
    } finally {
      setCreating(false);
    }
  };

  const toggleHandleStatus = async (handleId: number, isActive: boolean) => {
    try {
      const response = await fetch(`/api/harbor/subscribers/${encodeURIComponent(subscriberEmail)}/handles/${handleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive })
      });

      if (!response.ok) {
        throw new Error('Failed to update handle status');
      }

      setHandles(prev => prev.map(handle => 
        handle.Id === handleId ? { ...handle, IsActive: isActive } : handle
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update handle status');
    }
  };

  const togglePublicStatus = async (handleId: number, isPublic: boolean) => {
    try {
      const response = await fetch(`/api/harbor/subscribers/${encodeURIComponent(subscriberEmail)}/handles/${handleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic })
      });

      if (!response.ok) {
        throw new Error('Failed to update public status');
      }

      setHandles(prev => prev.map(handle => 
        handle.Id === handleId ? { ...handle, IsPublic: isPublic } : handle
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update public status');
    }
  };

  const startEditHandle = (handle: SubscriberHandle) => {
    setEditingHandle(handle);
    setFormData({
      handle: handle.Handle,
      displayName: handle.DisplayName,
      description: handle.Description || '',
      isPublic: handle.IsPublic
    });
    setShowEditForm(true);
  };

  const updateHandle = async () => {
    if (!editingHandle || !formData.displayName.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setUpdating(true);
      setError(null);

      const response = await fetch(`/api/harbor/subscribers/${encodeURIComponent(subscriberEmail)}/handles/${editingHandle.Id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isPublic: formData.isPublic
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update handle');
      }

      // Refresh handles list
      fetchHandles();
      
      // Reset form
      setShowEditForm(false);
      setEditingHandle(null);
      setFormData({ handle: '', displayName: '', description: '', isPublic: true });
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update handle');
    } finally {
      setUpdating(false);
    }
  };

  const deleteHandle = async (handleId: number) => {
    if (!confirm(t('subscriber_pages.handles.delete_confirm'))) {
      return;
    }

    try {
      setError(null);

      const response = await fetch(`/api/harbor/subscribers/${encodeURIComponent(subscriberEmail)}/handles/${handleId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete handle');
      }

      // Refresh handles list
      fetchHandles();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete handle');
    }
  };

  if (loading) {
    return (
      <Card>
        <Box p="6">
          <Flex justify="center" align="center">
            <Text size="5">{t('common.loading')}</Text>
          </Flex>
        </Box>
      </Card>
    );
  }

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Overview Section */}
      <Card>
        <Box p="6">
          <Flex justify="between" align="center" mb="4">
            <Box>
              <Heading size="6" mb="2">
                {t('subscriber_pages.handles.title')}
              </Heading>
              <Text color="gray">
                {t('subscriber_pages.handles.description')}
              </Text>
            </Box>
            {handleLimit && (
              <Card style={{ backgroundColor: 'var(--blue-2)', border: '1px solid var(--blue-6)' }}>
                <Box p="3">
                  <Text size="2" weight="medium" color="blue">
                    {t('subscriber_pages.handles.limit_info', {
                      current: handles.length,
                      max: handleLimit.MaxHandles,
                      type: handleLimit.LimitType
                    })}
                  </Text>
                </Box>
              </Card>
            )}
          </Flex>

          {/* Error Display */}
          {error && (
            <Card style={{ backgroundColor: 'var(--red-2)', border: '1px solid var(--red-6)' }} mb="4">
              <Box p="4">
                <Text color="red">{error}</Text>
              </Box>
            </Card>
          )}

          {/* Create Handle Button */}
          {handles.length === 0 || (handleLimit && handles.length < handleLimit.MaxHandles) ? (
            <Flex justify="end">
              <Button
                onClick={() => setShowCreateForm(true)}
                disabled={showCreateForm}
                variant="solid"
                size="3"
              >
                {t('subscriber_pages.handles.create_new')}
              </Button>
            </Flex>
          ) : handleLimit && (
            <Flex justify="end">
              <Text color="gray" size="2">
                {t('subscriber_pages.handles.limit_reached', {
                  current: handles.length,
                  max: handleLimit.MaxHandles
                })}
              </Text>
            </Flex>
          )}
        </Box>
      </Card>

      {/* Create Handle Form Section */}
      {showCreateForm && (
        <Card style={{ backgroundColor: 'var(--gray-2)', border: '2px solid var(--blue-6)' }}>
          <Box p="6">
            <Heading size="5" mb="4" color="blue">
              {t('subscriber_pages.handles.create_form.title')}
            </Heading>
            
            <Box style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Handle Input */}
              <Box>
                <Text weight="medium" size="3" mb="2">
                  {t('subscriber_pages.handles.create_form.handle')}
                </Text>
                <Flex align="center">
                  <Text color="gray" mr="2" size="3">logosophe.com/</Text>
                  <TextField.Root style={{ flex: 1 }}>
                    <TextField.Input
                      value={formData.handle}
                      onChange={(e) => handleInputChange('handle', e.target.value)}
                      placeholder={t('subscriber_pages.handles.create_form.handle_placeholder')}
                      size="3"
                    />
                  </TextField.Root>
                </Flex>
                {handleValidation && (
                  <Box mt="2">
                    {handleValidation.isValid ? (
                      <Text color="green" size="2">
                        ✓ {t('subscriber_pages.handles.create_form.handle_available')}
                      </Text>
                    ) : (
                      <Box>
                        {handleValidation.errors.map((error, index) => (
                          <Text key={index} color="red" size="2">• {error}</Text>
                        ))}
                        {handleValidation.suggestions && handleValidation.suggestions.length > 0 && (
                          <Box mt="2">
                            <Text weight="medium" size="2" mb="1">
                              {t('subscriber_pages.handles.create_form.suggestions')}:
                            </Text>
                            <Flex wrap="wrap" gap="2">
                              {handleValidation.suggestions.map((suggestion, index) => (
                                <Button
                                  key={index}
                                  onClick={() => handleInputChange('handle', suggestion)}
                                  variant="ghost"
                                  size="1"
                                >
                                  {suggestion}
                                </Button>
                              ))}
                            </Flex>
                          </Box>
                        )}
                      </Box>
                    )}
                  </Box>
                )}
              </Box>

              {/* Display Name Input */}
              <Box>
                <Text weight="medium" size="3" mb="2">
                  {t('subscriber_pages.handles.create_form.display_name')}
                </Text>
                <TextField.Root>
                  <TextField.Input
                    value={formData.displayName}
                    onChange={(e) => handleInputChange('displayName', e.target.value)}
                    placeholder={t('subscriber_pages.handles.create_form.display_name_placeholder')}
                    size="3"
                  />
                </TextField.Root>
              </Box>

              {/* Description Input */}
              <Box>
                <Text weight="medium" size="3" mb="2">
                  {t('subscriber_pages.handles.create_form.description')}
                </Text>
                <TextArea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder={t('subscriber_pages.handles.create_form.description_placeholder')}
                  name="description"
                />
              </Box>

              {/* Public Toggle */}
              <Flex align="center">
                <Checkbox
                  id="isPublic"
                  checked={formData.isPublic}
                  onCheckedChange={(checked) => handleInputChange('isPublic', checked as boolean)}
                />
                <Text as="label" htmlFor="isPublic" ml="2" size="3">
                  {t('subscriber_pages.handles.create_form.public_page')}
                </Text>
              </Flex>

              <Separator />

              {/* Form Actions */}
              <Flex justify="end" gap="3">
                <Button
                  onClick={() => {
                    setShowCreateForm(false);
                    setFormData({ handle: '', displayName: '', description: '', isPublic: true });
                    setHandleValidation(null);
                  }}
                  variant="soft"
                  size="3"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={createHandle}
                  disabled={creating || !handleValidation?.isValid}
                  variant="solid"
                  size="3"
                >
                  {creating ? t('common.creating') : t('common.create')}
                </Button>
              </Flex>
            </Box>
          </Box>
        </Card>
      )}

      {/* Edit Handle Form Section */}
      {showEditForm && editingHandle && (
        <Card style={{ backgroundColor: 'var(--gray-2)', border: '2px solid var(--orange-6)' }}>
          <Box p="6">
            <Heading size="5" mb="4" color="orange">
              {t('subscriber_pages.handles.edit_form.title')} - {editingHandle.Handle}
            </Heading>
            
            <Box style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Handle Display (Read-only) */}
              <Box>
                <Text weight="medium" size="3" mb="2">
                  {t('subscriber_pages.handles.edit_form.page_url')}
                </Text>
                <Flex align="center">
                  <Text color="gray" mr="2" size="3">logosophe.com/</Text>
                  <Text size="3" style={{ fontFamily: 'monospace', backgroundColor: 'var(--gray-3)', padding: '0.5rem', borderRadius: '4px' }}>
                    {editingHandle.Handle}
                  </Text>
                </Flex>
                <Text size="2" color="gray" mt="1">
                  {t('subscriber_pages.handles.edit_form.url_info')}
                </Text>
              </Box>

              {/* Display Name Input */}
              <Box>
                <Text weight="medium" size="3" mb="2">
                  {t('subscriber_pages.handles.create_form.display_name')}
                </Text>
                <TextField.Root>
                  <TextField.Input
                    value={formData.displayName}
                    onChange={(e) => handleInputChange('displayName', e.target.value)}
                    placeholder={t('subscriber_pages.handles.create_form.display_name_placeholder')}
                    size="3"
                  />
                </TextField.Root>
              </Box>

              {/* Description Input */}
              <Box>
                <Text weight="medium" size="3" mb="2">
                  {t('subscriber_pages.handles.create_form.description')}
                </Text>
                <TextArea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder={t('subscriber_pages.handles.create_form.description_placeholder')}
                  name="description"
                />
              </Box>

              {/* Public Toggle */}
              <Flex align="center">
                <Checkbox
                  id="editIsPublic"
                  checked={formData.isPublic}
                  onCheckedChange={(checked) => handleInputChange('isPublic', checked as boolean)}
                />
                <Text as="label" htmlFor="editIsPublic" ml="2" size="3">
                  {t('subscriber_pages.handles.create_form.public_page')}
                </Text>
              </Flex>

              <Separator />

              {/* Form Actions */}
              <Flex justify="end" gap="3">
                <Button
                  onClick={() => {
                    setShowEditForm(false);
                    setEditingHandle(null);
                    setFormData({ handle: '', displayName: '', description: '', isPublic: true });
                  }}
                  variant="soft"
                  size="3"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={updateHandle}
                  disabled={updating}
                  variant="solid"
                  size="3"
                >
                  {updating ? t('common.updating') : t('common.update')}
                </Button>
              </Flex>
            </Box>
          </Box>
        </Card>
      )}

      {/* Handles List Section */}
      <Card>
        <Box p="6">
          <Heading size="5" mb="4">
            {t('subscriber_pages.handles.your_handles')} ({handles.length})
          </Heading>

          <Box style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {!Array.isArray(handles) ? (
              <Box py="6">
                <Flex justify="center" align="center">
                  <Text color="red" size="5">{t('common.loading')}</Text>
                </Flex>
              </Box>
            ) : handles.length === 0 ? (
              <Card style={{ backgroundColor: 'var(--gray-2)' }}>
                <Box p="6">
                  <Flex direction="column" align="center" gap="3">
                    <Text color="gray" size="5">{t('subscriber_pages.handles.no_handles')}</Text>
                    <Button
                      onClick={() => setShowCreateForm(true)}
                      variant="solid"
                      size="3"
                    >
                      {t('subscriber_pages.handles.create_first')}
                    </Button>
                  </Flex>
                </Box>
              </Card>
            ) : (
              handles.map((handle) => (
                <Card key={handle.Id} style={{ border: '1px solid var(--gray-6)' }}>
                  <Box p="5">
                    <Flex justify="between" align="start">
                      <Box style={{ flex: 1 }}>
                        <Flex align="center" gap="3" mb="3">
                          <Heading size="4">{handle.DisplayName}</Heading>
                          <Badge color={handle.IsActive ? "green" : "gray"} size="2">
                            {handle.IsActive ? t('common.active') : t('common.inactive')}
                          </Badge>
                          <Badge color={handle.IsPublic ? "blue" : "orange"} size="2">
                            {handle.IsPublic ? t('common.public') : t('common.private')}
                          </Badge>
                        </Flex>
                        <Box mb="3">
                          <Text color="gray" size="3">
                            <strong>URL:</strong> logosophe.com/{handle.Handle}
                          </Text>
                        </Box>
                        {handle.Description ? (
                          <Box mb="3">
                            <Text color="gray" size="3">{handle.Description}</Text>
                          </Box>
                        ) : null}
                        <Box>
                          <Text size="2" color="gray">
                            <strong>Created:</strong> {new Date(handle.CreatedAt).toLocaleDateString()}
                          </Text>
                        </Box>
                      </Box>
                      <Flex gap="2">
                        {/* Edit Button - Always visible */}
                        <Button
                          onClick={() => startEditHandle(handle)}
                          variant="outline"
                          size="2"
                        >
                          {t('common.edit')}
                        </Button>
                        
                        {/* Status Toggle Button */}
                        <Button
                          onClick={() => toggleHandleStatus(handle.Id, !handle.IsActive)}
                          variant={handle.IsActive ? "soft" : "solid"}
                          size="2"
                        >
                          {handle.IsActive ? t('common.deactivate') : t('common.activate')}
                        </Button>
                        
                        {/* Public/Private Toggle Button */}
                        <Button
                          onClick={() => togglePublicStatus(handle.Id, !handle.IsPublic)}
                          variant={handle.IsPublic ? "soft" : "solid"}
                          color={handle.IsPublic ? "blue" : "orange"}
                          size="2"
                          disabled={!handle.IsActive}
                          title={!handle.IsActive ? t('subscriber_pages.handles.public_disabled_inactive') : undefined}
                        >
                          {handle.IsPublic ? t('common.make_private') : t('common.make_public')}
                        </Button>
                        
                        {/* View Button - Shows different URLs based on public/private status */}
                        <Button
                          onClick={() => {
                            const url = handle.IsPublic 
                              ? `/pages/${handle.Handle}`  // Public URL
                              : `/harbor/preview/${handle.Handle}`; // Internal preview URL
                            window.open(url, '_blank');
                          }}
                          variant="outline"
                          size="2"
                          disabled={!handle.IsActive}
                          title={!handle.IsActive 
                            ? t('subscriber_pages.handles.view_disabled_inactive') 
                            : handle.IsPublic 
                              ? t('subscriber_pages.handles.view_public_url')
                              : t('subscriber_pages.handles.view_internal_preview')
                          }
                        >
                          {handle.IsPublic ? t('common.view') : t('common.preview')}
                        </Button>
                        
                        {/* Delete Button - Always visible */}
                        <Button
                          onClick={() => deleteHandle(handle.Id)}
                          variant="soft"
                          color="red"
                          size="2"
                        >
                          {t('common.delete')}
                        </Button>
                      </Flex>
                    </Flex>
                  </Box>
                </Card>
              ))
            )}
          </Box>
        </Box>
      </Card>
    </Box>
  );
}
