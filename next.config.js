/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export', // Enable static exports for Vercel deployment
  images: {
    unoptimized: true, // Required for static export
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
  // Ensure trailing slashes are consistent
  trailingSlash: true,
  // Disable source maps in production for smaller bundle size
  productionBrowserSourceMaps: false,
};

module.exports = nextConfig;
