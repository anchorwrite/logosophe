import type { Metadata } from 'next'
import { Button } from '@radix-ui/themes'
import { Card, Text, Flex, Box, Heading, Container, Avatar } from '@radix-ui/themes'
import { redirect } from 'next/navigation'
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { auth, signIn, signOut } from '@/auth'
import { AuthError } from 'next-auth'
import { handleSignOut } from '@/signout/actions'

export const runtime = 'edge'

export const metadata: Metadata = {
  title: 'Logosophe Login Page',
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  // Get error from URL search params
  const params = await searchParams;
  const errorParam = params?.error;
  const error = Array.isArray(errorParam) ? errorParam[0] : errorParam;

  // Map error codes to user-friendly messages
  const getErrorMessage = (error: string | undefined) => {
    if (!error) return '';
    
    // Handle Auth.js error format
    if (error.startsWith('Read more at https:/errors.authjs.dev')) {
      return 'Invalid email or password';
    }
    
    // Handle specific error types
    switch (error) {
      case 'CredentialsSignin':
        return 'Invalid email or password';
      case 'UserNotFound':
        return 'No account found with this email';
      case 'IncorrectPassword':
        return 'Incorrect password';
      default:
        return 'An error occurred during sign in';
    }
  };

  const session = await auth()
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Container>
        {/* Administrator Login Card */}
        <Card style={{ width: '320px', marginBottom: '1.5rem' }}>
          <Box style={{ padding: '1rem' }}>
            <Flex direction="column" gap="3">
              <Box style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                <Heading>
                  {session ? 'User Profile' : 'Administrator Login'}
                </Heading>
              </Box>
              <Box style={{ display: 'flex', justifyContent: 'center', width: '100%', paddingBottom: '1rem' }}>
                <Text color="gray">
                  {session ? 'Manage your account' : '(System and tenant admins only!)'}
                </Text>
              </Box>
            </Flex>
          </Box>
          <Box style={{ padding: '1rem' }}>
            {session ? (
              <Flex direction="column" gap="4">
                <Flex align="center" gap="3">
                  <Avatar fallback={session.user?.name?.[0] || 'U'} src={session.user?.image || undefined} />
                  <Flex direction="column" gap="1">
                    <Text>
                      {session.user?.name || 'No name set'}
                    </Text>
                    <Text color="gray">
                      {session.user?.email || 'No email set'}
                    </Text>
                  </Flex>
                </Flex>
                <Box>
                  <Text>
                    User ID: {session.user?.id}
                  </Text>
                </Box>
                <form
                  action={async () => {
                    'use server'
                    await handleSignOut()
                  }}
                >
                  <Button type="submit" variant="solid" color="red" style={{ width: '100%' }}>
                    Sign Out
                  </Button>
                </form>
              </Flex>
            ) : (
              <>
                {error && (
                  <Box style={{ 
                    backgroundColor: 'var(--red-2)', 
                    border: '1px solid var(--red-6)', 
                    borderRadius: 'var(--radius-2)',
                    marginBottom: '1rem',
                    padding: '0.75rem'
                  }}>
                    <Text color="red">
                      {getErrorMessage(error)}
                    </Text>
                  </Box>
                )}
                <form
                  action={async (formData) => {
                    'use server'
                    let errorMessage: string | null = null;
                    
                    try {
                      // Check if user is an admin first
                      const context = await getCloudflareContext({async: true});
                      const db = context.env.DB;
                      const isAdmin = await db.prepare(
                        'SELECT 1 FROM Credentials WHERE Email = ?'
                      ).bind(formData.get('email')).first();

                      // Let Auth.js handle the redirect based on user type
                      await signIn('credentials', {
                        email: formData.get('email'),
                        password: formData.get('password'),
                        redirectTo: isAdmin ? '/dashboard' : '/harbor'
                      })
                    } catch (error) {
                      // Don't catch NEXT_REDIRECT errors from signIn - let them bubble up
                      if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
                        throw error;
                      }
                      
                      if (error instanceof AuthError) {
                        errorMessage = error.message || 'AuthenticationError';
                      } else {
                        console.error('Sign-in error:', error)
                        errorMessage = 'AuthenticationError';
                      }
                    }
                    
                    // Handle redirects outside of try/catch to avoid NEXT_REDIRECT issues
                    if (errorMessage) {
                      redirect(`/signin?error=${errorMessage}`)
                    }
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
                >
                                     <input
                     type="email"
                     name="email"
                     placeholder="Email"
                     autoComplete="email"
                     autoCapitalize="none"
                     autoCorrect="off"
                     required
                     style={{
                       padding: '0.75rem',
                       border: '1px solid var(--gray-6)',
                       borderRadius: 'var(--radius-2)',
                       fontSize: '0.875rem'
                     }}
                   />
                   <input
                     type="password"
                     name="password"
                     placeholder="Password"
                     autoComplete="current-password"
                     required
                     style={{
                       padding: '0.75rem',
                       border: '1px solid var(--gray-6)',
                       borderRadius: 'var(--radius-2)',
                       fontSize: '0.875rem'
                     }}
                   />
                  <Button type="submit" style={{ width: '100%' }}>
                    Sign In
                  </Button>
                </form>
              </>
            )}
          </Box>
        </Card>

        {/* Subscriber Login Card */}
        <Card style={{ width: '320px' }}>
          <Box style={{ padding: '1rem' }}>
            <Flex direction="column" gap="3">
              <Box style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                <Heading>
                  Subscriber Login
                </Heading>
              </Box>
              <Box style={{ display: 'flex', justifyContent: 'center', width: '100%', paddingBottom: '1rem' }}>
                <Text color="gray">
                  (Subscribers only!)
                </Text>
              </Box>
            </Flex>
          </Box>
          <Box style={{ padding: '1rem' }}>
            <form
              action={async () => {
                'use server'
                await signIn('google', { redirectTo: '/harbor' })
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}
            >
              <Button type="submit" variant="outline" style={{ width: '100%' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" style={{ marginRight: '0.5rem' }}>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </Button>
            </form>

            <form
              action={async () => {
                'use server'
                await signIn('apple', { redirectTo: '/harbor' })
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}
            >
              <Button type="submit" variant="outline" style={{ width: '100%' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" style={{ marginRight: '0.5rem' }}>
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                Continue with Apple
              </Button>
            </form>

            <form
              action={async (formData) => {
                'use server'
                const email = formData.get('email') as string
                await signIn('resend', { 
                  email,
                  redirectTo: '/harbor' 
                })
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
                             <input
                 type="email"
                 name="email"
                 placeholder="Enter your email"
                 autoComplete="email"
                 autoCapitalize="none"
                 autoCorrect="off"
                 required
                 style={{
                   padding: '0.75rem',
                   border: '1px solid var(--gray-6)',
                   borderRadius: 'var(--radius-2)',
                   fontSize: '0.875rem'
                 }}
               />
              <Button type="submit" variant="outline" style={{ width: '100%' }}>
                Continue with Email
              </Button>
            </form>
          </Box>
        </Card>
      </Container>
    </main>
  )
} 