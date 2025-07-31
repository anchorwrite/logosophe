import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
 
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  // Add explicit R2 configuration
  r2: {
    buckets: {
      "NEXT_INC_CACHE_R2_BUCKET": "logosophe-cache",
      "MEDIA_BUCKET": "logosophe-media"
    }
  }
}); 