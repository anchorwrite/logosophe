import { createAuth } from '@/auth';

export async function GET(request: Request) {
  const auth = await createAuth();
  return auth.handler(request);
}

export async function POST(request: Request) {
  const auth = await createAuth();
  return auth.handler(request);
}
