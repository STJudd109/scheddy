import React from 'react';
import { AppProps } from 'next/app';
import Head from 'next/head';
import { ThemeProvider } from '../components/ThemeProvider';
import '../styles/globals.css';

/**
 * Small helper to keep error logs consistent.
 * In the future this can be swapped to a remote logger (Sentry, Datadog…).
 */
const logError = (context: string, err: unknown, info?: unknown) => {
  // eslint-disable-next-line no-console
  console.error(`[AppointmentForm][${context}]`, err, info ?? '');
};

/**
 * Simple React error‐boundary for catching render-time errors
 * anywhere beneath the App tree.
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logError('react-error-boundary', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center text-red-700">
          <h1 className="text-xl font-semibold mb-4">Something went wrong.</h1>
          <p>Please refresh the page or try again later.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

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
        <ErrorBoundary>
          <Component {...pageProps} />
        </ErrorBoundary>
      </ThemeProvider>
    </>
  );
}

/**
 * Register global JS error listeners once.
 * Done **outside** of `MyApp` render to avoid multiple registrations
 * during Fast Refresh in dev.
 */
if (typeof window !== 'undefined') {
  // ensure we don't double-bind in Fast Refresh
  const globalFlag = '__APPOINTMENT_FORM_ERRORS_BOUND__';
  if (!(window as any)[globalFlag]) {
    (window as any)[globalFlag] = true;

    window.addEventListener('error', (e) => {
      logError('window.onerror', e.error ?? e);
    });

    window.addEventListener('unhandledrejection', (e) => {
      logError('unhandledrejection', e.reason);
    });
  }
}

export default MyApp;
