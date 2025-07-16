import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import AppointmentForm from '../components/AppointmentForm/AppointmentForm';
import { createLogger } from '../lib/logger';

// Create a logger instance for this page
const logger = createLogger('embed-page');

/**
 * Embedded form page that renders inside an iframe
 * 
 * This page:
 * 1. Parses query parameters for configuration
 * 2. Renders the AppointmentForm with the provided parameters
 * 3. Handles iframe resizing via postMessage
 * 4. Posts form submission events to the parent frame
 */
export default function EmbedPage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [initialized, setInitialized] = useState(false);
  
  // Parse query parameters
  const {
    community,
    primaryColor,
    secondaryColor,
    logoUrl,
    buttonText,
    referrer,
  } = router.query;

  // Only run after router is ready and query params are available
  useEffect(() => {
    if (!router.isReady) return;
    
    // Log initialization with sanitized parameters
    logger.info('Initializing embedded form', {
      community: community || 'Not provided',
      referrer: referrer || 'Unknown',
      hasCustomBranding: !!(primaryColor || logoUrl)
    });
    
    setInitialized(true);
  }, [router.isReady, community, primaryColor, logoUrl, referrer]);

  // Handle iframe resizing
  useEffect(() => {
    if (!initialized || !containerRef.current) return;
    
    // Function to measure container and send height to parent
    const resizeObserver = new ResizeObserver(entries => {
      const height = entries[0]?.contentRect.height;
      if (height && typeof window.parent !== 'undefined') {
        // Post message to parent window with new height
        window.parent.postMessage(
          JSON.stringify({
            type: 'resize',
            height: Math.ceil(height) + 10 // Add small padding
          }),
          '*' // This should be restricted to known domains in production
        );
        logger.debug(`Sent resize message: ${height}px`);
      }
    });
    
    // Start observing the container
    resizeObserver.observe(containerRef.current);
    
    // Cleanup observer on unmount
    return () => {
      resizeObserver.disconnect();
    };
  }, [initialized]);

  // Handle form submission success
  const handleFormSuccess = (data: any) => {
    logger.info('Form submitted successfully');
    
    // Notify parent window
    if (typeof window.parent !== 'undefined') {
      window.parent.postMessage(
        JSON.stringify({
          type: 'formSubmitted',
          data
        }),
        '*'
      );
    }
  };

  // Handle form submission errors
  const handleFormError = (error: any) => {
    logger.error('Form submission error', error);
    
    // Notify parent window
    if (typeof window.parent !== 'undefined') {
      window.parent.postMessage(
        JSON.stringify({
          type: 'formError',
          error: error instanceof Error ? error.message : String(error)
        }),
        '*'
      );
    }
  };

  // Create theme object from query parameters
  const theme = {
    primaryColor: typeof primaryColor === 'string' ? primaryColor : undefined,
    secondaryColor: typeof secondaryColor === 'string' ? secondaryColor : undefined,
    logoUrl: typeof logoUrl === 'string' ? logoUrl : undefined,
    buttonText: typeof buttonText === 'string' ? buttonText : undefined,
  };

  // If router is not ready or community is not provided, show loading or error
  if (!initialized) {
    return <div className="p-4 text-center">Loading...</div>;
  }
  
  if (!community) {
    logger.error('Missing required parameter: community');
    return (
      <div className="p-4 text-center text-red-600">
        Error: Community name is required
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Appointment Request Form | {community}</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style jsx global>{`
          /* Minimal reset and base styles for the iframe */
          body {
            margin: 0;
            padding: 0;
            font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
            background: transparent;
          }
          
          /* Hide scrollbar in iframe mode */
          html, body {
            overflow-x: hidden;
            overflow-y: auto;
          }
          
          /* Ensure form container takes full width */
          .embed-container {
            width: 100%;
            padding: 0;
          }
        `}</style>
      </Head>
      
      <div ref={containerRef} className="embed-container">
        <AppointmentForm
          communityName={community as string}
          theme={theme}
          onSubmitSuccess={handleFormSuccess}
          onSubmitFailure={handleFormError}
          // Pass the referrer URL if available
          beforeSubmitTransform={(data) => ({
            ...data,
            SubmittedFrom: referrer || window.location.href,
          })}
        />
      </div>
    </>
  );
}
