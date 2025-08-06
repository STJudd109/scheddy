import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js Middleware for Iframe Embedding
 * 
 * This middleware intercepts requests to embed-related routes and sets
 * the appropriate headers to allow cross-origin iframe embedding.
 * 
 * Routes affected:
 * - /embed - The main iframe page
 * - /embed/ - Trailing slash version
 * - /embed.js - The embedding script
 * 
 * Headers set:
 * - X-Frame-Options: ALLOWALL - Allows embedding in iframes from any origin
 * - Content-Security-Policy: frame-ancestors * - Modern alternative to X-Frame-Options
 * 
 * @param request The incoming request
 */
export function middleware(request: NextRequest) {
  // Get the pathname from the URL
  const pathname = request.nextUrl.pathname;
  
  // Check if this is an embed-related route
  const isEmbedRoute = 
    pathname === '/embed' || 
    pathname === '/embed/' || 
    pathname === '/embed.js';
  
  // Only process embed-related routes
  if (!isEmbedRoute) {
    return NextResponse.next();
  }
  
  // Clone the response to modify headers
  const response = NextResponse.next();
  
  // Set headers to allow iframe embedding from any origin
  response.headers.set('X-Frame-Options', 'ALLOWALL');
  response.headers.set('Content-Security-Policy', 'frame-ancestors *');
  
  // Remove any conflicting security headers that might prevent embedding
  // Note: This is handled by explicitly setting them rather than deleting
  // as Next.js middleware doesn't support header deletion
  
  // Add CORS headers for good measure
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  
  return response;
}

/**
 * Configure which routes this middleware applies to
 * 
 * We're specifically targeting:
 * - /embed - The main iframe page
 * - /embed/ - Trailing slash version
 * - /embed.js - The embedding script
 */
export const config = {
  matcher: ['/embed', '/embed/', '/embed.js'],
};
