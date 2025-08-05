'use client';

import { useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { Box, Card, Flex, Heading, Text } from '@radix-ui/themes';

function TestSignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email');
  const token = searchParams.get('token');
  const callbackUrl = searchParams.get('callbackUrl') || '/harbor';
  const { data: session } = useSession();
  const hasAttemptedSignIn = useRef(false);

  useEffect(() => {
    const handleEffect = async () => {
      // Prevent multiple executions
      if (hasAttemptedSignIn.current) {
        return;
      }

      // Handle token-based authentication
      if (token) {
        const handleTokenAuth = async () => {
          if (hasAttemptedSignIn.current) return;
          hasAttemptedSignIn.current = true;
          
          try {
            console.log('Authenticating with token:', token);
            
            // Validate token and get test user email
            const response = await fetch('/api/test-sessions/validate', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ token }),
            });

            if (!response.ok) {
              console.error('Token validation failed');
              router.push('/dashboard/test-users?error=invalid-token');
              return;
            }

            const data = await response.json() as { testUserEmail: string };
            const testUserEmail = data.testUserEmail;

            // Sign in as the test user
            const result = await signIn('test-credentials', {
              email: testUserEmail,
              redirect: false,
            });

            console.log('Token-based sign in result:', result);

            if (result?.error) {
              console.error('Token-based sign in error:', result.error);
              router.push('/dashboard/test-users?error=signin-failed');
            } else if (result?.ok) {
              console.log('Token-based sign in successful, redirecting to:', callbackUrl);
              // Add a small delay to allow session to establish
              setTimeout(() => {
                router.push(callbackUrl);
              }, 100);
            } else {
              console.log('Token-based sign in result unclear, redirecting anyway to:', callbackUrl);
              // Add a small delay to allow session to establish
              setTimeout(() => {
                router.push(callbackUrl);
              }, 100);
            }
          } catch (error) {
            console.error('Token-based authentication error:', error);
            router.push('/dashboard/test-users?error=signin-failed');
          }
        };

        await handleTokenAuth();
        return;
      }

      // Handle email-based authentication (existing logic)
      if (!email) {
        router.push('/dashboard/test-users');
        return;
      }

      // If there's already a session for this test user, redirect directly
      if (session?.user?.email === email) {
        console.log('Already signed in as this test user, redirecting to:', callbackUrl);
        router.push(callbackUrl);
        return;
      }

      // If there's a different user signed in, redirect to sign-out confirmation
      if (session?.user) {
        console.log('Different user signed in, redirecting to sign-out confirmation');
        const encodedTestUser = encodeURIComponent(email);
        router.push(`/signout?callback=test-user&testUser=${encodedTestUser}`);
        return;
      }

      // No current user, sign in directly
      const performSignIn = async () => {
        if (hasAttemptedSignIn.current) return;
        hasAttemptedSignIn.current = true;
        
        try {
          console.log('No current user, signing in test user:', email);
          
          const result = await signIn('test-credentials', {
            email,
            redirect: false,
          });

          console.log('Sign in result:', result);

          if (result?.error) {
            console.error('Test user sign in error:', result.error);
            // Redirect back to test users page with error
            router.push('/dashboard/test-users?error=signin-failed');
          } else if (result?.ok) {
            console.log('Sign in successful, redirecting to:', callbackUrl);
            // Add a small delay to allow session to establish
            setTimeout(() => {
              router.push(callbackUrl);
            }, 100);
          } else {
            console.log('Sign in result unclear, redirecting anyway to:', callbackUrl);
            // Add a small delay to allow session to establish
            setTimeout(() => {
              router.push(callbackUrl);
            }, 100);
          }
        } catch (error) {
          console.error('Test user sign in error:', error);
          router.push('/dashboard/test-users?error=signin-failed');
        }
      };

      // In production, add a small delay to allow session to clear
      let timeout: ReturnType<typeof setTimeout>;
      if (typeof window !== 'undefined' && window.location.hostname !== 'local-dev.logosophe.com') {
        timeout = setTimeout(performSignIn, 500);
      } else {
        performSignIn();
      }
      
      // Add a timeout fallback in case sign-in hangs
      const fallbackTimeout = setTimeout(() => {
        if (!hasAttemptedSignIn.current) {
          console.log('Sign-in timeout, redirecting to:', callbackUrl);
          router.push(callbackUrl);
        }
      }, 5000); // 5 second timeout
      
      return () => {
        if (timeout) clearTimeout(timeout);
        clearTimeout(fallbackTimeout);
      };
    };

    handleEffect();
  }, [email, token, callbackUrl, router, session]);

  return (
    <Flex direction="column" align="center" justify="center" style={{ minHeight: '60vh' }}>
      <Card size="3" style={{ maxWidth: '24rem', width: '100%' }}>
        <Box p="6" style={{ textAlign: 'center' }}>
          <Heading size="5" mb="3">Signing In as Test User</Heading>
          <Text color="gray" size="3">
            {token 
              ? 'Authenticating with session token...'
              : `Please wait while we sign you in as ${email}...`
            }
          </Text>
        </Box>
      </Card>
    </Flex>
  );
}

export default function TestSignInPage() {
  return (
    <Suspense fallback={
      <Flex direction="column" align="center" justify="center" style={{ minHeight: '60vh' }}>
        <Card size="3" style={{ maxWidth: '24rem', width: '100%' }}>
          <Box p="6" style={{ textAlign: 'center' }}>
            <Heading size="5" mb="3">Loading...</Heading>
            <Text color="gray" size="3">
              Please wait...
            </Text>
          </Box>
        </Card>
      </Flex>
    }>
      <TestSignInContent />
    </Suspense>
  );
} 