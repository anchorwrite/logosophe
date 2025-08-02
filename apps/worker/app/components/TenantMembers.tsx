'use client';

import { useState, useEffect } from 'react';
import { Card, Box, Grid, Heading, Flex, Text, Avatar, Badge } from '@radix-ui/themes';
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

export default function TenantMembers() {
  const [members, setMembers] = useState<GroupedMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const response = await fetch('/api/tenant/members');
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
  }, []);

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
        <Text>No members found in your tenants.</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Grid columns="3" gap="4">
        {members.map((member) => (
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
                  <a 
                    onClick={(e) => {
                      e.preventDefault();
                      const mailtoLink = document.createElement('a');
                      mailtoLink.href = `mailto:${member.email}?subject=Hello from Logosophe`;
                      mailtoLink.click();
                    }}
                    style={{ 
                      color: 'inherit',
                      textDecoration: 'none',
                      cursor: 'pointer'
                    }}
                    title={`Send email to ${member.email}`}
                  >
                    {member.email}
                  </a>
                </Text>
                <Flex direction="column" gap="2" mt="2" align="center">
                  {member.tenants.map((tenant) => (
                    <Flex key={`${member.email}-${tenant.id}-${tenant.role}`} gap="2" justify="center">
                      <Badge>{tenant.role}</Badge>
                      <Text size="2" color="gray">in {tenant.name}</Text>
                    </Flex>
                  ))}
                </Flex>
              </Box>
            </Flex>
          </Card>
        ))}
      </Grid>
    </Box>
  );
} 