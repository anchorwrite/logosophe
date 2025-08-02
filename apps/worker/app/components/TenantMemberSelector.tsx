'use client';

import { useState, useEffect } from 'react';
import { Card, Box, Grid, Heading, Flex, Text, Avatar, Badge, Button, Checkbox } from '@radix-ui/themes';
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

interface TenantMemberSelectorProps {
  userEmail: string;
  userTenantId: string;
  selectedMembers: string[];
  onSelectionChange: (members: string[]) => void;
  onClose: () => void;
}

export default function TenantMemberSelector({ 
  userEmail, 
  userTenantId, 
  selectedMembers, 
  onSelectionChange, 
  onClose 
}: TenantMemberSelectorProps) {
  const [members, setMembers] = useState<GroupedMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const response = await fetch(`/api/tenant/members?tenantId=${encodeURIComponent(userTenantId)}`);
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
          acc[member.email].tenants.push({
            id: member.tenantId,
            name: member.tenantName,
            role: member.role
          });
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
  }, [userTenantId]);

  const handleMemberToggle = (email: string) => {
    if (email === userEmail) return; // Current user cannot be selected
    
    const newSelection = selectedMembers.includes(email)
      ? selectedMembers.filter(m => m !== email)
      : [...selectedMembers, email];
    
    onSelectionChange(newSelection);
  };

  const handleSelectAll = () => {
    const allEmails = members.map(m => m.email).filter(email => email !== userEmail);
    onSelectionChange(allEmails);
  };

  const handleSelectNone = () => {
    onSelectionChange([]);
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
        <Text>No members found in your tenant.</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Flex justify="between" align="center" mb="4">
        <Heading size="4">Select Recipients</Heading>
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
          const isSelected = selectedMembers.includes(member.email);
          
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
                    <Box mt="2">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleMemberToggle(member.email)}
                        disabled={isCurrentUser}
                      />
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