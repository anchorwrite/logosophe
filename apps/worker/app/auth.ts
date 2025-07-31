import NextAuth from "next-auth"
import { D1Adapter } from "@auth/d1-adapter"
import Google from "next-auth/providers/google"
import Apple from "next-auth/providers/apple"
import Resend from "next-auth/providers/resend"
import Credentials from "next-auth/providers/credentials"
import bcrypt from 'bcryptjs'
import type { D1Database } from '@cloudflare/workers-types'

// Extend the User interface to include role
declare module "next-auth" {
  interface User {
    role?: string
  }
}

function getD1Database(): D1Database | undefined {
  const db = (process.env as any).DB;
  if (db && typeof db !== 'string') {
    return db as D1Database;
  }
  return undefined;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: getD1Database() ? D1Adapter(getD1Database()!) : undefined,
  providers: [
    // OAuth providers for Harbor
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
    Apple({
      clientId: process.env.AUTH_APPLE_ID!,
      clientSecret: process.env.AUTH_APPLE_SECRET!,
    }),
    Resend({
      apiKey: process.env.AUTH_RESEND_API_KEY!,
    }),
    // Credentials provider for Dashboard
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const db = (process.env as any).DB;
        if (!db || typeof db === 'string') {
          console.error('Database not available');
          return null;
        }
        // db is now a D1Database
        const user = await db.prepare(`
          SELECT * FROM Subscribers 
          WHERE Email = ? AND Active = TRUE AND Banned = FALSE
        `).bind(credentials?.email).first();
        
        if (
          user &&
          typeof user === 'object' &&
          Object.keys(user).length > 0
        ) {
          const typedUser = user as { PasswordHash: string; Email: string; Name: string; Role: string };
          if (
            typeof typedUser.PasswordHash === 'string' &&
            await (bcrypt.compare as any)(credentials?.password || '', typedUser.PasswordHash)
          ) {
            return {
              id: typedUser.Email,
              email: typedUser.Email,
              name: typedUser.Name,
              role: typedUser.Role
            }
          }
        }
        return null;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.role = typeof token.role === 'string' ? token.role : undefined
      }
      return session
    }
  },
  pages: {
    signIn: '/signin',
    error: '/error'
  }
}) 