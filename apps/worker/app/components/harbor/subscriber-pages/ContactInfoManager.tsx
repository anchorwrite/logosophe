'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Button, Card, Flex, Heading, Text, TextField, Badge, Dialog, Switch } from '@radix-ui/themes';
import { Plus, Edit, Trash2, Eye, Globe, Lock, Mail, Phone, Globe as GlobeIcon, MapPin, Share2, MessageSquare } from 'lucide-react';
import { SubscriberContactInfo, SubscriberHandle } from '@/types/subscriber-pages';

interface ContactInfoManagerProps {
  subscriberEmail: string;
}

export default function ContactInfoManager({ subscriberEmail }: ContactInfoManagerProps) {
  const { t } = useTranslation('translations');
  const [contactInfos, setContactInfos] = useState<SubscriberContactInfo[]>([]);
  const [handles, setHandles] = useState<Array<{ Id: number; Handle: string; DisplayName: string; IsActive: boolean }>>([]);
  const [handlesLoading, setHandlesLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [editingContactInfo, setEditingContactInfo] = useState<SubscriberContactInfo | null>(null);
  const [previewContactInfo, setPreviewContactInfo] = useState<SubscriberContactInfo | null>(null);
  
  // Form state
  const [selectedHandleId, setSelectedHandleId] = useState<number | null>(null);
  const [contactEmail, setContactEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [location, setLocation] = useState('');
  const [socialLinks, setSocialLinks] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [language, setLanguage] = useState('en');

  useEffect(() => {
    fetchContactInfos();
    fetchHandles();
  }, [subscriberEmail]);

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
    } finally {
      setHandlesLoading(false);
    }
  };

  const fetchContactInfos = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/harbor/subscribers/${subscriberEmail}/contact-info`);
      if (response.ok) {
        const data = await response.json() as { success: boolean; data: SubscriberContactInfo[] };
        if (data.success) {
          setContactInfos(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching contact info:', error);
      setError('Failed to load contact info');
    } finally {
      setLoading(false);
    }
  };



  const resetForm = () => {
    setSelectedHandleId(null);
    setContactEmail('');
    setPhone('');
    setWebsite('');
    setLocation('');
    setSocialLinks('');
    setIsPublic(true);
    setLanguage('en');
    setEditingContactInfo(null);
  };

  const handleCreate = () => {
    resetForm();
    setShowCreateDialog(true);
  };

  const handleEdit = (contactInfo: SubscriberContactInfo) => {
    setEditingContactInfo(contactInfo);
    setSelectedHandleId(contactInfo.HandleId);
    setContactEmail(contactInfo.Email || '');
    setPhone(contactInfo.Phone || '');
    setWebsite(contactInfo.Website || '');
    setLocation(contactInfo.Location || '');
    setSocialLinks(contactInfo.SocialLinks || '');
    setIsPublic(contactInfo.IsPublic);
    setLanguage(contactInfo.Language);
    setShowEditDialog(true);
  };

  const handlePreview = (contactInfo: SubscriberContactInfo) => {
    setPreviewContactInfo(contactInfo);
    setShowPreviewDialog(true);
  };

  const reloadData = async () => {
    try {
      await Promise.all([
        fetchContactInfos(),
        fetchHandles()
      ]);
    } catch (error) {
      console.error('Error reloading data:', error);
    }
  };

  const handleSubmit = async () => {
    if (!selectedHandleId) {
      setError('Please select a handle');
      return;
    }

    try {
      const url = editingContactInfo 
        ? `/api/harbor/subscribers/${subscriberEmail}/contact-info/${editingContactInfo.Id}`
        : `/api/harbor/subscribers/${subscriberEmail}/contact-info`;
      
      const method = editingContactInfo ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handleId: selectedHandleId,
          contactEmail: contactEmail.trim() || null,
          phone: phone.trim() || null,
          website: website.trim() || null,
          location: location.trim() || null,
          socialLinks: socialLinks.trim() || null,
          isPublic,
          language
        })
      });

      if (response.ok) {
        await reloadData();
        setShowCreateDialog(false);
        setShowEditDialog(false);
        resetForm();
        setError(null);
      } else {
        const errorData = await response.json() as { error?: string };
        setError(errorData.error || 'Failed to save contact info');
      }
    } catch (error) {
      console.error('Error saving contact info:', error);
      setError('Failed to save contact info');
    }
  };

  const handleDelete = async (contactInfoId: number) => {
    if (!confirm('Are you sure you want to delete this contact info?')) return;

    try {
      const response = await fetch(`/api/harbor/subscribers/${subscriberEmail}/contact-info/${contactInfoId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await reloadData();
      }
    } catch (error) {
      console.error('Error deleting contact info:', error);
    }
  };

  const handleContactFormToggle = async (handleId: number, enabled: boolean) => {
    try {
      const contactInfo = contactInfos.find(ci => ci.HandleId === handleId);
      if (!contactInfo) {
        setError('Contact info not found for this handle');
        return;
      }

      const response = await fetch(`/api/harbor/subscribers/${encodeURIComponent(subscriberEmail)}/contact-info/${contactInfo.Id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...contactInfo,
          contactFormEnabled: enabled
        }),
      });

      if (response.ok) {
        // Update local state
        setContactInfos(prev => prev.map(ci => 
          ci.Id === contactInfo.Id 
            ? { ...ci, ContactFormEnabled: enabled }
            : ci
        ));
        setError(null);
      } else {
        setError('Failed to update contact form setting');
      }
    } catch (error) {
      console.error('Error updating contact form setting:', error);
      setError('Failed to update contact form setting');
    }
  };

  if (loading) {
    return (
      <Box>
        <Text>{t('subscriber_pages.contact_info.loading')}</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Flex justify="between" align="center" mb="4">
        <Heading size="5">{t('subscriber_pages.contact_info.title')}</Heading>
        <Button onClick={handleCreate}>
          <Plus size={16} />
          {t('subscriber_pages.contact_info.create')}
        </Button>
      </Flex>

      {error && (
        <Box mb="4" p="3" style={{ backgroundColor: 'var(--red-2)', borderRadius: 'var(--radius-2)' }}>
          <Text color="red">{error}</Text>
        </Box>
      )}

      {loading ? (
        <Card>
          <Box p="6" style={{ textAlign: 'center' }}>
            <Text color="gray">Loading contact information...</Text>
          </Box>
        </Card>
      ) : contactInfos && contactInfos.length === 0 ? (
        <Card>
          <Box p="6" style={{ textAlign: 'center' }}>
            <Text color="gray">{t('subscriber_pages.contact_info.no_contact_info')}</Text>
          </Box>
        </Card>
      ) : contactInfos && contactInfos.length > 0 ? (
        <Box style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {contactInfos.map((contactInfo) => (
            <Card key={contactInfo.Id}>
              <Box p="4">
                <Flex justify="between" align="start" mb="3">
                  <Box style={{ flex: 1 }}>
                    <Text size="3" weight="bold" mb="2" style={{ display: 'block' }}>
                      {contactInfo.HandleDisplayName || `Handle ${contactInfo.HandleId}`}
                    </Text>
                    
                    <Flex gap="3" wrap="wrap" mb="2">
                      {contactInfo.Email && (
                        <Flex gap="1" align="center">
                          <Mail size={14} />
                          <Text size="2" color="gray">{contactInfo.Email}</Text>
                        </Flex>
                      )}
                      {contactInfo.Phone && (
                        <Flex gap="1" align="center">
                          <Phone size={14} />
                          <Text size="2" color="gray">{contactInfo.Phone}</Text>
                        </Flex>
                      )}
                      {contactInfo.Website && (
                        <Flex gap="1" align="center">
                          <GlobeIcon size={14} />
                          <Text size="2" color="gray">{contactInfo.Website}</Text>
                        </Flex>
                      )}
                      {contactInfo.Location && (
                        <Flex gap="1" align="center">
                          <MapPin size={14} />
                          <Text size="2" color="gray">{contactInfo.Location}</Text>
                        </Flex>
                      )}
                    </Flex>

                    <Flex gap="2" align="center">
                      <Badge color={contactInfo.IsPublic ? 'green' : 'orange'}>
                        {contactInfo.IsPublic ? t('common.public') : t('common.private')}
                      </Badge>
                      <Badge color="blue">
                        {contactInfo.Language.toUpperCase()}
                      </Badge>
                      <Text size="1" color="gray">
                        {new Date(contactInfo.UpdatedAt).toLocaleDateString()}
                      </Text>
                    </Flex>
                  </Box>
                  <Flex gap="2">
                    <Button size="1" variant="soft" onClick={() => handlePreview(contactInfo)}>
                      <Eye size={14} />
                      {t('common.preview')}
                    </Button>
                    <Button size="1" variant="soft" onClick={() => handleEdit(contactInfo)}>
                      <Edit size={14} />
                      {t('common.edit')}
                    </Button>
                    <Button size="1" variant="soft" color="red" onClick={() => handleDelete(contactInfo.Id)}>
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
            {editingContactInfo ? t('subscriber_pages.contact_info.edit_contact_info') : t('subscriber_pages.contact_info.create_contact_info')}
          </Dialog.Title>
          
          <Box mt="4">
            <Box mb="4">
              <Text size="2" color="gray" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>
                {t('subscriber_pages.contact_info.handle_label')} *
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

            <Flex gap="4" mb="4">
              <Box style={{ flex: 1 }}>
                <Text size="2" color="gray" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>
                  {t('subscriber_pages.contact_info.email_label')}
                </Text>
                <TextField.Input
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder={t('subscriber_pages.contact_info.email_placeholder')}
                />
              </Box>
              <Box style={{ flex: 1 }}>
                <Text size="2" color="gray" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>
                  {t('subscriber_pages.contact_info.phone_label')}
                </Text>
                <TextField.Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t('subscriber_pages.contact_info.phone_placeholder')}
                />
              </Box>
            </Flex>

            <Box mb="4">
              <Text size="2" color="gray" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>
                {t('subscriber_pages.contact_info.website_label')}
              </Text>
              <TextField.Input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder={t('subscriber_pages.contact_info.website_placeholder')}
              />
            </Box>

            <Box mb="4">
              <Text size="2" color="gray" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>
                {t('subscriber_pages.contact_info.location_label')}
              </Text>
              <TextField.Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t('subscriber_pages.contact_info.location_placeholder')}
              />
            </Box>

            <Box mb="4">
              <Text size="2" color="gray" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>
                {t('subscriber_pages.contact_info.social_links_label')}
              </Text>
              <TextField.Input
                value={socialLinks}
                onChange={(e) => setSocialLinks(e.target.value)}
                placeholder={t('subscriber_pages.contact_info.social_links_placeholder')}
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
              {editingContactInfo ? t('common.update') : t('common.create')}
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

      {/* Contact Form Settings */}
      <Card style={{ marginTop: '2rem' }}>
        <Box p="4">
          <Heading size="4" style={{ marginBottom: '1rem' }}>
            <Flex gap="2" align="center">
              <MessageSquare size={20} />
              {t('subscriber_pages.contact_form.title', { defaultValue: 'Contact Form Settings' })}
            </Flex>
          </Heading>
          
          <Text color="gray" size="2" style={{ marginBottom: '1.5rem', display: 'block' }}>
            {t('subscriber_pages.contact_form.description', { defaultValue: 'Enable or disable contact forms for your handles. Contact forms will use the email address from your contact info.' })}
          </Text>
          
          {handlesLoading ? (
            <Text color="gray" size="2">
              {t('common.loading', { defaultValue: 'Loading...' })}
            </Text>
          ) : (
            <Flex direction="column" gap="3">
              {handles.map((handle) => {
                const contactInfo = contactInfos.find(ci => ci.HandleId === handle.Id);
                const hasContactInfo = !!contactInfo?.Email;
                
                return (
                  <Box key={handle.Id} style={{ border: '1px solid var(--gray-6)', borderRadius: '8px', padding: '1rem' }}>
                    <Flex justify="between" align="center" style={{ marginBottom: '1rem' }}>
                      <Box>
                        <Heading size="3" style={{ marginBottom: '0.5rem' }}>
                          {handle.DisplayName}
                        </Heading>
                        <Text size="2" color="gray" style={{ marginBottom: '0.5rem' }}>
                          @{handle.Handle}
                        </Text>
                        {hasContactInfo ? (
                          <Text size="2" color="green">
                            {t('subscriber_pages.contact_form.contact_email_available', { defaultValue: 'Contact email available' })}
                          </Text>
                        ) : (
                          <Text size="2" color="orange">
                            {t('subscriber_pages.contact_form.no_contact_email', { defaultValue: 'No contact email set' })}
                          </Text>
                        )}
                      </Box>
                      
                      <Flex align="center" gap="2">
                        {hasContactInfo ? (
                          <Switch 
                            checked={contactInfo?.ContactFormEnabled ?? false}
                            onCheckedChange={(enabled) => handleContactFormToggle(handle.Id, enabled)}
                            disabled={!hasContactInfo}
                          />
                        ) : (
                          <Switch 
                            checked={false}
                            disabled={true}
                          />
                        )}
                        <Text size="2" color="gray">
                          {hasContactInfo ? 
                            (contactInfo?.ContactFormEnabled ? 
                              t('subscriber_pages.contact_form.enabled', { defaultValue: 'Enabled' }) : 
                              t('subscriber_pages.contact_form.disabled', { defaultValue: 'Disabled' })
                            ) : 
                            t('subscriber_pages.contact_form.unavailable', { defaultValue: 'Unavailable' })
                          }
                        </Text>
                      </Flex>
                    </Flex>
                    
                    {!hasContactInfo && (
                      <Box style={{ backgroundColor: 'var(--orange-3)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--orange-6)' }}>
                        <Text size="2" color="orange">
                          {t('subscriber_pages.contact_form.add_contact_info_prompt', { defaultValue: 'Add contact info with an email address to enable the contact form for this handle.' })}
                        </Text>
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Flex>
          )}
        </Box>
      </Card>

      {/* Preview Dialog */}
      <Dialog.Root open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <Dialog.Content style={{ maxWidth: '600px' }}>
          <Dialog.Title>{t('common.preview')}</Dialog.Title>
          
          {previewContactInfo && (
            <Box mt="4">
              <Box mb="4">
                <Text size="2" color="gray" mb="2" style={{ display: 'block' }}>
                  {t('subscriber_pages.contact_info.handle_label')}
                </Text>
                <Text weight="bold">
                  {previewContactInfo.HandleDisplayName || `Handle ${previewContactInfo.HandleId}`}
                </Text>
              </Box>

              <Box style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {previewContactInfo.Email && (
                  <Flex gap="2" align="center">
                    <Mail size={16} />
                    <Text>{previewContactInfo.Email}</Text>
                  </Flex>
                )}
                {previewContactInfo.Phone && (
                  <Flex gap="2" align="center">
                    <Phone size={16} />
                    <Text>{previewContactInfo.Phone}</Text>
                  </Flex>
                )}
                {previewContactInfo.Website && (
                  <Flex gap="2" align="center">
                    <GlobeIcon size={16} />
                    <Text>{previewContactInfo.Website}</Text>
                  </Flex>
                )}
                {previewContactInfo.Location && (
                  <Flex gap="2" align="center">
                    <MapPin size={16} />
                    <Text>{previewContactInfo.Location}</Text>
                  </Flex>
                )}
                {previewContactInfo.SocialLinks && (
                  <Flex gap="2" align="center">
                    <Share2 size={16} />
                    <Text>{previewContactInfo.SocialLinks}</Text>
                  </Flex>
                )}
              </Box>

              <Flex gap="2" align="center" mt="4">
                <Badge color={previewContactInfo.IsPublic ? 'green' : 'orange'}>
                  {previewContactInfo.IsPublic ? t('common.public') : t('common.private')}
                </Badge>
                <Badge color="blue">
                  {previewContactInfo.Language.toUpperCase()}
                </Badge>
                <Text size="2" color="gray">
                  {new Date(previewContactInfo.UpdatedAt).toLocaleDateString()}
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
