'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Button, Text, Flex, Checkbox } from '@radix-ui/themes';
import { Upload, X, Check } from 'lucide-react';
import { useToast } from '@/components/Toast';

interface TenantResponse {
  results: Array<{
    Id: string;
    Name: string;
    Description: string;
    CreatedAt: string;
    UpdatedAt: string;
  }>;
}

interface Tenant {
  TenantId: string;
  Name: string;
}

export function MediaUpload() {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastTitle, setToastTitle] = useState<'success' | 'error'>('success');
  const [toastContent, setToastContent] = useState('');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);

  useEffect(() => {
    // Fetch user's tenants
    const fetchTenants = async () => {
      try {
        const response = await fetch('/api/user/tenants');
        if (!response.ok) throw new Error('Failed to fetch tenants');
        const data = await response.json() as Array<{ Id: string; Name: string }>;
        const tenantList = data.map(tenant => ({
          TenantId: tenant.Id,
          Name: tenant.Name
        }));
        setTenants(tenantList);
        // Pre-select all tenants
        setSelectedTenants(tenantList.map(t => t.TenantId));
      } catch (error) {
        console.error('Error fetching tenants:', error);
        showToast('error', 'Failed to load tenants');
      }
    };

    fetchTenants();
  }, []);

  const showToast = (title: 'success' | 'error', content: string) => {
    setToastTitle(title);
    setToastContent(content);
    setToastOpen(true);
  };

  const handleTenantChange = (tenantId: string) => {
    setSelectedTenants(prev => 
      prev.includes(tenantId)
        ? prev.filter(id => id !== tenantId)
        : [...prev, tenantId]
    );
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (selectedTenants.length === 0) {
      showToast('error', 'Please select at least one tenant');
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tenants', JSON.stringify(selectedTenants));

      const response = await fetch('/api/media', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to upload file');
      }

      const data = await response.json();
      showToast('success', 'File uploaded successfully');
      router.push('/dashboard/media');
      router.refresh();
    } catch (error) {
      console.error('Error uploading file:', error);
      showToast('error', error instanceof Error ? error.message : 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Box style={{ maxWidth: '32rem', margin: '0 auto' }}>
      <Flex direction="column" gap="6">
        <Box style={{ 
          border: '2px dashed var(--gray-6)', 
          borderRadius: 'var(--radius-3)', 
          padding: 'var(--space-6)', 
          textAlign: 'center' 
        }}>
          <label
            htmlFor="file-upload"
            style={{ cursor: 'pointer', display: 'block' }}
          >
            <Flex direction="column" align="center" gap="4">
              <Upload style={{ width: '3rem', height: '3rem', color: 'var(--gray-9)' }} />
              <Flex direction="column" gap="2">
                <Text size="5" weight="medium">
                  {isUploading ? 'Uploading...' : 'Click to upload or drag and drop'}
                </Text>
                <Text size="2" color="gray">
                  Any file type
                </Text>
              </Flex>
            </Flex>
          </label>
          <input
            id="file-upload"
            type="file"
            style={{ display: 'none' }}
            onChange={handleUpload}
            disabled={isUploading}
          />
        </Box>

        <Box style={{ textAlign: 'center' }}>
          <Text as="div" size="2" weight="bold" mb="2">
            Available Tenants
          </Text>
          <Box style={{ display: 'inline-block', textAlign: 'left' }}>
            <Flex direction="column" gap="2">
              {tenants.map((tenant) => (
                <Flex key={tenant.TenantId} align="center" gap="2">
                  <Checkbox
                    checked={selectedTenants.includes(tenant.TenantId)}
                    onCheckedChange={() => handleTenantChange(tenant.TenantId)}
                    disabled={isUploading}
                  />
                  <Text size="2">{tenant.Name}</Text>
                </Flex>
              ))}
            </Flex>
          </Box>
        </Box>

        <Flex justify="center">
          <Button
            variant="soft"
            onClick={() => router.push('/dashboard/media')}
            disabled={isUploading}
          >
            Cancel
          </Button>
        </Flex>
      </Flex>
    </Box>
  );
} 