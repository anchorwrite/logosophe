/** @type {import('next').NextConfig} */
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
}

// Initialize OpenNext for development
if (process.env.NODE_ENV === 'development') {
  import("@opennextjs/cloudflare").then(({ initOpenNextCloudflareForDev }) => {
    initOpenNextCloudflareForDev();
  }).catch(console.error);
}

module.exports = nextConfig 