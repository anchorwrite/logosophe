'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Button, Text, Flex, Checkbox, Select } from '@radix-ui/themes';
import { Upload, X, Check } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { useTranslation } from 'react-i18next';

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

export function HarborMediaUpload() {
  const { t } = useTranslation('translations');
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastTitle, setToastTitle] = useState<'success' | 'error'>('success');
  const [toastContent, setToastContent] = useState('');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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
        showToast('error', t('harbor.failedToLoadTenants'));
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      showToast('error', t('harbor.selectFileFirst'));
      return;
    }

    if (!selectedLanguage) {
      showToast('error', t('harbor.selectLanguageRequired'));
      return;
    }

    if (selectedTenants.length === 0) {
      showToast('error', t('harbor.selectAtLeastOneTenant'));
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('tenants', JSON.stringify(selectedTenants));
      formData.append('language', selectedLanguage);

      const response = await fetch('/api/harbor/media', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || t('harbor.failedToUploadFile'));
      }

      const data = await response.json();
      showToast('success', t('harbor.fileUploadedSuccessfully'));
      const currentLang = window.location.pathname.split('/')[1] || 'en';
      router.push(`/${currentLang}/harbor/media`);
      router.refresh();
    } catch (error) {
      console.error('Error uploading file:', error);
      showToast('error', error instanceof Error ? error.message : t('harbor.failedToUploadFile'));
    } finally {
      setIsUploading(false);
    }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
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
                  {isUploading ? t('harbor.uploading') : t('harbor.clickToUpload')}
                </Text>
                <Text size="2" color="gray">
                  {t('harbor.anyFileType')}
                </Text>
              </Flex>
            </Flex>
          </label>
          <input
            id="file-upload"
            type="file"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
            disabled={isUploading}
          />
        </Box>

        {selectedFile && (
          <Box style={{ 
            border: '1px solid var(--gray-6)', 
            borderRadius: 'var(--radius-3)', 
            padding: 'var(--space-4)', 
            backgroundColor: 'var(--gray-2)',
            textAlign: 'center' 
          }}>
            <Flex direction="column" align="center" gap="2">
              <Text size="3" weight="medium" color="green">
                {t('harbor.fileSelected')}
              </Text>
              <Text size="2" weight="medium">
                {selectedFile.name}
              </Text>
              <Text size="2" color="gray">
                {formatBytes(selectedFile.size)}
              </Text>
            </Flex>
          </Box>
        )}

        <Box style={{ textAlign: 'center' }}>
          <Text as="div" size="2" weight="bold" mb="2">
            {t('harbor.language')}
          </Text>
          <Select.Root value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <Select.Trigger placeholder={t('harbor.selectLanguage')} />
            <Select.Content>
              <Select.Item value="en">{t('harbor.languageEnglish')}</Select.Item>
              <Select.Item value="de">{t('harbor.languageGerman')}</Select.Item>
              <Select.Item value="es">{t('harbor.languageSpanish')}</Select.Item>
              <Select.Item value="fr">{t('harbor.languageFrench')}</Select.Item>
              <Select.Item value="nl">{t('harbor.languageDutch')}</Select.Item>
            </Select.Content>
          </Select.Root>
        </Box>

        <Box style={{ textAlign: 'center' }}>
          <Text as="div" size="2" weight="bold" mb="2">
            {t('harbor.availableTenants')}
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

        <Flex justify="center" gap="2">
          <Button
            variant="soft"
            onClick={handleUpload}
            disabled={isUploading || !selectedFile || !selectedLanguage}
          >
            {isUploading ? t('harbor.uploading') : t('harbor.media.upload')}
          </Button>
          <Button
            variant="soft"
            onClick={() => {
              const currentLang = window.location.pathname.split('/')[1] || 'en';
              router.push(`/${currentLang}/harbor/media`);
            }}
            disabled={isUploading}
          >
            {t('harbor.media.cancel')}
          </Button>
        </Flex>
      </Flex>
    </Box>
  );
} 