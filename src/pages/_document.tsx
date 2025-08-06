import Document, { Html, Head, Main, NextScript, DocumentContext, DocumentInitialProps } from 'next/document';

/**
 * Custom Document component to enhance iframe embedding capabilities
 * 
 * This component:
 * 1. Sets appropriate headers for iframe embedding
 * 2. Adds meta tags for cross-origin compatibility
 * 3. Configures the document for responsive behavior in iframes
 * 4. Detects embed pages and applies specific configurations
 */
class MyDocument extends Document {
  static async getInitialProps(ctx: DocumentContext): Promise<DocumentInitialProps> {
    const originalRenderPage = ctx.renderPage;
    const isEmbedPage = ctx.pathname === '/embed' || ctx.pathname.startsWith('/embed/');

    // Apply iframe-friendly headers for embed pages
    if (isEmbedPage && ctx.res) {
      // Allow embedding from any origin
      ctx.res.setHeader('X-Frame-Options', 'ALLOWALL');
      ctx.res.setHeader('Content-Security-Policy', "frame-ancestors *");
      
      // Prevent clickjacking protection for embed pages
      ctx.res.removeHeader('X-Frame-Options');
    }

    // Run the React rendering logic
    ctx.renderPage = () =>
      originalRenderPage({
        // Useful for wrapping the whole react tree
        enhanceApp: (App) => App,
        // Useful for wrapping in a per-page basis
        enhanceComponent: (Component) => Component,
      });

    // Run the parent getInitialProps
    const initialProps = await Document.getInitialProps(ctx);

    return initialProps;
  }

  render() {
    // Determine if this is the embed page based on the URL
    const isEmbedPage = 
      typeof window !== 'undefined' && 
      (window.location.pathname === '/embed' || 
       window.location.pathname.startsWith('/embed/'));

    return (
      <Html lang="en">
        <Head>
          {/* Meta tags for better iframe embedding */}
          <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
          
          {/* Allow embedding from any origin via meta tag (backup for CSP header) */}
          <meta httpEquiv="Content-Security-Policy" content="frame-ancestors *" />
          
          {/* Prevent automatic phone number detection in iOS */}
          <meta name="format-detection" content="telephone=no" />
          
          {/* Responsive viewport settings optimized for iframe */}
          <meta 
            name="viewport" 
            content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" 
          />
          
          {/* Preconnect to common domains for performance */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          
          {/* Embed-specific styles */}
          {isEmbedPage && (
            <style dangerouslySetInnerHTML={{ __html: `
              html, body {
                margin: 0;
                padding: 0;
                overflow-x: hidden;
                background: transparent;
              }
            `}} />
          )}
        </Head>
        <body className={isEmbedPage ? 'embed-page' : ''}>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
