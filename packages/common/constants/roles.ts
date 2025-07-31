export const USER_ROLES = {
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  CREATOR: 'creator',
  EDITOR: 'editor',
  VIEWER: 'viewer',
  USER: 'user'
} as const

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES]

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [USER_ROLES.ADMIN]: ['*'],
  [USER_ROLES.MODERATOR]: ['read', 'write', 'moderate'],
  [USER_ROLES.CREATOR]: ['read', 'write'],
  [USER_ROLES.EDITOR]: ['read', 'write'],
  [USER_ROLES.VIEWER]: ['read'],
  [USER_ROLES.USER]: ['read']
} 