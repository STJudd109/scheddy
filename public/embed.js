/**
 * Appointment Form Embed Script
 * 
 * This script allows embedding the appointment request form on any website
 * with customizable parameters for different communities and branding.
 * 
 * Usage:
 * <script 
 *   src="https://your-form-domain.com/embed.js" 
 *   data-community="Community Name"
 *   data-color="#0066cc"
 *   data-target="#appointment-form-container"
 *   data-market-source="Google Ads"   <!-- Optional, defaults to “Website” -->
 * ></script>
 * 
 * <div id="appointment-form-container"></div>
 */

(function() {
  // Logging utility for the embed script
  const logger = {
    prefix: '[AppointmentForm]',
    info: function(message, ...args) {
      console.info(`${this.prefix} ${message}`, ...args);
    },
    error: function(message, ...args) {
      console.error(`${this.prefix} ${message}`, ...args);
    },
    warn: function(message, ...args) {
      console.warn(`${this.prefix} ${message}`, ...args);
    }
  };

  /**
   * Safely push an event to the Google Tag Manager / gtag dataLayer.
   * Will initialise `window.dataLayer` if it does not exist.
   *
   * @param {string} eventName - The event name to push (e.g. 'appointment_form_submitted')
   * @param {object} payload   - Additional properties to include with the event
   */
  function pushDataLayer(eventName, payload = {}) {
    try {
      if (typeof window === 'undefined') return;
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: eventName,
        ...payload,
      });
      if (config.debug) {
        logger.info(`Pushed to dataLayer: ${eventName}`, payload);
      }
    } catch (err) {
      logger.error('Failed pushing to dataLayer', err);
    }
  }

  // Get current script element
  const currentScript = document.currentScript || (function() {
    const scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  // Configuration options with defaults
  const config = {
    // Required parameters
    communityName: currentScript.getAttribute('data-community') || '',
    
    // Optional parameters with defaults
    target: currentScript.getAttribute('data-target') || '#appointment-form',
    primaryColor: currentScript.getAttribute('data-color') || '#0066cc',
    secondaryColor: currentScript.getAttribute('data-secondary-color') || '#f8f9fa',
    logoUrl: currentScript.getAttribute('data-logo') || '',
    buttonText: currentScript.getAttribute('data-button-text') || 'Request Appointment',
    // New: marketing attribution
    marketSource: currentScript.getAttribute('data-market-source') || 'Website',

    /* -------------  Scheduling / redirect additions  -------------- */
    scheduleProvider: currentScript.getAttribute('data-schedule-provider') ||
                      currentScript.getAttribute('data-provider') || '',
    bookingUrl: currentScript.getAttribute('data-booking-url') ||
                currentScript.getAttribute('data-schedule-url') || '',
    scheduleOptional: currentScript.getAttribute('data-schedule-optional') || '',
    thankYouUrl: currentScript.getAttribute('data-thankyou-url') || '',
    // Default redirect now points to root ("/") instead of "/thankyou"
    thankYouSuffix: currentScript.getAttribute('data-thankyou-suffix') || '/',

    height: currentScript.getAttribute('data-height') || 'auto',
    width: currentScript.getAttribute('data-width') || '100%',
    
    // Advanced options
    baseUrl: currentScript.getAttribute('data-base-url') || getBaseUrl(),
    iframeMode: currentScript.getAttribute('data-iframe-mode') !== 'false',
    autoResize: currentScript.getAttribute('data-auto-resize') !== 'false',
    debug: currentScript.getAttribute('data-debug') === 'true'
  };

  // Allow overriding config with global object
  if (window.AppointmentFormConfig) {
    Object.assign(config, window.AppointmentFormConfig);
  }

  // Validate required parameters
  if (!config.communityName) {
    return logger.error('Missing required parameter: data-community');
  }

  // Get base URL from script src if not specified
  function getBaseUrl() {
    const scriptSrc = currentScript.src;
    const urlObj = new URL(scriptSrc);
    return `${urlObj.protocol}//${urlObj.host}`;
  }

  // Build URL with query parameters
  function buildFormUrl() {
    const url = new URL('/embed', config.baseUrl);
    
    // Add parameters to URL
    url.searchParams.append('community', encodeURIComponent(config.communityName));
    
    if (config.primaryColor) {
      url.searchParams.append('primaryColor', encodeURIComponent(config.primaryColor));
    }
    
    if (config.secondaryColor) {
      url.searchParams.append('secondaryColor', encodeURIComponent(config.secondaryColor));
    }
    
    if (config.logoUrl) {
      url.searchParams.append('logoUrl', encodeURIComponent(config.logoUrl));
    }
    
    if (config.buttonText) {
      url.searchParams.append('buttonText', encodeURIComponent(config.buttonText));
    }
    
    // Always include Market Source (falls back to "Website")
    if (config.marketSource) {
      url.searchParams.append('marketSource', encodeURIComponent(config.marketSource));
    }
    
    // Add referrer information
    url.searchParams.append('referrer', encodeURIComponent(window.location.href));

    /* ----------  New scheduling / redirect params ---------- */
    if (config.scheduleProvider) {
      url.searchParams.append('scheduleProvider', encodeURIComponent(config.scheduleProvider));
    }
    if (config.bookingUrl) {
      url.searchParams.append('bookingUrl', encodeURIComponent(config.bookingUrl));
    }
    if (config.scheduleOptional) {
      url.searchParams.append('scheduleOptional', encodeURIComponent(config.scheduleOptional));
    }
    if (config.thankYouUrl) {
      url.searchParams.append('thankYouUrl', encodeURIComponent(config.thankYouUrl));
    }
    if (config.thankYouSuffix) {
      url.searchParams.append('thankYouSuffix', encodeURIComponent(config.thankYouSuffix));
    }
    
    return url.toString();
  }

  // Create iframe element
  function createIframe() {
    const iframe = document.createElement('iframe');
    iframe.src = buildFormUrl();
    iframe.style.width = config.width;
    iframe.style.height = config.height;
    iframe.style.border = 'none';
    iframe.style.overflow = 'hidden';
    iframe.title = `Appointment Request Form for ${config.communityName}`;
    iframe.id = 'appointment-form-iframe';
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('scrolling', 'no');
    
    // Add ARIA attributes for accessibility
    iframe.setAttribute('role', 'form');
    iframe.setAttribute('aria-label', `Appointment Request Form for ${config.communityName}`);
    
    return iframe;
  }

  // Initialize the form
  function init() {
    try {
      if (config.debug) {
        logger.info('Initializing with config:', config);
      }
      
      // Find target element
      const targetSelector = config.target;
      const targetElement = document.querySelector(targetSelector);
      
      if (!targetElement) {
        return logger.error(`Target element not found: ${targetSelector}`);
      }
      
      // Create and append iframe
      const iframe = createIframe();
      targetElement.appendChild(iframe);
      
      // Set up message listener for iframe communication
      if (config.autoResize) {
        window.addEventListener('message', handleIframeMessage);
      }
      
      logger.info(`Form embedded successfully for ${config.communityName}`);
    } catch (error) {
      logger.error('Failed to initialize form:', error);
    }
  }

  // Handle messages from iframe for resizing
  function handleIframeMessage(event) {
    try {
      // Verify origin
      if (event.origin !== config.baseUrl) {
        return;
      }
      
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      
      // Handle height updates
      if (data.type === 'resize' && data.height) {
        const iframe = document.getElementById('appointment-form-iframe');
        if (iframe) {
          iframe.style.height = `${data.height}px`;
          if (config.debug) {
            logger.info(`Resized iframe to ${data.height}px`);
          }
        }
      }
      
      // Handle form submission events
      if (data.type === 'formSubmitted') {
        if (config.onSubmit && typeof config.onSubmit === 'function') {
          config.onSubmit(data.data);
        }
        logger.info('Form submitted successfully');

        const meta = data.meta || {};
        pushDataLayer('appointment_form_submitted', {
          community: meta.community || config.communityName,
          marketSource: meta.marketSource || config.marketSource,
          referrer: meta.referrer || window.location.href,
          origin: event.origin,
          timestamp: Date.now(),
        });

          /* Push default GA/GTM form event */
          pushDataLayer('form_submit', {
            community: meta.community || config.communityName,
            marketSource: meta.marketSource || config.marketSource,
            referrer: meta.referrer || window.location.href,
          });
      }
      
      // Handle form errors
      if (data.type === 'formError') {
        if (config.onError && typeof config.onError === 'function') {
          config.onError(data.error);
        }
        logger.warn('Form submission error:', data.error);

        const meta = data.meta || {};
        pushDataLayer('appointment_form_error', {
          community: meta.community || config.communityName,
          marketSource: meta.marketSource || config.marketSource,
          referrer: meta.referrer || window.location.href,
          origin: event.origin,
          error: data.error,
          timestamp: Date.now(),
        });
      }

      // Handle host-page redirect instructions
      if (data.type === 'redirect' && data.url) {
        try {
          const redirectUrl = data.url;
          // absolute if starts with http/https OR explicit mode === 'absolute'
          if (data.mode === 'absolute' || /^https?:\/\//i.test(redirectUrl)) {
            window.location.href = redirectUrl;
          } else {
            // treat as suffix / relative path
            window.location.href = redirectUrl;
          }
        } catch (err) {
          logger.error('Failed to process redirect message', err);
        }
      }

      // Handle first interaction events
      if (data.type === 'formInteracted') {
        const meta = data.meta || {};
        pushDataLayer('appointment_form_interacted', {
          community: meta.community || config.communityName,
          marketSource: meta.marketSource || config.marketSource,
          referrer: meta.referrer || window.location.href,
          origin: event.origin,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      logger.error('Error handling iframe message:', error);
    }
  }

  // Expose public API
  window.AppointmentForm = {
    config: config,
    reload: function(newConfig) {
      // Update config with new values
      if (newConfig) {
        Object.assign(config, newConfig);
      }
      
      // Remove existing iframe
      const iframe = document.getElementById('appointment-form-iframe');
      if (iframe && iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
      
      // Reinitialize
      init();
    }
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
