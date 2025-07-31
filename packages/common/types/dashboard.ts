export interface DashboardUser {
  id: string
  email: string
  name: string
  role: 'admin' | 'moderator' | 'user'
  active: boolean
  banned: boolean
}

export interface SystemStats {
  totalUsers: number
  totalContent: number
  activeWorkflows: number
  storageUsed: number
} 