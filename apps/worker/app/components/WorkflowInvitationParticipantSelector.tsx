'use client';

import { useState, useEffect } from 'react';
import { Card, Box, Grid, Heading, Flex, Text, Avatar, Badge, Button, Checkbox, Select } from '@radix-ui/themes';
import { useToast } from '@/components/Toast';
import { useTranslation } from 'react-i18next';

interface TenantMember {
  email: string;
  name: string;
  image: string;
  role: string;
  tenantId: string;
  tenantName: string;
}

interface ApiResponse {
  success: boolean;
  members: TenantMember[];
}

interface GroupedMember {
  email: string;
  name: string;
  image: string;
  tenants: {
    id: string;
    name: string;
    role: string;
  }[];
}

interface Participant {
  email: string;
  role: string;
}

interface WorkflowInvitationParticipantSelectorProps {
  userEmail: string;
  selectedTenantId: string;
  existingParticipants: Array<{ email: string; role: string }>;
  onSelectionChange: (participants: Participant[]) => void;
  onClose: () => void;
}

export default function WorkflowInvitationParticipantSelector({ 
  userEmail, 
  selectedTenantId,
  existingParticipants,
  onSelectionChange, 
  onClose
}: WorkflowInvitationParticipantSelectorProps) {
  const [members, setMembers] = useState<GroupedMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [participantRoles, setParticipantRoles] = useState<Record<string, string>>({});
  const [selectedParticipants, setSelectedParticipants] = useState<Participant[]>([]);
  const { showToast } = useToast();
  const { t } = useTranslation('translations');

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const response = await fetch(`/api/tenant/members?tenantId=${encodeURIComponent(selectedTenantId)}`);
        if (!response.ok) throw new Error('Failed to fetch members');
        const data = await response.json() as ApiResponse;
        
        // Group members by email
        const groupedMembers = data.members.reduce((acc: { [key: string]: GroupedMember }, member) => {
          if (!acc[member.email]) {
            acc[member.email] = {
              email: member.email,
              name: member.name,
              image: member.image,
              tenants: []
            };
          }
          
          // Check if this tenant-role combination already exists
          const existingTenant = acc[member.email].tenants.find(
            t => t.id === member.tenantId && t.role === member.role
          );
          
          if (!existingTenant) {
            acc[member.email].tenants.push({
              id: member.tenantId,
              name: member.tenantName,
              role: member.role
            });
          }
          return acc;
        }, {});

        // Filter out existing participants and current user
        const availableMembers = Object.values(groupedMembers).filter(member => 
          member.email !== userEmail && 
          !existingParticipants.some(p => p.email === member.email)
        );

        setMembers(availableMembers);
      } catch (error) {
        console.error('Error fetching tenant members:', error);
        showToast({
          title: t('error'),
          content: 'Failed to load available participants',
          type: 'error'
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchMembers();
  }, [selectedTenantId, userEmail, existingParticipants]);

  const handleParticipantToggle = (email: string) => {
    const isSelected = selectedParticipants.some(p => p.email === email);
    
    if (isSelected) {
      // Remove participant
      const newParticipants = selectedParticipants.filter(p => p.email !== email);
      setSelectedParticipants(newParticipants);
      
      // Remove role assignment
      const newRoles = { ...participantRoles };
      delete newRoles[email];
      setParticipantRoles(newRoles);
    } else {
      // Add participant with default role
      const member = members.find(m => m.email === email);
      const defaultRole = member?.tenants.find(t => t.id === selectedTenantId)?.role || 'recipient';
      
      const newParticipants = [...selectedParticipants, { email, role: defaultRole }];
      setSelectedParticipants(newParticipants);
      
      // Set default role assignment
      setParticipantRoles(prev => ({ ...prev, [email]: defaultRole }));
    }
  };

  const handleRoleChange = (email: string, role: string) => {
    // Update the participant's role
    const newParticipants = selectedParticipants.map(p => 
      p.email === email ? { ...p, role } : p
    );
    setSelectedParticipants(newParticipants);
    
    // Update role assignment
    setParticipantRoles(prev => ({ ...prev, [email]: role }));
  };

  const handleSelectAll = () => {
    const allEmails = members.map(m => m.email);
    const newParticipants: Participant[] = [];
    const newRoles: Record<string, string> = {};
    
    allEmails.forEach(email => {
      const member = members.find(m => m.email === email);
      const defaultRole = member?.tenants.find(t => t.id === selectedTenantId)?.role || 'recipient';
      newParticipants.push({ email, role: defaultRole });
      newRoles[email] = defaultRole;
    });
    
    setSelectedParticipants(newParticipants);
    setParticipantRoles(newRoles);
  };

  const handleSelectNone = () => {
    setSelectedParticipants([]);
    setParticipantRoles({});
  };

  const handleInvite = () => {
    onSelectionChange(selectedParticipants);
  };

  const getAvailableRoles = (member: GroupedMember) => {
    const tenantMember = member.tenants.find(t => t.id === selectedTenantId);
    if (!tenantMember) return ['recipient'];
    
    // Only return the roles this participant actually has in this tenant
    return [tenantMember.role];
  };

  if (isLoading) {
    return (
      <Box p="4" style={{ textAlign: 'center' }}>
        <Text>Loading available participants...</Text>
      </Box>
    );
  }

  if (members.length === 0) {
    return (
      <Box p="4" style={{ textAlign: 'center' }}>
        <Text>No available participants to invite</Text>
        <Text size="2" color="gray" mt="2">
          All members are already participants in this workflow
        </Text>
      </Box>
    );
  }

  return (
    <Box>
      <Flex justify="between" align="center" mb="4">
        <Flex gap="2">
          <Button size="2" variant="soft" onClick={handleSelectAll}>
            Select All
          </Button>
          <Button size="2" variant="soft" onClick={handleSelectNone}>
            Select None
          </Button>
        </Flex>
        <Flex gap="2">
          <Button size="2" variant="soft" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            size="2" 
            onClick={handleInvite}
            disabled={selectedParticipants.length === 0}
          >
            Invite Selected ({selectedParticipants.length})
          </Button>
        </Flex>
      </Flex>
      
      <Text size="2" color="gray" mb="4">
        Select participants to invite to this workflow. Only users who are not already participants are shown.
      </Text>
      
      <Grid columns="3" gap="4">
        {members.map((member) => {
          const isSelected = selectedParticipants.some(p => p.email === member.email);
          const selectedRole = participantRoles[member.email] || 'recipient';
          const availableRoles = getAvailableRoles(member);
          
          return (
            <Card key={member.email}>
              <Flex direction="column" align="center" gap="3" p="4">
                <Avatar 
                  src={member.image}
                  fallback={member.name?.charAt(0) || 'U'}
                  size="6"
                />
                <Box style={{ textAlign: 'center' }}>
                  <Text weight="bold">{member.name}</Text>
                  <Text size="2" color="gray" style={{ display: 'block', marginTop: '0.25rem' }}>
                    {member.email}
                  </Text>
                  <Flex direction="column" gap="2" mt="2" align="center">
                    {member.tenants.map((tenant) => (
                      <Flex key={`${member.email}-${tenant.id}-${tenant.role}`} gap="2" justify="center">
                        <Badge>{tenant.role}</Badge>
                        <Text size="2" color="gray">in {tenant.name}</Text>
                      </Flex>
                    ))}
                  </Flex>
                  
                  <Box mt="2" style={{ width: '100%' }}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleParticipantToggle(member.email)}
                    />
                    {isSelected && (
                      <Box mt="2">
                        <Text size="2" weight="bold" mb="1">Role</Text>
                        <Select.Root
                          value={selectedRole}
                          onValueChange={(role) => handleRoleChange(member.email, role)}
                        >
                          <Select.Trigger />
                          <Select.Content>
                            {availableRoles.map((role) => (
                              <Select.Item key={`${member.email}-${role}`} value={role}>
                                {role}
                              </Select.Item>
                            ))}
                          </Select.Content>
                        </Select.Root>
                      </Box>
                    )}
                  </Box>
                </Box>
              </Flex>
            </Card>
          );
        })}
      </Grid>
    </Box>
  );
}
