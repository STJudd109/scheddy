import React from 'react';
import Head from 'next/head';
import AppointmentForm from '../components/AppointmentForm/AppointmentForm';
import { useRouter } from 'next/router';

/**
 * Home page with appointment form demo
 */
export default function Home() {
  const router = useRouter();

  // Wait for router to be ready to avoid hydration issues
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (!router.isReady) return;

    // Redirect to cleaner /embed URL preserving query params
    if (typeof window !== 'undefined' && window.location.search) {
      router.replace(`/embed${window.location.search}`);
      return;
    }

    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  // Extract community param (if any)
  const { community } = router.query;

  // Sample form handlers
  const handleSuccess = (data: any) => {
    console.log('Form submitted successfully:', data);
  };

  const handleError = (error: any) => {
    console.error('Form submission error:', error);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Head>
        <title>Appointment Request Form</title>
        <meta name="description" content="Request an appointment at our senior living community" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-primary">
          Senior Living Appointment Request
        </h1>
        
        <AppointmentForm
          communityName={
            typeof community === 'string' && community.trim()
              ? community
              : process.env.NEXT_PUBLIC_COMMUNITY_NAME || 'Demo Community'
          }
          onSubmitSuccess={handleSuccess}
          onSubmitFailure={handleError}
        />
      </main>

      <footer className="mt-12 text-center text-gray-500 text-sm">
        <p>© {new Date().getFullYear()} Senior Living Appointment Form</p>
      </footer>
    </div>
  );
}
