export interface User {
  id: string
  email: string
  name?: string
  role?: string
}

export interface Session {
  user: User
  expires: string
}

export interface AuthConfig {
  providers: any[]
  callbacks: any
  pages: any
} 