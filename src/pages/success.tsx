import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

/**
 * Success page shown after form submission
 */
const SuccessPage = () => {
  // State for countdown timer
  const [countdown, setCountdown] = useState(3);
  
  // Get configuration from environment variables or use defaults
  const communityName = process.env.NEXT_PUBLIC_COMMUNITY_NAME || 'Senior Living Community';
  const redirectPath = process.env.NEXT_PUBLIC_REDIRECT_PATH || '/';
  
  // Handle automatic redirection with countdown
  useEffect(() => {
    // Only run client-side
    if (typeof window === 'undefined') return;
    
    // Set up countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Redirect when countdown reaches zero
          window.location.href = redirectPath;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Clean up timer on unmount
    return () => clearInterval(timer);
  }, [redirectPath]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <Head>
        <title>Thank You | {communityName}</title>
        <meta name="description" content={`Thank you for your appointment request at ${communityName}`} />
        <meta name="robots" content="noindex" /> {/* Don't index success pages */}
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="max-w-md w-full bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-8 text-center">
          <div className="animate-fade-in">
            <svg 
              className="mx-auto h-16 w-16 text-green-500 mb-4" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M5 13l4 4L19 7" 
              />
            </svg>
            
            <h1 className="text-2xl font-bold text-gray-800 mb-3">
              Thank You!
            </h1>
            
            <p className="text-gray-600 mb-6">
              Your appointment request has been submitted successfully. 
              A representative from {communityName} will contact you shortly.
            </p>
            
            <div className="text-sm text-gray-500 animate-pulse-slow mb-6">
              You will be redirected to the homepage in {countdown} seconds...
            </div>
            
            <Link 
              href={redirectPath}
              className="inline-block px-6 py-3 rounded-md text-white bg-primary transition-colors hover:opacity-90"
            >
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuccessPage;
