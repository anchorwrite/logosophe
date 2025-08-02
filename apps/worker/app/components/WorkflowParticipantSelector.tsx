'use client';

import { useState, useEffect } from 'react';
import { Card, Box, Grid, Heading, Flex, Text, Avatar, Badge, Button, Checkbox, Select } from '@radix-ui/themes';
import { useToast } from '@/components/Toast';

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

interface WorkflowParticipantSelectorProps {
  userEmail: string;
  selectedTenantId: string;
  selectedParticipants: Participant[];
  onSelectionChange: (participants: Participant[]) => void;
  onClose: () => void;
}

export default function WorkflowParticipantSelector({ 
  userEmail, 
  selectedTenantId,
  selectedParticipants, 
  onSelectionChange, 
  onClose 
}: WorkflowParticipantSelectorProps) {
  const [members, setMembers] = useState<GroupedMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [participantRoles, setParticipantRoles] = useState<Record<string, string>>({});
  const { showToast } = useToast();

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

        setMembers(Object.values(groupedMembers));
      } catch (error) {
        console.error('Error fetching tenant members:', error);
        showToast({
          title: 'Error',
          content: 'Failed to load tenant members',
          type: 'error'
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchMembers();
  }, [selectedTenantId]);

  const handleParticipantToggle = (email: string) => {
    if (email === userEmail) return; // Current user cannot be selected
    
    const isSelected = selectedParticipants.some(p => p.email === email);
    
    if (isSelected) {
      // Remove participant
      const newParticipants = selectedParticipants.filter(p => p.email !== email);
      onSelectionChange(newParticipants);
      
      // Remove role assignment
      const newRoles = { ...participantRoles };
      delete newRoles[email];
      setParticipantRoles(newRoles);
    } else {
      // Add participant with default role
      const member = members.find(m => m.email === email);
      const defaultRole = member?.tenants.find(t => t.id === selectedTenantId)?.role || 'recipient';
      
      const newParticipants = [...selectedParticipants, { email, role: defaultRole }];
      onSelectionChange(newParticipants);
      
      // Set default role assignment
      setParticipantRoles(prev => ({ ...prev, [email]: defaultRole }));
    }
  };

  const handleRoleChange = (email: string, role: string) => {
    // Update the participant's role
    const newParticipants = selectedParticipants.map(p => 
      p.email === email ? { ...p, role } : p
    );
    onSelectionChange(newParticipants);
    
    // Update role assignment
    setParticipantRoles(prev => ({ ...prev, [email]: role }));
  };

  const handleSelectAll = () => {
    const allEmails = members.map(m => m.email).filter(email => email !== userEmail);
    const newParticipants: Participant[] = [];
    const newRoles: Record<string, string> = {};
    
    allEmails.forEach(email => {
      const member = members.find(m => m.email === email);
      const defaultRole = member?.tenants.find(t => t.id === selectedTenantId)?.role || 'recipient';
      newParticipants.push({ email, role: defaultRole });
      newRoles[email] = defaultRole;
    });
    
    onSelectionChange(newParticipants);
    setParticipantRoles(newRoles);
  };

  const handleSelectNone = () => {
    onSelectionChange([]);
    setParticipantRoles({});
  };

  const getAvailableRoles = (member: GroupedMember) => {
    const tenantMember = member.tenants.find(t => t.id === selectedTenantId);
    if (!tenantMember) return ['recipient'];
    
    // Return the member's role in this tenant plus common workflow roles
    const roles = [tenantMember.role, 'recipient', 'editor', 'agent', 'reviewer'];
    // Remove duplicates while preserving order
    return roles.filter((role, index) => roles.indexOf(role) === index);
  };

  if (isLoading) {
    return (
      <Box p="4" style={{ textAlign: 'center' }}>
        <Text>Loading members...</Text>
      </Box>
    );
  }

  if (members.length === 0) {
    return (
      <Box p="4" style={{ textAlign: 'center' }}>
        <Text>No members found in the selected tenant.</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Flex justify="between" align="center" mb="4">
        <Text size="5" weight="bold">Select Workflow Participants</Text>
        <Flex gap="2">
          <Button size="2" variant="soft" onClick={handleSelectAll}>
            Select All
          </Button>
          <Button size="2" variant="soft" onClick={handleSelectNone}>
            Select None
          </Button>
          <Button size="2" onClick={onClose}>
            Done
          </Button>
        </Flex>
      </Flex>
      
      <Grid columns="3" gap="4">
        {members.map((member) => {
          const isCurrentUser = member.email === userEmail;
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
                  
                  {isCurrentUser ? (
                    <Box mt="2" p="2" style={{ 
                      backgroundColor: 'var(--gray-3)', 
                      borderRadius: '4px',
                      textAlign: 'center'
                    }}>
                      <Text size="2" color="gray">Current User</Text>
                    </Box>
                  ) : (
                    <Box mt="2" style={{ width: '100%' }}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleParticipantToggle(member.email)}
                        disabled={isCurrentUser}
                      />
                      {isSelected && (
                        <Box mt="2">
                          <Text size="2" weight="bold" mb="1">Role:</Text>
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
                  )}
                </Box>
              </Flex>
            </Card>
          );
        })}
      </Grid>
    </Box>
  );
} 