'use client'

import { useState, useEffect } from 'react';
import { Button, TextField, Text, Box, Card, Flex, Grid, Tabs, Avatar, Dialog } from '@radix-ui/themes';
import type { Session } from 'next-auth';
import { useToast } from '@/components/Toast';
import { useTranslation } from 'react-i18next';

interface UserAvatar {
  Id: number;
  R2Key: string;
  IsPreset: boolean;
  UserId?: string;
}

interface ProfileFormData {
  name: string;
  email: string;
}

interface ApiResponse {
  avatars?: UserAvatar[];
  avatarId?: number;
  success?: boolean;
  message?: string;
}

interface PasswordResponse {
  message: string;
}

interface ProfileFormProps {
  session: Session | null;
  updateName: (formData: FormData) => Promise<void>;
  updateEmail: (formData: FormData) => Promise<void>;
  isAdminUser: boolean;
}

export default function ProfileForm({ session, updateName, updateEmail, isAdminUser }: ProfileFormProps) {
  const { showToast } = useToast();
  const { t, i18n } = useTranslation('translations');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingName, setIsLoadingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [presetAvatars, setPresetAvatars] = useState<UserAvatar[]>([]);
  const [customAvatars, setCustomAvatars] = useState<UserAvatar[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [uploadedAvatar, setUploadedAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showEmailConfirm, setShowEmailConfirm] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<ProfileFormData | null>(null);
  const [formData, setFormData] = useState<ProfileFormData>({
    name: '',
    email: session?.user?.email || ''
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    fetchPresetAvatars();
    fetchCustomAvatars();
    fetchCurrentAvatar();
    fetchUserName();
  }, [session?.user?.email]);

  const fetchCurrentAvatar = async () => {
    try {
      const response = await fetch('/api/user/avatar');
      if (response.ok) {
        const data = await response.json() as ApiResponse;
        if (data.avatarId) {
          setSelectedAvatar(data.avatarId.toString());
        }
      }
    } catch (error) {
      console.error('Error fetching current avatar:', error);
    }
  };

  const fetchPresetAvatars = async () => {
    try {
      const response = await fetch('/api/preset-avatars');
      const data = await response.json() as ApiResponse;
      if (data.avatars) {
        setPresetAvatars(data.avatars);
      }
    } catch (error) {
      console.error('Error fetching preset avatars:', error);
      showToast({
        title: t('common.status.error'),
        content: t('profile.messages.failedToUpdateAvatar'),
        type: 'error'
      });
    }
  };

  const fetchCustomAvatars = async () => {
    try {
      const response = await fetch('/api/avatars');
      const data = await response.json() as ApiResponse;
      if (data.avatars) {
        setCustomAvatars(data.avatars);
      }
    } catch (error) {
      console.error('Error fetching custom avatars:', error);
      showToast({
        title: t('common.status.error'),
        content: t('profile.messages.failedToUpdateAvatar'),
        type: 'error'
      });
    }
  };

  const fetchUserName = async () => {
    try {
      setIsLoadingName(true);
      setNameError(null);
      const response = await fetch('/api/user/profile');
      if (response.ok) {
        const data = await response.json() as { name?: string; email?: string; image?: string };
        // Handle both null/undefined and empty string cases
        if (data.name && data.name.trim() !== '') {
          setFormData(prev => ({
            ...prev,
            name: data.name as string
          }));
        }
      } else {
        setNameError('Failed to fetch profile information');
      }
    } catch (error) {
      console.error('Error fetching user name:', error);
      setNameError('Failed to fetch profile information');
    } finally {
      setIsLoadingName(false);
    }
  };



  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedAvatar(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePresetSelect = async (avatarId: number) => {
    try {
      const response = await fetch('/api/user/avatar', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ avatarId }),
      });
      
      if (!response.ok) {
        const errorData = await response.json() as { message?: string };
        throw new Error(errorData.message || 'Failed to update avatar');
      }

      const responseData = await response.json();
      
      setSelectedAvatar(avatarId.toString());
      showToast({
        title: t('common.status.success'),
        content: t('profile.messages.avatarUpdatedSuccessfully'),
        type: 'success'
      });
    } catch (error) {
      console.error('Error selecting avatar:', error);
      showToast({
        title: t('common.status.error'),
        content: t('profile.messages.failedToUpdateAvatar'),
        type: 'error'
      });
    }
  };

  const handleDeleteAvatar = async (avatarId: number) => {
    try {
      const response = await fetch(`/api/avatars/${avatarId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json() as { message?: string };
        throw new Error(errorData.message || 'Failed to delete avatar');
      }

      const responseData = await response.json();

      showToast({
        title: t('common.status.success'),
        content: t('profile.messages.avatarDeletedSuccessfully'),
        type: 'success'
      });
      // Refresh the avatar list
      await fetchPresetAvatars();
    } catch (error) {
      console.error('Error deleting avatar:', error);
      showToast({
        title: t('common.status.error'),
        content: t('profile.messages.failedToDeleteAvatar'),
        type: 'error'
      });
    }
  };

  const handleCustomUpload = async () => {
    if (!uploadedAvatar) return;

    const formData = new FormData();
    formData.append('file', uploadedAvatar);

    try {
      const response = await fetch('/api/avatars', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json() as ApiResponse;
      if (response.ok && data.avatarId) {
        setSelectedAvatar(data.avatarId.toString());
        showToast({
          title: t('common.status.success'),
          content: t('profile.messages.avatarUploadedSuccessfully'),
          type: 'success'
        });
        // Refresh both avatar lists
        await Promise.all([
          fetchPresetAvatars(),
          fetchCustomAvatars()
        ]);
        // Clear the upload state
        setUploadedAvatar(null);
        setAvatarPreview(null);
      } else {
        showToast({
          title: t('common.status.error'),
          content: t('profile.messages.failedToUploadAvatar'),
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      showToast({
        title: t('common.status.error'),
        content: t('profile.messages.failedToUploadAvatar'),
        type: 'error'
      });
    }
  };

  const handlePresetUpload = async () => {
    if (!uploadedAvatar) return;

    const formData = new FormData();
    formData.append('file', uploadedAvatar);

    try {
      // Test if the route exists by making a simple request first
      const testResponse = await fetch('/api/preset-avatars', { method: 'GET' });
      
      const response = await fetch('/api/preset-avatars', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json() as ApiResponse;
      if (response.ok && data.avatarId) {
        showToast({
          title: t('common.status.success'),
          content: t('profile.messages.presetAvatarUploadedSuccessfully'),
          type: 'success'
        });
        // Refresh the avatar list
        fetchPresetAvatars();
        // Clear the upload state
        setUploadedAvatar(null);
        setAvatarPreview(null);
      } else {
        showToast({
          title: t('common.status.error'),
          content: t('profile.messages.failedToUploadPresetAvatar'),
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error uploading preset avatar:', error);
      showToast({
        title: t('common.status.error'),
        content: t('profile.messages.failedToUploadPresetAvatar'),
        type: 'error'
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Show dialog if email field was modified at all
    if (formData.email !== session?.user?.email) {
      setPendingUpdate(formData);
      setShowEmailConfirm(true);
      return;
    }
    
    await submitProfileUpdate(formData);
  };

  const submitProfileUpdate = async (data: ProfileFormData) => {
    setIsLoading(true);
    try {
      // Update profile information
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.name,
          email: data.email
        }),
      });

      if (response.ok) {
        const responseData = await response.json();
        showToast({
          title: t('common.status.success'),
          content: t('profile.messages.profileUpdatedSuccessfully'),
          type: 'success'
        });
        // Reset the form state
        setPendingUpdate(null);
        setShowEmailConfirm(false);
        
        // Reload the page to refresh the session
        window.location.reload();
      } else {
        const errorData = await response.json() as { message?: string };
        console.error('Profile update failed:', errorData);
        showToast({
          title: t('common.status.error'),
          content: errorData.message || t('profile.messages.failedToUpdateProfile'),
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      showToast({
        title: t('common.status.error'),
        content: t('profile.messages.failedToUpdateProfile'),
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailConfirm = () => {
    if (pendingUpdate) {
      submitProfileUpdate(pendingUpdate);
    }
  };

  const handleEmailCancel = () => {
    // Reset email to original value
    setFormData(prev => ({
      ...prev,
      email: session?.user?.email || ''
    }));
    setPendingUpdate(null);
    setShowEmailConfirm(false);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast({
        title: t('common.status.error'),
        content: t('profile.messages.allPasswordFieldsRequired'),
        type: 'error'
      });
      return;
    }

    if (newPassword.length < 8) {
      showToast({
        title: t('common.status.error'),
        content: t('profile.messages.passwordTooShort'),
        type: 'error'
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast({
        title: t('common.status.error'),
        content: t('profile.messages.passwordsDoNotMatch'),
        type: 'error'
      });
      return;
    }

    try {
      const response = await fetch('/api/user/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (!response.ok) {
        const error = await response.json() as { message?: string };
        throw new Error(error.message || 'Failed to update password');
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast({
        title: t('common.status.success'),
        content: t('profile.messages.passwordUpdatedSuccessfully'),
        type: 'success'
      });
    } catch (error) {
      console.error('Error updating password:', error);
      showToast({
        title: t('common.status.error'),
        content: error instanceof Error ? error.message : t('profile.messages.failedToUpdatePassword'),
        type: 'error'
      });
    }
  };

  return (
    <Box p="4">
      <Tabs.Root defaultValue="profile">
        <Tabs.List>
          <Tabs.Trigger value="profile">{t('profile.title')}</Tabs.Trigger>
          {isAdminUser && (
            <Tabs.Trigger value="password">{t('profile.password')}</Tabs.Trigger>
          )}
        </Tabs.List>

        <Box pt="4">
          <Tabs.Content value="profile">
            <form onSubmit={handleSubmit}>
              <Box style={{ gap: '1.5rem' }}>
                <Text size="5" weight="bold">{t('profile.profileInformation')}</Text>
                
                {/* Avatar Selection */}
                <Box style={{ gap: '1rem' }}>
                  <Text size="3" weight="medium">{t('profile.profilePicture')}</Text>
                  <Tabs.Root defaultValue="presets">
                    <Tabs.List>
                      <Tabs.Trigger value="presets">{t('profile.presetAvatars')}</Tabs.Trigger>
                      <Tabs.Trigger value="custom">{t('profile.uploadCustom')}</Tabs.Trigger>
                      {isAdminUser && (
                        <Tabs.Trigger value="admin">{t('profile.managePresets')}</Tabs.Trigger>
                      )}
                    </Tabs.List>

                    <Tabs.Content value="presets">
                      <Grid columns="4" gap="4" p="4">
                        {presetAvatars.map((avatar) => (
                          <Card
                            key={avatar.Id}
                            style={{
                              cursor: 'pointer',
                              border: selectedAvatar === avatar.Id.toString() ? '2px solid var(--blue-9)' : undefined,
                              position: 'relative',
                              backgroundColor: selectedAvatar === avatar.Id.toString() ? 'var(--blue-3)' : undefined
                            }}
                          >
                            <Box p="2">
                              <Avatar
                                size="6"
                                src={`/api/avatars/${avatar.Id}/preview`}
                                fallback="AV"
                              />
                              <Flex gap="2" mt="2" justify="center">
                                <Button 
                                  size="1" 
                                  variant="soft" 
                                  color={selectedAvatar === avatar.Id.toString() ? "blue" : "gray"}
                                  onClick={() => handlePresetSelect(avatar.Id)}
                                >
                                  {selectedAvatar === avatar.Id.toString() ? t('profile.selected') : t('profile.select')}
                                </Button>
                                {(isAdminUser || avatar.UserId === session?.user?.id) && (
                                  <Button 
                                    size="1" 
                                    variant="soft" 
                                    color="red"
                                    onClick={() => handleDeleteAvatar(avatar.Id)}
                                  >
                                    {t('profile.delete')}
                                  </Button>
                                )}
                              </Flex>
                            </Box>
                          </Card>
                        ))}
                      </Grid>
                    </Tabs.Content>

                    <Tabs.Content value="custom">
                      <Box style={{ gap: '2rem' }}>
                        {/* Upload New Custom Avatar Section */}
                        <Card>
                          <Box p="4" style={{ gap: '1rem' }}>
                            <Flex direction="column" gap="2">
                              <Text size="3" weight="medium">{t('profile.uploadNewCustomAvatar')}</Text>
                              <Text size="2" color="gray">
                                {t('profile.uploadNewCustomAvatarDescription')}
                              </Text>
                            </Flex>
                            
                            <Box style={{ gap: '1rem' }}>
                              <Box style={{ position: 'relative' }}>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleAvatarUpload}
                                  style={{
                                    position: 'absolute',
                                    opacity: 0,
                                    width: '100%',
                                    height: '100%',
                                    cursor: 'pointer'
                                  }}
                                  id="custom-avatar-upload"
                                />
                                <label
                                  htmlFor="custom-avatar-upload"
                                  style={{
                                    width: 'fit-content',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    padding: '0.5rem',
                                    border: '1px solid var(--gray-6)',
                                    borderRadius: 'var(--radius-3)',
                                    backgroundColor: 'var(--gray-1)',
                                    fontSize: 'var(--font-size-2)',
                                    fontWeight: '500'
                                  }}
                                >
                                  {t('fileInput.chooseFile')}
                                </label>
                              </Box>
                              
                              {avatarPreview && (
                                <Box style={{ gap: '1rem' }}>
                                  <Text size="2" weight="medium">{t('profile.preview')}</Text>
                                  <Avatar
                                    size="6"
                                    src={avatarPreview}
                                    fallback="AV"
                                  />
                                </Box>
                              )}
                              
                              <Button 
                                onClick={handleCustomUpload} 
                                disabled={!uploadedAvatar}
                                size="2"
                              >
                                {t('profile.uploadAvatar')}
                              </Button>
                            </Box>
                          </Box>
                        </Card>

                        {/* Your Custom Avatars Section */}
                        <Card>
                          <Box p="4" style={{ gap: '1rem' }}>
                            <Flex direction="column" gap="2">
                              <Text size="3" weight="medium">{t('profile.yourCustomAvatars')}</Text>
                              <Text size="2" color="gray">
                                {t('profile.yourCustomAvatarsDescription')}
                              </Text>
                            </Flex>
                            
                            <Grid columns="4" gap="4" mt="2">
                              {customAvatars.map((avatar) => (
                                <Card
                                  key={avatar.Id}
                                  style={{
                                    cursor: 'pointer',
                                    border: selectedAvatar === avatar.Id.toString() ? '2px solid var(--blue-9)' : undefined,
                                    position: 'relative',
                                    backgroundColor: selectedAvatar === avatar.Id.toString() ? 'var(--blue-3)' : undefined
                                  }}
                                >
                                  <Box p="2">
                                    <Avatar
                                      size="6"
                                      src={`/api/avatars/${avatar.Id}/preview`}
                                      fallback="AV"
                                    />
                                    <Flex gap="2" mt="2" justify="center">
                                      <Button 
                                        size="1" 
                                        variant="soft" 
                                        color={selectedAvatar === avatar.Id.toString() ? "blue" : "gray"}
                                        onClick={() => handlePresetSelect(avatar.Id)}
                                      >
                                        {selectedAvatar === avatar.Id.toString() ? t('profile.selected') : t('profile.select')}
                                      </Button>
                                                                                <Button 
                                            size="1" 
                                            variant="soft" 
                                            color="red"
                                            onClick={() => handleDeleteAvatar(avatar.Id)}
                                          >
                                            {t('profile.delete')}
                                          </Button>
                                    </Flex>
                                  </Box>
                                </Card>
                              ))}
                            </Grid>
                          </Box>
                        </Card>
                      </Box>
                    </Tabs.Content>

                    {isAdminUser && (
                      <Tabs.Content value="admin">
                        <Box style={{ gap: '2rem' }}>
                          {/* Upload New Preset Avatar Section */}
                          <Card>
                            <Box p="4" style={{ gap: '1rem' }}>
                              <Flex direction="column" gap="2">
                                <Text size="3" weight="medium">{t('profile.uploadNewPresetAvatar')}</Text>
                                <Text size="2" color="gray">
                                  {t('profile.uploadNewPresetAvatarDescription')}
                                </Text>
                              </Flex>
                              
                              <Box style={{ gap: '1rem' }}>
                                <Box style={{ position: 'relative' }}>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleAvatarUpload}
                                    style={{
                                      position: 'absolute',
                                      opacity: 0,
                                      width: '100%',
                                      height: '100%',
                                      cursor: 'pointer'
                                    }}
                                    id="preset-avatar-upload"
                                  />
                                  <label
                                    htmlFor="preset-avatar-upload"
                                    style={{
                                      width: 'fit-content',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '0.5rem',
                                      padding: '0.5rem',
                                      border: '1px solid var(--gray-6)',
                                      borderRadius: 'var(--radius-3)',
                                      backgroundColor: 'var(--gray-1)',
                                      fontSize: 'var(--font-size-2)',
                                      fontWeight: '500'
                                    }}
                                  >
                                    {t('fileInput.chooseFile')}
                                  </label>
                                </Box>
                                
                                {avatarPreview && (
                                  <Box style={{ gap: '1rem' }}>
                                    <Text size="2" weight="medium">{t('profile.preview')}</Text>
                                    <Avatar
                                      size="6"
                                      src={avatarPreview}
                                      fallback="AV"
                                    />
                                  </Box>
                                )}
                                
                                <Button 
                                  onClick={handlePresetUpload} 
                                  disabled={!uploadedAvatar}
                                  size="2"
                                >
                                  {t('profile.uploadAsPreset')}
                                </Button>
                              </Box>
                            </Box>
                          </Card>

                          {/* Existing Preset Avatars Section */}
                          <Card>
                            <Box p="4" style={{ gap: '1rem' }}>
                              <Flex direction="column" gap="2">
                                <Text size="3" weight="medium">{t('profile.existingPresetAvatars')}</Text>
                                <Text size="2" color="gray">
                                  {t('profile.existingPresetAvatarsDescription')}
                                </Text>
                              </Flex>
                              
                              <Grid columns="4" gap="4" mt="2">
                                {presetAvatars.map((avatar) => (
                                  <Card
                                    key={avatar.Id}
                                    style={{
                                      cursor: 'pointer',
                                      border: selectedAvatar === avatar.Id.toString() ? '2px solid var(--blue-9)' : undefined,
                                      position: 'relative',
                                      backgroundColor: selectedAvatar === avatar.Id.toString() ? 'var(--blue-3)' : undefined
                                    }}
                                  >
                                    <Box p="2">
                                      <Avatar
                                        size="6"
                                        src={`/api/avatars/${avatar.Id}/preview`}
                                        fallback="AV"
                                      />
                                      <Flex gap="2" mt="2" justify="center">
                                        <Button 
                                          size="1" 
                                          variant="soft" 
                                          color={selectedAvatar === avatar.Id.toString() ? "blue" : "gray"}
                                          onClick={() => handlePresetSelect(avatar.Id)}
                                        >
                                          {selectedAvatar === avatar.Id.toString() ? t('profile.selected') : t('profile.select')}
                                        </Button>
                                        <Button 
                                          size="1" 
                                          variant="soft" 
                                          color="red"
                                          onClick={() => handleDeleteAvatar(avatar.Id)}
                                        >
                                          {t('profile.delete')}
                                        </Button>
                                      </Flex>
                                    </Box>
                                  </Card>
                                ))}
                              </Grid>
                            </Box>
                          </Card>
                        </Box>
                      </Tabs.Content>
                    )}
                  </Tabs.Root>
                </Box>

                {/* Name and email fields */}
                <Box style={{ gap: '1rem', marginTop: '2rem' }}>
                  <Text size="3" weight="medium">{t('profile.profileInformation')}</Text>
                  <Box style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
                    <Text size="2" color="gray">{t('profile.updateNameAndEmail')}</Text>
                  </Box>
                  
                  <TextField.Root style={{ width: '100%' }}>
                    <TextField.Slot>
                      <TextField.Input
                        name="name"
                        placeholder={isLoadingName ? t('common.status.loading') : t('profile.name')}
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        disabled={isLoadingName}
                      />
                    </TextField.Slot>
                  </TextField.Root>
                  {isLoadingName && (
                    <Text size="1" color="gray" style={{ marginTop: '0.25rem' }}>
                      {t('common.status.loading')}...
                    </Text>
                  )}


                  <TextField.Root style={{ width: '100%' }}>
                    <TextField.Slot>
                      <TextField.Input
                        name="email"
                        type="email"
                        placeholder={t('profile.email')}
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                      />
                    </TextField.Slot>
                  </TextField.Root>

                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? t('profile.updating') : t('profile.updateNameAndEmailButton')}
                  </Button>
                </Box>
              </Box>
            </form>
          </Tabs.Content>

          {isAdminUser && (
            <Tabs.Content value="password">
              <Card>
                <Box p="4">
                  <form onSubmit={handlePasswordChange}>
                    <Grid gap="4">
                      <input
                        type="text"
                        name="username"
                        autoComplete="username"
                        value={session?.user?.email || ''}
                        style={{ display: 'none' }}
                        readOnly
                      />
                      <TextField.Root>
                        <TextField.Input
                          type="password"
                          placeholder={t('profile.currentPassword')}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          autoComplete="current-password"
                        />
                      </TextField.Root>
                      <TextField.Root>
                        <TextField.Input
                          type="password"
                          placeholder={t('profile.newPassword')}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          autoComplete="new-password"
                        />
                      </TextField.Root>
                      <TextField.Root>
                        <TextField.Input
                          type="password"
                          placeholder={t('profile.confirmNewPassword')}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          autoComplete="new-password"
                        />
                      </TextField.Root>
                      <Button type="submit" disabled={isLoading}>
                        {t('profile.updatePassword')}
                      </Button>
                    </Grid>
                  </form>
                </Box>
              </Card>
            </Tabs.Content>
          )}
        </Box>
      </Tabs.Root>

      <Dialog.Root open={showEmailConfirm}>
        <Dialog.Content style={{ 
          maxWidth: '90vw',
          width: '450px',
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          maxHeight: '90vh',
          overflow: 'auto'
        }}>
          <Dialog.Title>{t('profile.confirmEmailChange')}</Dialog.Title>
          <Dialog.Description>
            {t('profile.confirmEmailChangeDescription', { email: session?.user?.email })}
          </Dialog.Description>

          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray" onClick={handleEmailCancel}>
                {t('profile.cancel')}
              </Button>
            </Dialog.Close>
            <Dialog.Close>
              <Button onClick={handleEmailConfirm}>
                {t('profile.yesIAmSure')}
              </Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
} 