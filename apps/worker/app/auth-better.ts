// Stage 3 scaffold — not yet imported by any route.
// Will be merged into app/auth.ts during Stage 4 cutover.
import { betterAuth } from 'better-auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function createAuth() {
  const { env } = await getCloudflareContext({ async: true });
  return betterAuth({
    database: env.DB,
    secret: process.env.AUTH_SECRET,
  });
}
