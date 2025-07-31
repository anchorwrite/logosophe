export interface Content {
  id: string
  title: string
  content: string
  author: string
  publishedAt: Date
  language: string
  status: 'draft' | 'published' | 'archived'
}

export interface ContentMetadata {
  id: string
  title: string
  description?: string
  tags?: string[]
  language: string
  publishedAt: Date
} 