import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Container, Box, Card, Text, Heading } from '@radix-ui/themes';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { SubscriberUpdateList } from './SubscriberUpdateList';


interface Subscriber {
  Email: string;
  Name: string;
  Provider: string;
  Joined: string;
  LastSignin: string;
  Active: boolean;
  Banned: boolean;
  Post: boolean;
  Moderate: boolean;
  Track: boolean;
}

async function getSubscribers(db: D1Database): Promise<Subscriber[]> {
  const result = await db.prepare(`
    SELECT 
      s.Email,
      s.Name,
      s.Provider,
      s.Joined,
      s.Signin as LastSignin,
      s.Active,
      s.Banned,
      s.Post,
      s.Moderate,
      s.Track
    FROM Subscribers s
    ORDER BY s.CreatedAt DESC
  `).all();
  return (result.results as unknown) as Subscriber[];
}

export default async function SubscriberUpdatePage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/signin');
  }

  const { env } = await getCloudflareContext({async: true});
  const db = env.DB;
  
  // Check if user is admin
  const isAdmin = await db.prepare(
    'SELECT 1 FROM Credentials WHERE Email = ?'
  ).bind(session.user.email).first();

  if (!isAdmin) {
    redirect('/harbor');
  }

  const subscribers = await getSubscribers(db);

  return (
    <Container size="3">
      <Box py="6">
        <Box mb="6">
          <Heading align="center" size="6">Subscriber Update</Heading>
          <Text as="p" align="center" color="gray" mt="2">
            Update subscriber information and tenant assignments
          </Text>
        </Box>

        <Card>
          <Box p="4">
            <Text as="p" align="center" size="4" weight="bold">Subscribers</Text>
          </Box>
          <Box p="4">
            <SubscriberUpdateList subscribers={subscribers} />
          </Box>
        </Card>
      </Box>
    </Container>
  );
} 