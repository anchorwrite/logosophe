'use client';

import { useState, useEffect } from 'react';
import { Button, Text, Box, Card, Flex, Grid, Tabs, Avatar, Dialog, Badge, Heading } from '@radix-ui/themes';

interface UserProfile {
  Email: string;
  Name: string;
  TenantId: string;
  RoleIds: string;
  IsOnline: boolean;
  IsBlocked: boolean;
  IsActive: boolean;
  IsBanned: boolean;
  // Additional profile fields that might be available
  CreatedAt?: string;
  Joined?: string;
  LastSignin?: string;
  AvatarId?: number;
  AvatarUrl?: string;
  AllTenants?: Array<{
    TenantId: string;
    TenantName?: string;
    Roles: string[];
  }>;
  // Activity data
  MessagesSent?: number;
  MediaDocuments?: number;
  PublishedDocuments?: number;
  LastSigninFromLogs?: string;
  IsGloballyBlocked?: boolean;
}

interface UserProfileModalProps {
  user: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
  currentUserEmail: string;
  isSystemAdmin: boolean;
  isTenantAdmin: boolean;
}

export default function UserProfileModal({ 
  user, 
  isOpen, 
  onClose, 
  currentUserEmail,
  isSystemAdmin,
  isTenantAdmin
}: UserProfileModalProps) {
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user && isOpen) {
      setProfileData(user);
      // Here you could fetch additional profile data if needed
      // fetchUserProfileDetails(user.Email);
    }
  }, [user, isOpen]);

  if (!user || !profileData) {
    return null;
  }

  const renderRoles = (roleIds: string) => {
    if (!roleIds) return <Text size="2" color="gray">user</Text>;
    
    const roles = roleIds.split(',').filter(role => role.trim());
    
    if (roles.length === 1) {
      return <Badge variant="soft">{roles[0]}</Badge>;
    }
    
    return (
      <Flex gap="1" wrap="wrap">
        {roles.map((role, index) => (
          <Badge key={index} variant="soft" size="1">
            {role}
          </Badge>
        ))}
      </Flex>
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Content style={{ 
        maxWidth: '90vw',
        width: '600px',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <Dialog.Title>
          <Flex align="center" gap="3">
            <Avatar 
              size="3" 
              src={profileData.AvatarUrl} 
              fallback={profileData.Name?.charAt(0) || profileData.Email.charAt(0).toUpperCase()}
            />
            <Box>
              <Text weight="bold" size="4">
                {profileData.Name || 'Unknown User'} ({profileData.Email})
              </Text>
            </Box>
          </Flex>
        </Dialog.Title>

        <Box mt="4">
          <Tabs.Root defaultValue="overview">
            <Tabs.List>
              <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
              <Tabs.Trigger value="roles">Roles & Access</Tabs.Trigger>
              <Tabs.Trigger value="activity">Activity</Tabs.Trigger>
            </Tabs.List>

            <Box mt="4">
              <Tabs.Content value="overview">
                <Card>
                  <Box p="4">
                    <Grid gap="4">
                      <Box>
                        <Flex align="center" gap="2">
                          <Text weight="medium" size="2" color="gray">Status:</Text>
                          <Flex gap="2">
                            <Badge 
                              variant={profileData.IsOnline ? 'solid' : 'soft'}
                              color={profileData.IsOnline ? 'green' : 'gray'}
                            >
                              {profileData.IsOnline ? 'Online' : 'Offline'}
                            </Badge>
                            {profileData.IsBlocked === true && (
                              <Badge color="red">Blocked</Badge>
                            )}
                            {profileData.IsBanned && (
                              <Badge color="red">Banned</Badge>
                            )}
                                                      {!profileData.IsActive && (
                            <Badge color="gray">Inactive</Badge>
                          )}
                          {profileData.IsGloballyBlocked && (
                            <Badge color="red" variant="solid">Globally Blocked</Badge>
                          )}
                          </Flex>
                        </Flex>
                      </Box>



                      {profileData.Joined && (
                        <Box>
                          <Flex align="center" gap="2">
                            <Text weight="medium" size="2" color="gray">Member Since:</Text>
                            <Text size="2">{formatDate(profileData.Joined)}</Text>
                          </Flex>
                        </Box>
                      )}

                      {profileData.CreatedAt && (
                        <Box>
                          <Flex align="center" gap="2">
                            <Text weight="medium" size="2" color="gray">Account Created:</Text>
                            <Text size="2">{formatDate(profileData.CreatedAt)}</Text>
                          </Flex>
                        </Box>
                      )}


                    </Grid>
                  </Box>
                </Card>
              </Tabs.Content>

              <Tabs.Content value="roles">
                <Card>
                  <Box p="4">
                    <Grid gap="4">
                      <Box>
                        <Text weight="medium" size="2" color="gray">Tenant Memberships & Roles</Text>
                        <Box mt="2">
                          {profileData.AllTenants && profileData.AllTenants.length > 0 ? (
                            <Grid gap="3">
                              {profileData.AllTenants.map((tenant, index) => (
                                <Box key={index} style={{ 
                                  border: '1px solid var(--gray-4)', 
                                  borderRadius: 'var(--radius-2)', 
                                  padding: '1rem' 
                                }}>
                                  <Flex justify="between" align="center" mb="2">
                                    <Text weight="medium" size="2">
                                      {tenant.TenantName || tenant.TenantId}
                                    </Text>
                                    <Badge variant="soft" color="blue">
                                      {tenant.TenantId}
                                    </Badge>
                                  </Flex>
                                  <Box>
                                    <Text size="1" color="gray" mb="1">Roles:</Text>
                                    <Flex gap="1" wrap="wrap">
                                      {tenant.Roles.length > 0 ? (
                                        tenant.Roles.map((role, roleIndex) => (
                                          <Badge key={roleIndex} variant="soft" size="1">
                                            {role}
                                          </Badge>
                                        ))
                                      ) : (
                                        <Text size="1" color="gray">No roles assigned</Text>
                                      )}
                                    </Flex>
                                  </Box>
                                </Box>
                              ))}
                            </Grid>
                          ) : (
                            <Text size="2" color="gray">No tenant memberships found</Text>
                          )}
                        </Box>
                      </Box>


                    </Grid>
                  </Box>
                </Card>
              </Tabs.Content>

              <Tabs.Content value="activity">
                <Card>
                  <Box p="4">
                    <Grid gap="4">
                      <Box>
                        <Flex align="center" gap="2">
                          <Text weight="medium" size="2" color="gray">Messages Sent:</Text>
                          <Text size="2">{profileData.MessagesSent || 0}</Text>
                        </Flex>
                      </Box>

                      <Box>
                        <Flex align="center" gap="2">
                          <Text weight="medium" size="2" color="gray">Media Documents:</Text>
                          <Text size="2">{profileData.MediaDocuments || 0}</Text>
                        </Flex>
                      </Box>

                      <Box>
                        <Flex align="center" gap="2">
                          <Text weight="medium" size="2" color="gray">Published Documents:</Text>
                          <Text size="2">{profileData.PublishedDocuments || 0}</Text>
                        </Flex>
                      </Box>

                      {profileData.LastSigninFromLogs && (
                        <Box>
                          <Flex align="center" gap="2">
                            <Text weight="medium" size="2" color="gray">Last Sign In:</Text>
                            <Text size="2">{formatDate(profileData.LastSigninFromLogs)}</Text>
                          </Flex>
                        </Box>
                      )}
                    </Grid>
                  </Box>
                </Card>
              </Tabs.Content>
            </Box>
          </Tabs.Root>
        </Box>

        <Flex gap="3" mt="6" justify="end">
          <Dialog.Close>
            <Button variant="soft" color="gray">
              Close
            </Button>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
