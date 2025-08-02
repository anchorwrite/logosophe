'use client'

import { useState, useEffect } from 'react';
import { Button, TextField, Text, Box, Card, Flex, Grid, Tabs, Avatar, Dialog } from '@radix-ui/themes';
import { useSession } from 'next-auth/react';
import type { Session } from 'next-auth';
import { useToast } from '@/components/Toast';

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
  const [isLoading, setIsLoading] = useState(false);
  const [presetAvatars, setPresetAvatars] = useState<UserAvatar[]>([]);
  const [customAvatars, setCustomAvatars] = useState<UserAvatar[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [uploadedAvatar, setUploadedAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showEmailConfirm, setShowEmailConfirm] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<ProfileFormData | null>(null);
  const [formData, setFormData] = useState<ProfileFormData>({
    name: session?.user?.name || '',
    email: session?.user?.email || ''
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    fetchPresetAvatars();
    fetchCustomAvatars();
    fetchCurrentAvatar();
  }, []);

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
        title: 'Error',
        content: 'Failed to load preset avatars',
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
        title: 'Error',
        content: 'Failed to load custom avatars',
        type: 'error'
      });
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
      console.log('Selecting avatar:', avatarId);
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
      console.log('Avatar update response:', responseData);
      
      setSelectedAvatar(avatarId.toString());
      showToast({
        title: 'Success',
        content: 'Avatar updated successfully',
        type: 'success'
      });
    } catch (error) {
      console.error('Error selecting avatar:', error);
      showToast({
        title: 'Error',
        content: 'Failed to update avatar',
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
      console.log('Delete response:', responseData);

      showToast({
        title: 'Success',
        content: 'Avatar deleted successfully',
        type: 'success'
      });
      // Refresh the avatar list
      await fetchPresetAvatars();
    } catch (error) {
      console.error('Error deleting avatar:', error);
      showToast({
        title: 'Error',
        content: 'Failed to delete avatar',
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
          title: 'Success',
          content: 'Avatar uploaded successfully',
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
          title: 'Error',
          content: 'Failed to upload avatar',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      showToast({
        title: 'Error',
        content: 'Failed to upload avatar',
        type: 'error'
      });
    }
  };

  const handlePresetUpload = async () => {
    if (!uploadedAvatar) return;

    const formData = new FormData();
    formData.append('file', uploadedAvatar);

    try {
      const response = await fetch('/api/preset-avatars', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json() as ApiResponse;
      if (response.ok && data.avatarId) {
        showToast({
          title: 'Success',
          content: 'Preset avatar uploaded successfully',
          type: 'success'
        });
        // Refresh the avatar list
        fetchPresetAvatars();
        // Clear the upload state
        setUploadedAvatar(null);
        setAvatarPreview(null);
      } else {
        showToast({
          title: 'Error',
          content: 'Failed to upload preset avatar',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error uploading preset avatar:', error);
      showToast({
        title: 'Error',
        content: 'Failed to upload preset avatar',
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
      console.log('Submitting profile update');

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
        console.log('Profile update response:', responseData);
        showToast({
          title: 'Success',
          content: 'Profile updated successfully',
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
          title: 'Error',
          content: errorData.message || 'Failed to update profile',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      showToast({
        title: 'Error',
        content: 'Failed to update profile',
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
        title: 'Error',
        content: 'All password fields are required',
        type: 'error'
      });
      return;
    }

    if (newPassword.length < 8) {
      showToast({
        title: 'Error',
        content: 'New password must be at least 8 characters long',
        type: 'error'
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast({
        title: 'Error',
        content: 'New passwords do not match',
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
        title: 'Success',
        content: 'Password updated successfully',
        type: 'success'
      });
    } catch (error) {
      console.error('Error updating password:', error);
      showToast({
        title: 'Error',
        content: error instanceof Error ? error.message : 'Failed to update password',
        type: 'error'
      });
    }
  };

  return (
    <Box p="4">
      <Tabs.Root defaultValue="profile">
        <Tabs.List>
          <Tabs.Trigger value="profile">Profile</Tabs.Trigger>
          {isAdminUser && (
            <Tabs.Trigger value="password">Password</Tabs.Trigger>
          )}
        </Tabs.List>

        <Box pt="4">
          <Tabs.Content value="profile">
            <form onSubmit={handleSubmit}>
              <Box style={{ gap: '1.5rem' }}>
                <Text size="5" weight="bold">Profile Information</Text>
                
                {/* Avatar Selection */}
                <Box style={{ gap: '1rem' }}>
                  <Text size="3" weight="medium">Profile Picture</Text>
                  <Tabs.Root defaultValue="presets">
                    <Tabs.List>
                      <Tabs.Trigger value="presets">Preset Avatars</Tabs.Trigger>
                      <Tabs.Trigger value="custom">Upload Custom</Tabs.Trigger>
                      {isAdminUser && (
                        <Tabs.Trigger value="admin">Manage Presets</Tabs.Trigger>
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
                                  {selectedAvatar === avatar.Id.toString() ? 'Selected' : 'Select'}
                                </Button>
                                {(isAdminUser || avatar.UserId === session?.user?.id) && (
                                  <Button 
                                    size="1" 
                                    variant="soft" 
                                    color="red"
                                    onClick={() => handleDeleteAvatar(avatar.Id)}
                                  >
                                    Delete
                                  </Button>
                                )}
                              </Flex>
                            </Box>
                          </Card>
                        ))}
                      </Grid>
                    </Tabs.Content>

                    <Tabs.Content value="custom">
                      <Box style={{ gap: '1rem' }}>
                        <Text size="3" weight="medium" mb="4">Upload New Custom Avatar</Text>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                        />
                        {avatarPreview && (
                          <Box style={{ gap: '1rem' }}>
                            <Avatar
                              size="6"
                              src={avatarPreview}
                              fallback="AV"
                            />
                          </Box>
                        )}
                        <Button onClick={handleCustomUpload} disabled={!uploadedAvatar}>
                          Upload Avatar
                        </Button>

                        <Text size="3" weight="medium" mt="6" mb="4">Your Custom Avatars</Text>
                        <Grid columns="4" gap="4">
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
                                    {selectedAvatar === avatar.Id.toString() ? 'Selected' : 'Select'}
                                  </Button>
                                  <Button 
                                    size="1" 
                                    variant="soft" 
                                    color="red"
                                    onClick={() => handleDeleteAvatar(avatar.Id)}
                                  >
                                    Delete
                                  </Button>
                                </Flex>
                              </Box>
                            </Card>
                          ))}
                        </Grid>
                      </Box>
                    </Tabs.Content>

                    {isAdminUser && (
                      <Tabs.Content value="admin">
                        <Box style={{ gap: '1rem' }}>
                          <Text size="3" weight="medium" mb="4">Upload New Preset Avatar</Text>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarUpload}
                          />
                          {avatarPreview && (
                            <Box style={{ gap: '1rem' }}>
                              <Avatar
                                size="6"
                                src={avatarPreview}
                                fallback="AV"
                              />
                            </Box>
                          )}
                          <Button onClick={handlePresetUpload} disabled={!uploadedAvatar}>
                            Upload as Preset
                          </Button>

                          <Text size="3" weight="medium" mt="6" mb="4">Existing Preset Avatars</Text>
                          <Grid columns="4" gap="4">
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
                                      {selectedAvatar === avatar.Id.toString() ? 'Selected' : 'Select'}
                                    </Button>
                                    <Button 
                                      size="1" 
                                      variant="soft" 
                                      color="red"
                                      onClick={() => handleDeleteAvatar(avatar.Id)}
                                    >
                                      Delete
                                    </Button>
                                  </Flex>
                                </Box>
                              </Card>
                            ))}
                          </Grid>
                        </Box>
                      </Tabs.Content>
                    )}
                  </Tabs.Root>
                </Box>

                {/* Name and email fields */}
                <Box style={{ gap: '1rem', marginTop: '2rem' }}>
                  <Text size="3" weight="medium">Profile Information</Text>
                  <Box style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
                    <Text size="2" color="gray">Update your name and email address below:</Text>
                  </Box>
                  
                  <TextField.Root style={{ width: '100%' }}>
                    <TextField.Slot>
                      <TextField.Input
                        name="name"
                        placeholder="Name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                      />
                    </TextField.Slot>
                  </TextField.Root>

                  <TextField.Root style={{ width: '100%' }}>
                    <TextField.Slot>
                      <TextField.Input
                        name="email"
                        type="email"
                        placeholder="Email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                      />
                    </TextField.Slot>
                  </TextField.Root>

                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Updating...' : 'Update Name & Email'}
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
                          placeholder="Current Password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          autoComplete="current-password"
                        />
                      </TextField.Root>
                      <TextField.Root>
                        <TextField.Input
                          type="password"
                          placeholder="New Password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          autoComplete="new-password"
                        />
                      </TextField.Root>
                      <TextField.Root>
                        <TextField.Input
                          type="password"
                          placeholder="Confirm New Password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          autoComplete="new-password"
                        />
                      </TextField.Root>
                      <Button type="submit" disabled={isLoading}>
                        Update Password
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
          <Dialog.Title>Confirm Email Change</Dialog.Title>
          <Dialog.Description>
            Current session email is {session?.user?.email}
            <br /><br />
            Are you sure you want to change your email? This is the key to most of the data in the database, and changing it may make it unavailable to you.
          </Dialog.Description>

          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray" onClick={handleEmailCancel}>
                Cancel
              </Button>
            </Dialog.Close>
            <Dialog.Close>
              <Button onClick={handleEmailConfirm}>
                Yes, I am sure
              </Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
} 