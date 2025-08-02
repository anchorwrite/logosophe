import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

const nextConfig = {
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