import { defineCloudflareConfig } from "@opennextjs/cloudflare";
 
export default defineCloudflareConfig({
  incrementalCache: undefined,
  // Disable cache interception to fix static asset serving issues
  enableCacheInterception: false,
}); 