import NextAuth from "next-auth"
import { D1Adapter } from "@auth/d1-adapter"
import Google from "next-auth/providers/google"
import Apple from "next-auth/providers/apple"
import Resend from "next-auth/providers/resend"
import Credentials from "next-auth/providers/credentials"
import bcrypt from 'bcryptjs'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: D1Adapter(process.env.DB),
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
        // Custom D1 adapter for credentials
        const db = process.env.DB
        
        // Verify credentials against D1 database
        const user = await db.prepare(`
          SELECT * FROM Subscribers 
          WHERE Email = ? AND Active = TRUE AND Banned = FALSE
        `).bind(credentials?.email).first()
        
        if (user && await bcrypt.compare(credentials?.password || '', user.PasswordHash)) {
          return {
            id: user.Email,
            email: user.Email,
            name: user.Name,
            role: user.Role
          }
        }
        return null
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
        session.user.role = token.role
      }
      return session
    }
  },
  pages: {
    signIn: '/signin',
    error: '/error'
  }
}) 