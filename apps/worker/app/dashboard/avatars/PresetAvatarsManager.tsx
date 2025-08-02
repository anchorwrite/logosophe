'use client';

import { useState, useEffect } from 'react';
import { Box, Button, Card, Flex, Grid, Heading, Text } from '@radix-ui/themes';
import '@radix-ui/themes/styles.css';
import { useToast } from '@/components/Toast';
import { D1Result } from '@cloudflare/workers-types';
import { Session } from 'next-auth';

interface PresetAvatar {
  Id: number;
  R2Key: string;
  IsPreset: boolean;
  IsActive: number;  // SQLite stores booleans as 0 or 1
  CreatedAt: string;
}

interface PresetAvatarsResponse {
  avatars: PresetAvatar[];
}

interface PresetAvatarResponse {
  success: boolean;
  message: string;
}

interface PresetAvatarsManagerProps {
  session: Session;
}

export default function PresetAvatarsManager({ session }: PresetAvatarsManagerProps) {
  const [avatars, setAvatars] = useState<PresetAvatar[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    fetchPresetAvatars();
  }, []);

  const fetchPresetAvatars = async () => {
    try {
      console.log('Fetching preset avatars...');
      const response = await fetch('/api/preset-avatars');
      if (!response.ok) throw new Error('Failed to fetch avatars');
      const data = await response.json() as PresetAvatarsResponse;
      console.log('Raw avatar data:', data);
      console.log('Avatar IsActive values:', data.avatars.map(a => ({ id: a.Id, isActive: a.IsActive })));
      setAvatars(data.avatars);
    } catch (error) {
      console.error('Error fetching avatars:', error);
      showToast({
        title: 'Error',
        content: 'Error fetching avatars',
        type: 'error'
      });
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File input changed:', event.target.files);
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024 * 1024) { // 500MB limit
        showToast({
          title: 'Error',
          content: 'File size must be less than 500MB',
          type: 'error'
        });
        return;
      }
      if (!file.type.startsWith('image/')) {
        showToast({
          title: 'Error',
          content: 'File must be an image',
          type: 'error'
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    console.log('Upload form submitted, selected file:', selectedFile);
    if (!selectedFile) {
      showToast({
        title: 'Error',
        content: 'Please select a file first',
        type: 'error'
      });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('/api/preset-avatars', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      showToast({
        title: 'Success',
        content: 'Avatar uploaded successfully',
        type: 'success'
      });
      setSelectedFile(null);
      // Reset the file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      // Refresh the avatars list
      await fetchPresetAvatars();
    } catch (error) {
      console.error('Error uploading avatar:', error);
      showToast({
        title: 'Error',
        content: 'Error uploading avatar',
        type: 'error'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      console.log('Toggling avatar status:', { id, currentStatus });
      const response = await fetch(`/api/preset-avatars/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      const responseData = await response.json() as PresetAvatarResponse;
      
      if (!response.ok) {
        throw new Error(responseData.message || 'Failed to update avatar status');
      }

      console.log('Toggle response:', responseData);

      showToast({
        title: 'Success',
        content: `Avatar ${currentStatus ? 'deactivated' : 'activated'} successfully`,
        type: 'success'
      });
      await fetchPresetAvatars();
    } catch (error) {
      console.error('Error updating avatar status:', error);
      showToast({
        title: 'Error',
        content: 'Error updating avatar status',
        type: 'error'
      });
    }
  };

  const handleDeleteAvatar = async (id: string) => {
    try {
      const response = await fetch(`/api/preset-avatars/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json() as { message?: string };
        throw new Error(errorData.message || 'Failed to delete avatar');
      }

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
        content: 'Error deleting avatar',
        type: 'error'
      });
    }
  };

  return (
    <Box>
      <Card size="3">
        <Box p="4">
          <Heading size="5" mb="4">Upload New Preset Avatar</Heading>
          <form onSubmit={handleUpload}>
            <Flex direction="column" gap="4">
              <Box>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  id="avatar-upload"
                />
                <Button 
                  type="button" 
                  disabled={isUploading}
                  onClick={() => {
                    console.log('Button clicked');
                    document.getElementById('avatar-upload')?.click();
                  }}
                >
                  {selectedFile ? 'Change Image' : 'Select Image'}
                </Button>
                {selectedFile && (
                  <Text size="2" ml="2">
                    Selected: {selectedFile.name}
                  </Text>
                )}
              </Box>
              <Button type="submit" disabled={!selectedFile || isUploading}>
                {isUploading ? 'Uploading...' : 'Upload'}
              </Button>
            </Flex>
          </form>
        </Box>
      </Card>

      <Card size="3" mt="4">
        <Box p="4">
          <Heading size="5" mb="4">Existing Preset Avatars</Heading>
          <Grid columns="3" gap="4">
            {avatars.map((avatar) => {
              const isActive = avatar.IsActive === 1;
              console.log(`Rendering avatar ${avatar.Id}:`, { isActive, IsActive: avatar.IsActive });
              return (
                <Card 
                  key={`avatar-${avatar.Id}`} 
                  size="2"
                  style={{
                    border: isActive ? '3px solid #2ecc71' : '1px solid #e2e8f0',
                    position: 'relative',
                    backgroundColor: isActive ? '#e6f7ef' : 'white',
                    transition: 'all 0.2s ease-in-out',
                    padding: '8px',
                    margin: '4px'
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <Box p="2">
                    <img
                      src={`/api/avatars/${avatar.Id}/preview`}
                      alt={`Preset avatar ${avatar.Id}`}
                      style={{
                        width: '100%',
                        height: '200px',
                        objectFit: 'cover',
                        borderRadius: '4px',
                        pointerEvents: 'none'
                      }}
                    />
                    <Flex justify="between" align="center" mt="2">
                      <Flex gap="2" align="center">
                        <Text size="2">
                          {new Date(avatar.CreatedAt).toLocaleDateString()}
                        </Text>
                        {isActive && (
                          <Box
                            style={{
                              backgroundColor: '#2ecc71',
                              color: 'white',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: 'bold'
                            }}
                          >
                            Active
                          </Box>
                        )}
                      </Flex>
                    </Flex>
                    <Flex direction="column" gap="2" mt="2">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('Toggle button clicked for avatar:', avatar.Id);
                          handleToggleActive(avatar.Id.toString(), isActive);
                        }}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: '1px solid #e2e8f0',
                          backgroundColor: isActive ? '#e6f7ef' : 'white',
                          color: isActive ? '#2ecc71' : '#4a5568',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '500',
                          pointerEvents: 'auto',
                          width: '100%'
                        }}
                      >
                        {isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('Delete button clicked for avatar:', avatar.Id);
                          handleDeleteAvatar(avatar.Id.toString());
                        }}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#fee2e2',
                          color: '#dc2626',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '500',
                          pointerEvents: 'auto',
                          width: '100%'
                        }}
                      >
                        Delete
                      </button>
                    </Flex>
                  </Box>
                </Card>
              );
            })}
          </Grid>
        </Box>
      </Card>
    </Box>
  );
} 