import React from 'react';
import { AppProps } from 'next/app';
import Head from 'next/head';
import { ThemeProvider } from '../components/ThemeProvider';
import '../styles/globals.css';

/**
 * Custom App component for global configuration
 * 
 * This component:
 * - Imports global styles
 * - Sets up ThemeProvider for consistent theming
 * - Adds default meta tags
 */
function MyApp({ Component, pageProps }: AppProps) {
  // Get theme configuration from environment variables or use defaults
  const defaultTheme = {
    primaryColor: process.env.NEXT_PUBLIC_PRIMARY_COLOR || '#0066cc',
    secondaryColor: process.env.NEXT_PUBLIC_SECONDARY_COLOR || '#f8f9fa',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    logoUrl: process.env.NEXT_PUBLIC_LOGO_URL,
    buttonText: process.env.NEXT_PUBLIC_BUTTON_TEXT || 'Request Appointment',
  };

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="Appointment Request Form for Senior Living Facilities" />
        <title>Appointment Request Form</title>
      </Head>
      <ThemeProvider theme={defaultTheme}>
        <Component {...pageProps} />
      </ThemeProvider>
    </>
  );
}

export default MyApp;
