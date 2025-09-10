import React, { useState, useEffect, useRef } from 'react';
import { useForm, Controller, SubmitHandler, useWatch } from 'react-hook-form';
import { useTheme, Theme } from '../ThemeProvider';
import { 
  CARE_TYPE_OPTIONS, 
  MARKET_SOURCE_OPTIONS, 
  VALIDATION_PATTERNS, 
  ERROR_MESSAGES,
  DEFAULT_CONFIG,
  US_STATES,
  SUBMISSION_TYPE_OPTIONS
} from '../../lib/constants';
import type { AppointmentFormData } from '../../types/enquire';

/**
 * Internal helper for consistent console-logging of errors originating
 * from this form.  Having a single place makes it easier to swap to a
 * remote logger later (Datadog, Sentry, etc.).
 */
const logFormError = (context: string, err: unknown): void => {
  // eslint-disable-next-line no-console
  console.error(`[AppointmentForm] ${context}`, err);
};

/**
 * Detects whether the form is rendered inside an iframe (embedded context)
 * 
 * Returns `true` when `window.self !== window.top`.  Wrapped in a try/catch
 * because some browsers throw cross-origin errors when accessing `window.top`.
 */
const isEmbedded = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true; // Cross-origin – assume embedded
  }
};

// TypeScript declarations for Cloudflare Turnstile
declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string, 
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback': () => void;
          theme?: 'light' | 'dark' | 'auto';
          [key: string]: any;
        }
      ) => string;
      reset: (widgetId: string) => void;
    };
  }
}

// Props for the AppointmentForm component
interface AppointmentFormProps {
  // Community configuration
  communityName: string;
  redirectPath?: string;
  redirectDelay?: number;
  globalDuplicateCheck?: boolean;
  
  // Theming/branding
  theme?: Partial<Theme>;
  
  // Turnstile configuration
  turnstileKey?: string;
  
  // Custom hooks
  onSubmitSuccess?: (data: any) => void;
  onSubmitFailure?: (error: any) => void;
  beforeSubmitTransform?: (data: AppointmentFormData) => any;

  /** Fires once (first user focus/click/keypress) so host pages can push a
   *  “formInteracted” event to Google Tag Manager / Site Kit. */
  onInteraction?: () => void;
}

// Form submission states
type SubmissionState = 'idle' | 'submitting' | 'success' | 'error';

/**
 * AppointmentForm Component
 * 
 * A configurable form for senior living appointment requests that submits to the Enquire Solutions API.
 */
const AppointmentForm: React.FC<AppointmentFormProps> = ({
  communityName,
  redirectPath = DEFAULT_CONFIG.REDIRECT_PATH,
  redirectDelay = DEFAULT_CONFIG.REDIRECT_DELAY,
  globalDuplicateCheck = false,
  theme: customTheme,
  turnstileKey,
  onSubmitSuccess,
  onSubmitFailure,
  beforeSubmitTransform,
  onInteraction,
}) => {
  // Get theme from context or use provided theme
  const defaultTheme = useTheme();
  const theme = { ...defaultTheme, ...customTheme };
  
  // Log theme values for debugging
  useEffect(() => {
    console.log('[AppointmentForm] Theme values:', {
      defaultTheme,
      customTheme,
      mergedTheme: theme,
      primaryColor: theme.primaryColor,
      buttonText: theme.buttonText
    });
    
    // Check if CSS variables are set
    if (typeof window !== 'undefined') {
      const primaryColorVar = getComputedStyle(document.documentElement).getPropertyValue('--primary-color');
      console.log('[AppointmentForm] CSS variable --primary-color:', primaryColorVar);
    }
  }, [theme, defaultTheme, customTheme]);
  
  // Reference for Turnstile container
  const turnstileRef = useRef<HTMLDivElement>(null);
  
  // State for Turnstile token
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  // Form state using React Hook Form
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting: formSubmitting },
    reset,
    trigger,
    getValues,
    setError,
    clearErrors,
  } = useForm<AppointmentFormData>({
    // Basic client-side rules (HTML5 constraints); heavy validation is done server-side
    defaultValues: {
      CommunityName: communityName,
      SubmissionType: 'self',
      FirstName: '',
      LastName: '',
      Email: '',
      HomePhone: '',
      WorkPhone: '',
      MobilePhone: '',
      CareType: '',
      MarketSource: '',
      AddressLine1: '',
      AddressLine2: '',
      City: '',
      State: '',
      ZipCode: '',
      Message: '',
      // Contact fields for family member submissions
      ContactFirstName: '',
      ContactLastName: '',
      ContactEmail: '',
      ContactHomePhone: '',
      ContactWorkPhone: '',
      ContactMobilePhone: '',
      ContactAddressLine1: '',
      ContactAddressLine2: '',
      ContactCity: '',
      ContactState: '',
      ContactZipCode: '',
    },
  });

  // Watch the submission type to conditionally render fields
  const submissionType = useWatch({
    control,
    name: 'SubmissionType',
    defaultValue: 'self',
  });

  // State for submission status
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  // Track first user interaction for analytics
  const [hasInteracted, setHasInteracted] = useState<boolean>(false);

  /* ------------------------------------------------------------------
   * Debug / Dev – log validation errors whenever they appear so that
   * implementers can see what went wrong without digging into UI.
   * ----------------------------------------------------------------- */
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      logFormError('validation-error', errors);
    }
  }, [errors]);
  
  // Load Turnstile script and initialize
  useEffect(() => {
    if (!turnstileRef.current || !turnstileKey) return;

    // Reset token when form is reset
    if (submissionState === 'idle') {
      setTurnstileToken(null);
    }

    // Check if script is already loaded
    const existingScript = document.getElementById('cf-turnstile-script');
    if (existingScript) {
      // If already loaded, just render the widget
      if (window.turnstile) {
        renderTurnstile();
      }
      return;
    }

    // Load the Turnstile script
    const script = document.createElement('script');
    script.id = 'cf-turnstile-script';
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = renderTurnstile;
    document.head.appendChild(script);

    // Cleanup
    return () => {
      if (window.turnstile && turnstileRef.current) {
        // Remove any existing widgets
        const container = document.getElementById('cf-turnstile');
        if (container) {
          container.innerHTML = '';
        }
      }
    };
  }, [turnstileKey, submissionState]);

  // Function to render the Turnstile widget
  const renderTurnstile = () => {
    if (!window.turnstile || !turnstileRef.current || !turnstileKey) return;

    // Clear any existing widgets
    const container = document.getElementById('cf-turnstile');
    if (container) {
      container.innerHTML = '';
    }

    // Render the widget
    window.turnstile.render('#cf-turnstile', {
      sitekey: turnstileKey,
      callback: (token: string) => {
        setTurnstileToken(token);
      },
      'expired-callback': () => {
        setTurnstileToken(null);
      },
      theme: theme.primaryColor ? 'light' : 'auto',
    });
  };

  // Validate that at least one phone number is provided
  const validatePhoneFields = () => {
    const values = getValues();
    
    // For resident/prospect phone fields
    const hasResidentPhone = values.HomePhone || values.WorkPhone || values.MobilePhone;
    if (!hasResidentPhone) {
      setError('HomePhone', { 
        type: 'custom', 
        message: 'Please provide at least one phone number' 
      });
      return false;
    } else {
      clearErrors(['HomePhone', 'WorkPhone', 'MobilePhone']);
    }
    
    // For contact phone fields (only if submission type is family_member)
    if (values.SubmissionType === 'family_member') {
      const hasContactPhone = values.ContactHomePhone || values.ContactWorkPhone || values.ContactMobilePhone;
      if (!hasContactPhone) {
        setError('ContactHomePhone', { 
          type: 'custom', 
          message: 'Please provide at least one contact phone number' 
        });
        return false;
      } else {
        clearErrors(['ContactHomePhone', 'ContactWorkPhone', 'ContactMobilePhone']);
      }
    }
    
    return true;
  };

  // Handle form submission
  const onSubmit: SubmitHandler<AppointmentFormData> = async (data) => {
    try {
      // Validate phone fields
      if (!validatePhoneFields()) {
        return;
      }
      
      // Check if Turnstile is required but not completed
      if (turnstileKey && !turnstileToken) {
        setSubmissionState('error');
        setErrorMessage('Please complete the security check');
        return;
      }

      setIsSubmitting(true);
      setSubmissionState('submitting');
      setErrorMessage('');

      // Ensure community name is set
      const formData = {
        ...data,
        CommunityName: communityName,
        // Add the current URL for tracking purposes
        SubmittedFrom: typeof window !== 'undefined' ? window.location.href : '',
        // Add global duplicate check flag if needed
        globalDuplicateCheck,
        // Add Turnstile token if available
        turnstileToken: turnstileToken || undefined,
      };
      
      // Apply custom transformation if provided
      const payloadToSubmit = beforeSubmitTransform 
        ? beforeSubmitTransform(formData)
        : formData;
      
      console.log('[AppointmentForm] Submit initiated', payloadToSubmit);
      
      // Submit to our server-side API route
      const response = await fetch('/api/submit-appointment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payloadToSubmit),
      });
      
      // Parse the response
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to submit appointment request');
      }
      
      // Handle successful submission
      if (result.success) {
        setSubmissionState('success');
        reset(); // Clear form
        console.log('[AppointmentForm] Submission success', result);
        
        if (onSubmitSuccess) {
          onSubmitSuccess(result.data);
        }
        
        // Redirect after delay only if not embedded
        if (!isEmbedded() && redirectPath) {
          setTimeout(() => {
            window.location.href = redirectPath;
          }, redirectDelay);
        }
      } else {
        // API returned success: false
        throw new Error(result.message || ERROR_MESSAGES.SUBMISSION_FAILED);
      }
      
    } catch (error) {
      logFormError('submit', error);
      setSubmissionState('error');
      
      const errorMsg = error instanceof Error 
        ? error.message 
        : ERROR_MESSAGES.SUBMISSION_FAILED;
      
      setErrorMessage(errorMsg);
      
      if (onSubmitFailure) {
        onSubmitFailure(error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset error state when user interacts with form again
  const handleFormInteraction = () => {
    // Fire GTM-friendly callback once
    if (!hasInteracted) {
      setHasInteracted(true);
      onInteraction?.();
    }

    if (submissionState === 'error') {
      setSubmissionState('idle');
      setErrorMessage('');
    }
  };

  // Success message component
  const SuccessMessage = () => (
    <div className="success-message animate-fade-in" role="alert">
      <h3 className="text-lg font-medium mb-2">Thank You!</h3>
      <p>Your appointment request has been submitted successfully.</p>
      {/* Show redirect notice only when we will actually redirect */}
      {!isEmbedded() && redirectPath && (
        <p className="mt-2 text-sm animate-pulse-slow">
          You will be redirected shortly...
        </p>
      )}
    </div>
  );

  // Error message component
  const ErrorMessage = () => (
    <div className="error-message animate-fade-in" role="alert">
      <h3 className="text-lg font-medium mb-2">Error</h3>
      <p>{errorMessage}</p>
      <button 
        onClick={() => setSubmissionState('idle')}
        className="mt-2 py-1 px-3 bg-red-100 text-red-800 rounded-md hover:bg-red-200 transition-colors"
        type="button"
      >
        Try Again
      </button>
    </div>
  );

  // Loading indicator component
  const LoadingIndicator = () => (
    <div className="loading-indicator animate-fade-in" role="status">
      <div className="flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
      <p className="text-center mt-2">Submitting your request...</p>
    </div>
  );

  // Decode URL-encoded button text if needed
  const getButtonText = () => {
    let text = theme.buttonText || 'Request Appointment';
    // Check if the text contains URL encoding (like %20)
    if (text.includes('%')) {
      try {
        text = decodeURIComponent(text);
      } catch (e) {
        console.error('[AppointmentForm] Error decoding button text:', e);
      }
    }
    return isSubmitting ? 'Submitting...' : text;
  };

  return (
    <div 
      className="appointment-form-container" 
      onClick={handleFormInteraction}
      style={{
        '--primary-color': theme.primaryColor,
        '--secondary-color': theme.secondaryColor,
        fontFamily: theme.fontFamily,
      } as React.CSSProperties}
    >
      {theme.logoUrl && (
        <div className="logo-container">
          <img src={theme.logoUrl} alt={`${communityName} logo`} className="community-logo" />
        </div>
      )}
      
      <h2 className="text-2xl font-medium text-center mb-6 text-primary">Request an Appointment</h2>
      
      {submissionState === 'success' ? (
        <SuccessMessage />
      ) : submissionState === 'error' ? (
        <ErrorMessage />
      ) : submissionState === 'submitting' ? (
        <LoadingIndicator />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="animate-fade-in">
          {/* Hidden Community Name field */}
          <input type="hidden" {...register('CommunityName')} value={communityName} />
          
          {/* Submission Type Selection */}
          <div className="form-group mb-6">
            <label htmlFor="SubmissionType" className="block mb-2 font-medium text-gray-700">
              Who is this appointment for? <span className="text-error">*</span>
            </label>
            <Controller
              name="SubmissionType"
              control={control}
              render={({ field }) => (
                <select 
                  id="SubmissionType" 
                  {...field} 
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                    errors.SubmissionType ? 'border-error focus:ring-error' : 'border-gray-300'
                  }`}
                  aria-invalid={errors.SubmissionType ? 'true' : 'false'}
                >
                  <option value="">Please Select</option>
                  {SUBMISSION_TYPE_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            />
            {errors.SubmissionType && (
              <span className="error-text" role="alert">{errors.SubmissionType.message}</span>
            )}
          </div>
          
          {/* Resident/Prospect Information Section */}
          <div className="border-t border-gray-200 pt-4 mb-6">
            <h3 className="text-lg font-medium mb-3 text-gray-700">
              {submissionType === 'family_member' ? 'Resident Information' : 'Personal Information'}
            </h3>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="FirstName" className="block mb-2 font-medium text-gray-700">
                  First Name <span className="text-error">*</span>
                </label>
                <input
                  id="FirstName"
                  type="text"
                  {...register('FirstName')}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                    errors.FirstName ? 'border-error focus:ring-error' : 'border-gray-300'
                  }`}
                  aria-invalid={errors.FirstName ? 'true' : 'false'}
                />
                {errors.FirstName && (
                  <span className="error-text" role="alert">{errors.FirstName.message}</span>
                )}
              </div>
              
              <div className="form-group">
                <label htmlFor="LastName" className="block mb-2 font-medium text-gray-700">
                  Last Name <span className="text-error">*</span>
                </label>
                <input
                  id="LastName"
                  type="text"
                  {...register('LastName')}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                    errors.LastName ? 'border-error focus:ring-error' : 'border-gray-300'
                  }`}
                  aria-invalid={errors.LastName ? 'true' : 'false'}
                />
                {errors.LastName && (
                  <span className="error-text" role="alert">{errors.LastName.message}</span>
                )}
              </div>
            </div>
            
            {/* Email Field (separate) */}
            <div className="form-group mt-4">
              <label htmlFor="Email" className="block mb-2 font-medium text-gray-700">
                Email
              </label>
              <input
                id="Email"
                type="email"
                {...register('Email')}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                  errors.Email ? 'border-error focus:ring-error' : 'border-gray-300'
                }`}
                aria-invalid={errors.Email ? 'true' : 'false'}
              />
              {errors.Email && (
                <span className="error-text" role="alert">{errors.Email.message}</span>
              )}
            </div>
            
            {/* Contact Information Section */}
            <h4 className="text-md font-medium mb-3 mt-6 text-gray-700">Contact Information</h4>
            <p className="text-sm text-gray-500 mb-4">Please provide at least one phone number</p>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="HomePhone" className="block mb-2 font-medium text-gray-700">
                  Home Phone
                </label>
                <input
                  id="HomePhone"
                  type="tel"
                  {...register('HomePhone')}
                  placeholder="(123) 456-7890"
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                    errors.HomePhone ? 'border-error focus:ring-error' : 'border-gray-300'
                  }`}
                  aria-invalid={errors.HomePhone ? 'true' : 'false'}
                />
                {errors.HomePhone && (
                  <span className="error-text" role="alert">{errors.HomePhone.message}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="MobilePhone" className="block mb-2 font-medium text-gray-700">
                  Mobile Phone
                </label>
                <input
                  id="MobilePhone"
                  type="tel"
                  {...register('MobilePhone')}
                  placeholder="(123) 456-7890"
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                    errors.MobilePhone ? 'border-error focus:ring-error' : 'border-gray-300'
                  }`}
                  aria-invalid={errors.MobilePhone ? 'true' : 'false'}
                />
                {errors.MobilePhone && (
                  <span className="error-text" role="alert">{errors.MobilePhone.message}</span>
                )}
              </div>
            </div>

            <div className="form-group mt-4">
              <label htmlFor="WorkPhone" className="block mb-2 font-medium text-gray-700">
                Work Phone
              </label>
              <input
                id="WorkPhone"
                type="tel"
                {...register('WorkPhone')}
                placeholder="(123) 456-7890"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                  errors.WorkPhone ? 'border-error focus:ring-error' : 'border-gray-300'
                }`}
                aria-invalid={errors.WorkPhone ? 'true' : 'false'}
              />
              {errors.WorkPhone && (
                <span className="error-text" role="alert">{errors.WorkPhone.message}</span>
              )}
            </div>

            {/* Address Information Section */}
            <h4 className="text-md font-medium mb-3 mt-6 text-gray-700">Address Information</h4>
            <div className="form-group">
              <label htmlFor="AddressLine1" className="block mb-2 font-medium text-gray-700">
                Address Line 1
              </label>
              <input
                id="AddressLine1"
                type="text"
                {...register('AddressLine1')}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                  errors.AddressLine1 ? 'border-error focus:ring-error' : 'border-gray-300'
                }`}
                aria-invalid={errors.AddressLine1 ? 'true' : 'false'}
              />
              {errors.AddressLine1 && (
                <span className="error-text" role="alert">{errors.AddressLine1.message}</span>
              )}
            </div>

            <div className="form-group mt-4">
              <label htmlFor="AddressLine2" className="block mb-2 font-medium text-gray-700">
                Address Line 2
              </label>
              <input
                id="AddressLine2"
                type="text"
                {...register('AddressLine2')}
                className="w-full px-3 py-2 border rounded-md border-gray-300"
              />
            </div>

            <div className="form-row mt-4">
              <div className="form-group">
                <label htmlFor="City" className="block mb-2 font-medium text-gray-700">
                  City
                </label>
                <input
                  id="City"
                  type="text"
                  {...register('City')}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                    errors.City ? 'border-error focus:ring-error' : 'border-gray-300'
                  }`}
                  aria-invalid={errors.City ? 'true' : 'false'}
                />
                {errors.City && (
                  <span className="error-text" role="alert">{errors.City.message}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="State" className="block mb-2 font-medium text-gray-700">
                  State
                </label>
                <Controller
                  name="State"
                  control={control}
                  render={({ field }) => (
                    <select
                      id="State"
                      {...field}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                        errors.State ? 'border-error focus:ring-error' : 'border-gray-300'
                      }`}
                      aria-invalid={errors.State ? 'true' : 'false'}
                    >
                      <option value="">Select</option>
                      {US_STATES.map((st) => (
                        <option key={st.value} value={st.value}>
                          {st.label}
                        </option>
                      ))}
                    </select>
                  )}
                />
                {errors.State && (
                  <span className="error-text" role="alert">{errors.State.message}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="ZipCode" className="block mb-2 font-medium text-gray-700">
                  Zip Code
                </label>
                <input
                  id="ZipCode"
                  type="text"
                  {...register('ZipCode')}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                    errors.ZipCode ? 'border-error focus:ring-error' : 'border-gray-300'
                  }`}
                  aria-invalid={errors.ZipCode ? 'true' : 'false'}
                />
                {errors.ZipCode && (
                  <span className="error-text" role="alert">{errors.ZipCode.message}</span>
                )}
              </div>
            </div>
          </div>
          
          {/* Primary Contact Information - Only shown when submissionType is 'family_member' */}
          {submissionType === 'family_member' && (
            <div className="border-t border-gray-200 pt-4 mb-6 transition-all duration-300 ease-in-out">
              <h3 className="text-lg font-medium mb-3 text-gray-700">Primary Contact Information</h3>
              <p className="text-sm text-gray-500 mb-4">Please provide your contact information as the person submitting this request.</p>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="ContactFirstName" className="block mb-2 font-medium text-gray-700">
                    Your First Name <span className="text-error">*</span>
                  </label>
                  <input
                    id="ContactFirstName"
                    type="text"
                    {...register('ContactFirstName')}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                      errors.ContactFirstName ? 'border-error focus:ring-error' : 'border-gray-300'
                    }`}
                    aria-invalid={errors.ContactFirstName ? 'true' : 'false'}
                  />
                  {errors.ContactFirstName && (
                    <span className="error-text" role="alert">{errors.ContactFirstName.message}</span>
                  )}
                </div>
                
                <div className="form-group">
                  <label htmlFor="ContactLastName" className="block mb-2 font-medium text-gray-700">
                    Your Last Name <span className="text-error">*</span>
                  </label>
                  <input
                    id="ContactLastName"
                    type="text"
                    {...register('ContactLastName')}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                      errors.ContactLastName ? 'border-error focus:ring-error' : 'border-gray-300'
                    }`}
                    aria-invalid={errors.ContactLastName ? 'true' : 'false'}
                  />
                  {errors.ContactLastName && (
                    <span className="error-text" role="alert">{errors.ContactLastName.message}</span>
                  )}
                </div>
              </div>
              
              <div className="form-group mt-4">
                <label htmlFor="ContactEmail" className="block mb-2 font-medium text-gray-700">
                  Your Email <span className="text-error">*</span>
                </label>
                <input
                  id="ContactEmail"
                  type="email"
                  {...register('ContactEmail')}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                    errors.ContactEmail ? 'border-error focus:ring-error' : 'border-gray-300'
                  }`}
                  aria-invalid={errors.ContactEmail ? 'true' : 'false'}
                />
                {errors.ContactEmail && (
                  <span className="error-text" role="alert">{errors.ContactEmail.message}</span>
                )}
              </div>
              
              <div className="form-row mt-4">
                <p className="text-sm text-gray-500 mb-2 col-span-full">Please provide at least one phone number</p>
                <div className="form-group">
                  <label htmlFor="ContactHomePhone" className="block mb-2 font-medium text-gray-700">
                    Your Home Phone
                  </label>
                  <input
                    id="ContactHomePhone"
                    type="tel"
                    {...register('ContactHomePhone')}
                    placeholder="(123) 456-7890"
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                      errors.ContactHomePhone ? 'border-error focus:ring-error' : 'border-gray-300'
                    }`}
                    aria-invalid={errors.ContactHomePhone ? 'true' : 'false'}
                  />
                  {errors.ContactHomePhone && (
                    <span className="error-text" role="alert">{errors.ContactHomePhone.message}</span>
                  )}
                </div>
                
                <div className="form-group">
                  <label htmlFor="ContactMobilePhone" className="block mb-2 font-medium text-gray-700">
                    Your Mobile Phone
                  </label>
                  <input
                    id="ContactMobilePhone"
                    type="tel"
                    {...register('ContactMobilePhone')}
                    placeholder="(123) 456-7890"
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                      errors.ContactMobilePhone ? 'border-error focus:ring-error' : 'border-gray-300'
                    }`}
                    aria-invalid={errors.ContactMobilePhone ? 'true' : 'false'}
                  />
                  {errors.ContactMobilePhone && (
                    <span className="error-text" role="alert">{errors.ContactMobilePhone.message}</span>
                  )}
                </div>
              </div>
              
              <div className="form-group mt-4">
                <label htmlFor="ContactWorkPhone" className="block mb-2 font-medium text-gray-700">
                  Your Work Phone
                </label>
                <input
                  id="ContactWorkPhone"
                  type="tel"
                  {...register('ContactWorkPhone')}
                  placeholder="(123) 456-7890"
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                    errors.ContactWorkPhone ? 'border-error focus:ring-error' : 'border-gray-300'
                  }`}
                  aria-invalid={errors.ContactWorkPhone ? 'true' : 'false'}
                />
                {errors.ContactWorkPhone && (
                  <span className="error-text" role="alert">{errors.ContactWorkPhone.message}</span>
                )}
              </div>
              
              {/* Contact Address Section (collapsible) */}
              <details className="mt-4">
                <summary className="cursor-pointer text-md font-medium text-gray-700 py-2">
                  Your Address Information (optional)
                </summary>
                <div className="pl-4 pt-2 transition-all duration-300 ease-in-out">
                  <div className="form-group">
                    <label htmlFor="ContactAddressLine1" className="block mb-2 font-medium text-gray-700">
                      Address Line 1
                    </label>
                    <input
                      id="ContactAddressLine1"
                      type="text"
                      {...register('ContactAddressLine1')}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                        errors.ContactAddressLine1 ? 'border-error focus:ring-error' : 'border-gray-300'
                      }`}
                      aria-invalid={errors.ContactAddressLine1 ? 'true' : 'false'}
                    />
                    {errors.ContactAddressLine1 && (
                      <span className="error-text" role="alert">{errors.ContactAddressLine1.message}</span>
                    )}
                  </div>
                  
                  <div className="form-group mt-4">
                    <label htmlFor="ContactAddressLine2" className="block mb-2 font-medium text-gray-700">
                      Address Line 2
                    </label>
                    <input
                      id="ContactAddressLine2"
                      type="text"
                      {...register('ContactAddressLine2')}
                      className="w-full px-3 py-2 border rounded-md border-gray-300"
                    />
                  </div>
                  
                  <div className="form-row mt-4">
                    <div className="form-group">
                      <label htmlFor="ContactCity" className="block mb-2 font-medium text-gray-700">
                        City
                      </label>
                      <input
                        id="ContactCity"
                        type="text"
                        {...register('ContactCity')}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                          errors.ContactCity ? 'border-error focus:ring-error' : 'border-gray-300'
                        }`}
                        aria-invalid={errors.ContactCity ? 'true' : 'false'}
                      />
                      {errors.ContactCity && (
                        <span className="error-text" role="alert">{errors.ContactCity.message}</span>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="ContactState" className="block mb-2 font-medium text-gray-700">
                        State
                      </label>
                      <Controller
                        name="ContactState"
                        control={control}
                        render={({ field }) => (
                          <select
                            id="ContactState"
                            {...field}
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                              errors.ContactState ? 'border-error focus:ring-error' : 'border-gray-300'
                            }`}
                            aria-invalid={errors.ContactState ? 'true' : 'false'}
                          >
                            <option value="">Select</option>
                            {US_STATES.map((st) => (
                              <option key={st.value} value={st.value}>
                                {st.label}
                              </option>
                            ))}
                          </select>
                        )}
                      />
                      {errors.ContactState && (
                        <span className="error-text" role="alert">{errors.ContactState.message}</span>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="ContactZipCode" className="block mb-2 font-medium text-gray-700">
                        Zip Code
                      </label>
                      <input
                        id="ContactZipCode"
                        type="text"
                        {...register('ContactZipCode')}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                          errors.ContactZipCode ? 'border-error focus:ring-error' : 'border-gray-300'
                        }`}
                        aria-invalid={errors.ContactZipCode ? 'true' : 'false'}
                      />
                      {errors.ContactZipCode && (
                        <span className="error-text" role="alert">{errors.ContactZipCode.message}</span>
                      )}
                    </div>
                  </div>
                </div>
              </details>
            </div>
          )}
          
          {/* Preferences Section */}
          <div className="border-t border-gray-200 pt-4 mb-6">
            <h3 className="text-lg font-medium mb-3 text-gray-700">Preferences</h3>
            
            {/* Care Type Dropdown */}
            <div className="form-group">
              <label htmlFor="CareType" className="block mb-2 font-medium text-gray-700">
                Care Type
              </label>
              <Controller
                name="CareType"
                control={control}
                render={({ field }) => (
                  <select 
                    id="CareType" 
                    {...field} 
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                      errors.CareType ? 'border-error focus:ring-error' : 'border-gray-300'
                    }`}
                    aria-invalid={errors.CareType ? 'true' : 'false'}
                  >
                    <option value="">Select Care Type</option>
                    {CARE_TYPE_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
              />
              {errors.CareType && (
                <span className="error-text" role="alert">{errors.CareType.message}</span>
              )}
            </div>
            
            {/* Market Source Dropdown */}
            <div className="form-group mt-4">
              <label htmlFor="MarketSource" className="block mb-2 font-medium text-gray-700">
                How did you hear about us?
              </label>
              <Controller
                name="MarketSource"
                control={control}
                render={({ field }) => (
                  <select 
                    id="MarketSource" 
                    {...field} 
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                      errors.MarketSource ? 'border-error focus:ring-error' : 'border-gray-300'
                    }`}
                    aria-invalid={errors.MarketSource ? 'true' : 'false'}
                  >
                    <option value="">Select Source</option>
                    {MARKET_SOURCE_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
              />
              {errors.MarketSource && (
                <span className="error-text" role="alert">{errors.MarketSource.message}</span>
              )}
            </div>
            
            {/* Message Textarea */}
            <div className="form-group mt-6">
              <label htmlFor="Message" className="block mb-2 font-medium text-gray-700">
                Message (Notes)
              </label>
              <textarea
                id="Message"
                {...register('Message')}
                rows={4}
                placeholder="Please share any additional information about your visit request..."
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                  errors.Message ? 'border-error focus:ring-error' : 'border-gray-300'
                }`}
                aria-invalid={errors.Message ? 'true' : 'false'}
              />
              {errors.Message && (
                <span className="error-text" role="alert">{errors.Message.message}</span>
              )}
            </div>
          </div>
          
          {/* Cloudflare Turnstile */}
          {turnstileKey && (
            <div className="form-group turnstile-container mt-6">
              <div 
                id="cf-turnstile" 
                ref={turnstileRef}
                className="flex justify-center"
              ></div>
              {!turnstileToken && (
                <span className="error-text text-center block mt-2" role="alert">
                  Please complete the security check
                </span>
              )}
            </div>
          )}
          
          {/* Submit Button */}
          <div className="form-group submit-container mt-6">
            {/* Debug logging for theme values */}
            {process.env.NODE_ENV !== 'production' && (
              <div className="debug-info mb-2 text-xs bg-gray-100 p-2 rounded">
                <strong>Debug:</strong> primaryColor: {theme.primaryColor || 'undefined'}, 
                buttonText: {theme.buttonText || 'undefined'}
              </div>
            )}
            
            <button 
              type="submit" 
              disabled={isSubmitting || formSubmitting || (!!turnstileKey && !turnstileToken)}
              className="w-full py-3 px-4 font-medium text-white rounded-md transition-colors hover:opacity-90 disabled:opacity-70 disabled:cursor-not-allowed embedded-submit-button"
              style={{ 
                backgroundColor: theme.primaryColor || '#0066cc',
                color: '#ffffff',
                opacity: 1,
                visibility: 'visible',
                display: 'block'
              }}
            >
              {getButtonText()}
            </button>
          </div>
          
          {/* Privacy notice */}
          <div className="mt-4 text-center text-sm text-gray-500">
            By submitting this form, you agree to our privacy policy and consent to be contacted regarding your request.
          </div>
        </form>
      )}
      
      {/* Add CSS for smooth transitions */}
      <style jsx>{`
        .form-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }
        
        .animate-fade-in {
          animation: fadeIn 0.3s ease-in-out;
        }
        
        .animate-pulse-slow {
          animation: pulse 2s infinite;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        
        details summary::-webkit-details-marker {
          display: none;
        }
        
        details summary::before {
          content: '▶';
          display: inline-block;
          margin-right: 0.5rem;
          transition: transform 0.3s;
        }
        
        details[open] summary::before {
          transform: rotate(90deg);
        }
        
        details[open] > div {
          animation: slideDown 0.3s ease-in-out;
        }
        
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        /* Super aggressive button styling for embedded contexts */
        .appointment-form-container .submit-container .embedded-submit-button,
        .appointment-form-container form .embedded-submit-button,
        button.embedded-submit-button,
        input[type="submit"].embedded-submit-button {
          opacity: 1 !important;
          visibility: visible !important;
          display: block !important;
          z-index: 100 !important;
          position: relative !important;
          background-color: var(--primary-color, #0066cc) !important;
          color: #ffffff !important;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1) !important;
          transform: translateZ(0) !important;
          -webkit-transform: translateZ(0) !important;
          -webkit-appearance: none !important;
          appearance: none !important;
          border: 2px solid transparent !important;
          outline: none !important;
          text-shadow: none !important;
          font-weight: 600 !important;
          font-family: inherit !important;
          text-decoration: none !important;
          line-height: 1.5 !important;
          letter-spacing: normal !important;
          text-transform: none !important;
          transition: background-color 0.2s ease-in-out !important;
        }

        /* Hover and focus states */
        .appointment-form-container .submit-container .embedded-submit-button:hover,
        .appointment-form-container form .embedded-submit-button:hover,
        button.embedded-submit-button:hover,
        input[type="submit"].embedded-submit-button:hover,
        .appointment-form-container .submit-container .embedded-submit-button:focus,
        .appointment-form-container form .embedded-submit-button:focus,
        button.embedded-submit-button:focus,
        input[type="submit"].embedded-submit-button:focus {
          background-color: var(--primary-color, #0066cc) !important;
          color: #ffffff !important;
          opacity: 0.9 !important;
          border-color: transparent !important;
          outline: none !important;
        }

        /* Disabled state */
        .appointment-form-container .submit-container .embedded-submit-button:disabled,
        .appointment-form-container form .embedded-submit-button:disabled,
        button.embedded-submit-button:disabled,
        input[type="submit"].embedded-submit-button:disabled {
          opacity: 0.7 !important;
          cursor: not-allowed !important;
          background-color: var(--primary-color, #0066cc) !important;
          color: #ffffff !important;
        }
        
        /* Make sure error text is visible */
        .error-text {
          color: #dc3545;
          font-size: 0.875rem;
          margin-top: 0.25rem;
          display: block;
        }
        
        /* Ensure form controls have proper contrast */
        input, select, textarea {
          background-color: #ffffff !important;
          color: #333333 !important;
        }
      `}</style>
    </div>
  );
};

export default AppointmentForm;
