import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { getDeploymentId } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

const nextConfig = {
  deploymentId: getDeploymentId(),
  serverExternalPackages: ['@logosophe/common', '@logosophe/database', '@logosophe/config'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  allowedDevOrigins: ['local-dev.logosophe.com', 'www.logosophe.com'],
};

export default nextConfig; 