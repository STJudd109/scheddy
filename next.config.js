/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // NOTE: We no longer perform a static export; let Next.js handle
  // server functions normally so API routes work on Vercel.
  images: {
    domains: [
      'vercel.app', // Allow images from Vercel deployments
      'localhost', // Allow local development images
    ],
    // Allow images from any domain when used in production
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  env: {
    // Default API endpoint if not provided in environment
    NEXT_PUBLIC_API_ENDPOINT: 'https://api2.enquiresolutions.com/2/Individual/',
  },
  // Ensure trailing slashes are consistent (must match vercel.json)
  trailingSlash: false,
  // Build output directory (Vercel reads this when `"outputDirectory": "out"` is set)
  distDir: 'out',
  // Disable source maps in production for smaller bundle size
  productionBrowserSourceMaps: false,
};

module.exports = nextConfig;
