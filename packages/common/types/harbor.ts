export interface HarborUser {
  id: string
  email: string
  name: string
  role: 'creator' | 'editor' | 'viewer'
  permissions: string[]
}

export interface Workflow {
  id: string
  name: string
  status: 'active' | 'paused' | 'completed'
  steps: WorkflowStep[]
}

export interface WorkflowStep {
  id: string
  name: string
  type: 'approval' | 'review' | 'publish'
  status: 'pending' | 'approved' | 'rejected'
  assignee?: string
} 