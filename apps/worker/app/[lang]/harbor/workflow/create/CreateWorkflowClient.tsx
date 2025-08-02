"use client";

import { useState } from 'react';
import { Box, Flex, Heading, Text, Card, Button, TextField, TextArea, Dialog, Select } from "@radix-ui/themes";
import Link from "next/link";
import { useTranslation } from 'react-i18next';
import type { Locale } from '@/types/i18n';
import WorkflowParticipantSelector from '@/components/WorkflowParticipantSelector';
import MediaFileSelector from '@/components/MediaFileSelector';
import { useToast } from '@/components/Toast';

interface UserTenant {
  tenantId: string;
  tenantName: string;
  roleId: string;
  roleName: string;
}

interface Participant {
  email: string;
  role: string;
}

interface CreateWorkflowRequest {
  title: string;
  description: string;
  tenantId: string;
  initiatorRole: string;
  participants: Participant[];
  mediaFileIds: number[];
}

interface CreateWorkflowResponse {
  success: boolean;
  workflowId?: string;
  error?: string;
}

interface CreateWorkflowClientProps {
  userEmail: string;
  userTenants: UserTenant[];
  defaultTenant: UserTenant | null;
  lang: Locale;
}

export function CreateWorkflowClient({ userEmail, userTenants, defaultTenant, lang }: CreateWorkflowClientProps) {
  const { t } = useTranslation('translations');
  const [isCreating, setIsCreating] = useState(false);
  const [showParticipantSelector, setShowParticipantSelector] = useState(false);
  const [showMediaSelector, setShowMediaSelector] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    selectedTenant: defaultTenant || userTenants[0],
    selectedRole: defaultTenant?.roleId || userTenants[0]?.roleId || '',
    participants: [] as Participant[],
    mediaFileIds: [] as number[]
  });
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    
    try {
      const requestData: CreateWorkflowRequest = {
        title: formData.title,
        description: formData.description,
        tenantId: formData.selectedTenant.tenantId,
        initiatorRole: formData.selectedRole,
        participants: formData.participants,
        mediaFileIds: formData.mediaFileIds
      };

      const response = await fetch('/api/workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const result: CreateWorkflowResponse = await response.json();

      if (result.success && result.workflowId) {
        // Redirect to the created workflow
        window.location.href = `/${lang}/harbor/workflow/${result.workflowId}`;
      } else {
        showToast({
          type: 'error',
          title: t('common.error'),
          content: result.error || t('workflow.errors.createFailed')
        });
      }
    } catch (error) {
      console.error('Error creating workflow:', error);
      showToast({
        type: 'error',
        title: t('common.error'),
        content: t('workflow.errors.createFailed')
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTenantChange = (tenantId: string) => {
    const selectedTenant = userTenants.find(t => t.tenantId === tenantId);
    if (selectedTenant) {
      setFormData(prev => ({
        ...prev,
        selectedTenant,
        selectedRole: selectedTenant.roleId,
        participants: [] // Reset participants when tenant changes
      }));
    }
  };

  const handleRoleChange = (roleId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedRole: roleId
    }));
  };

  const getUniqueTenants = () => {
    const uniqueTenants = userTenants.filter((tenant, index, self) => 
      index === self.findIndex(t => t.tenantId === tenant.tenantId)
    );
    return uniqueTenants;
  };

  const getAvailableRolesForTenant = (tenantId: string) => {
    const roles = userTenants
      .filter(t => t.tenantId === tenantId)
      .map(t => ({ id: t.roleId, name: t.roleName }));
    
    // Remove duplicates based on roleId
    const uniqueRoles = roles.filter((role, index, self) => 
      index === self.findIndex(r => r.id === role.id)
    );
    
    return uniqueRoles;
  };

  return (
    <>
      <Card>
        <Box p="6">
          <form onSubmit={handleSubmit}>
            <Flex direction="column" gap="4">
              {/* Tenant Selection (if user has multiple tenants) */}
              {userTenants.length > 1 && (
                <Box>
                  <Text as="label" size="3" weight="bold" mb="2" style={{ display: 'block' }}>
                    Select Tenant *
                  </Text>
                  <Select.Root
                    value={formData.selectedTenant.tenantId}
                    onValueChange={handleTenantChange}
                  >
                    <Select.Trigger />
                    <Select.Content>
                      {getUniqueTenants().map((tenant) => (
                        <Select.Item key={`${userEmail}-${tenant.tenantId}`} value={tenant.tenantId}>
                          {tenant.tenantName}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </Box>
              )}

              {/* Role Selection (if user has multiple roles in selected tenant) */}
              {getAvailableRolesForTenant(formData.selectedTenant.tenantId).length > 1 && (
                <Box>
                  <Text as="label" size="3" weight="bold" mb="2" style={{ display: 'block' }}>
                    Select Your Role *
                  </Text>
                  <Select.Root
                    value={formData.selectedRole}
                    onValueChange={handleRoleChange}
                  >
                    <Select.Trigger />
                    <Select.Content>
                      {getAvailableRolesForTenant(formData.selectedTenant.tenantId).map((role) => (
                        <Select.Item key={role.id} value={role.id}>
                          {role.name}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </Box>
              )}

              {/* Workflow Title */}
              <Box>
                <Text as="label" size="3" weight="bold" mb="2" style={{ display: 'block' }}>
                  Workflow Title *
                </Text>
                <TextField.Root>
                  <TextField.Input
                    placeholder="Enter workflow title"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    required
                    size="3"
                  />
                </TextField.Root>
              </Box>

              {/* Workflow Description */}
              <Box>
                <Text as="label" size="3" weight="bold" mb="2" style={{ display: 'block' }}>
                  Description
                </Text>
                <TextArea
                  placeholder="Describe the workflow purpose and goals"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={4}
                  size="3"
                />
              </Box>

              {/* Participants */}
              <Box>
                <Text as="label" size="3" weight="bold" mb="2" style={{ display: 'block' }}>
                  Workflow Participants
                </Text>
                <Text size="2" color="gray" mb="2">
                  Select team members to include in this workflow and assign their roles
                </Text>
                <Flex gap="3" align="center">
                  <Button 
                    type="button" 
                    variant="soft" 
                    onClick={() => setShowParticipantSelector(true)}
                    size="3"
                  >
                    Select Participants ({formData.participants.length} selected)
                  </Button>
                  {formData.participants.length > 0 && (
                    <Text size="2" color="gray">
                      {formData.participants.map(p => `${p.email} (${p.role})`).join(', ')}
                    </Text>
                  )}
                </Flex>
              </Box>

              {/* Media Files */}
              <Box>
                <Text as="label" size="3" weight="bold" mb="2" style={{ display: 'block' }}>
                  Media Files to Share
                </Text>
                <Text size="2" color="gray" mb="2">
                  Select media files to include in this workflow (optional)
                </Text>
                <Flex gap="3" align="center">
                  <Button 
                    type="button" 
                    variant="soft" 
                    onClick={() => setShowMediaSelector(true)}
                    size="3"
                  >
                    Select Media Files ({formData.mediaFileIds.length} selected)
                  </Button>
                  {formData.mediaFileIds.length > 0 && (
                    <Text size="2" color="gray">
                      {formData.mediaFileIds.length} file(s) selected
                    </Text>
                  )}
                </Flex>
              </Box>

              {/* Action Buttons */}
              <Flex gap="3" mt="4">
                <Button 
                  type="submit" 
                  disabled={isCreating || !formData.title.trim()}
                  size="3"
                >
                  {isCreating ? 'Creating...' : 'Create Workflow'}
                </Button>
                <Button 
                  type="button" 
                  variant="soft" 
                  asChild
                  size="3"
                >
                  <Link href={`/${lang}/harbor/workflow`}>
                    Cancel
                  </Link>
                </Button>
              </Flex>
            </Flex>
          </form>
        </Box>
      </Card>

      {/* Help Text */}
      <Box mt="4">
        <Card>
          <Box p="4">
            <Heading size="4" mb="3">About Workflows</Heading>
            <Text size="2" color="gray">
              Workflows allow you to share media files with team members and collaborate on projects. 
              Once created, participants can view the shared media and reply with their contributions. 
              The workflow continues until you mark it as complete.
            </Text>
          </Box>
        </Card>
      </Box>

      {/* Participant Selector Dialog */}
      <Dialog.Root open={showParticipantSelector} onOpenChange={setShowParticipantSelector}>
        <Dialog.Content style={{ maxWidth: '1000px', maxHeight: '80vh' }}>
          <WorkflowParticipantSelector
            userEmail={userEmail}
            selectedTenantId={formData.selectedTenant.tenantId}
            selectedParticipants={formData.participants}
            onSelectionChange={(participants) => handleInputChange('participants', participants)}
            onClose={() => setShowParticipantSelector(false)}
          />
        </Dialog.Content>
      </Dialog.Root>

      {/* Media File Selector Dialog */}
      <Dialog.Root open={showMediaSelector} onOpenChange={setShowMediaSelector}>
        <Dialog.Content style={{ maxWidth: '1000px', maxHeight: '80vh' }}>
          <MediaFileSelector
            userEmail={userEmail}
            userTenantId={formData.selectedTenant.tenantId}
            selectedFiles={formData.mediaFileIds}
            onSelectionChange={(fileIds) => handleInputChange('mediaFileIds', fileIds)}
            onClose={() => setShowMediaSelector(false)}
          />
        </Dialog.Content>
      </Dialog.Root>
    </>
  );
} 