import React, { useState, useEffect, useRef } from 'react';
import { useForm, Controller, SubmitHandler, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
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
}

// Form submission states
type SubmissionState = 'idle' | 'submitting' | 'success' | 'error';

// Create a dynamic validation schema based on submission type
const createValidationSchema = () => {
  return yup.object().shape({
    // Common fields for all submission types
    SubmissionType: yup.string().required('Please select who you are requesting for'),
    FirstName: yup.string()
      .required(ERROR_MESSAGES.REQUIRED)
      .matches(VALIDATION_PATTERNS.NAME, ERROR_MESSAGES.INVALID_NAME),
    LastName: yup.string()
      .required(ERROR_MESSAGES.REQUIRED)
      .matches(VALIDATION_PATTERNS.NAME, ERROR_MESSAGES.INVALID_NAME),
    Email: yup.string()
      .email(ERROR_MESSAGES.INVALID_EMAIL),
    HomePhone: yup.string()
      .matches(VALIDATION_PATTERNS.HOME_PHONE, ERROR_MESSAGES.INVALID_PHONE)
      .optional(),
    WorkPhone: yup.string()
      .matches(VALIDATION_PATTERNS.WORK_PHONE, ERROR_MESSAGES.INVALID_PHONE)
      .optional(),
    MobilePhone: yup.string()
      .matches(VALIDATION_PATTERNS.MOBILE_PHONE, ERROR_MESSAGES.INVALID_PHONE)
      .optional(),
    AddressLine1: yup.string()
      .matches(VALIDATION_PATTERNS.ADDRESS_LINE, ERROR_MESSAGES.INVALID_ADDRESS)
      .optional(),
    AddressLine2: yup.string()
      .optional(),
    City: yup.string()
      .matches(VALIDATION_PATTERNS.CITY, ERROR_MESSAGES.INVALID_CITY)
      .optional(),
    State: yup.string()
      .matches(VALIDATION_PATTERNS.STATE, ERROR_MESSAGES.INVALID_STATE)
      .optional(),
    ZipCode: yup.string()
      .matches(VALIDATION_PATTERNS.ZIP_CODE, ERROR_MESSAGES.INVALID_ZIP)
      .optional(),
    CareType: yup.string(),
    MarketSource: yup.string(),
    Message: yup.string(),
    
    // Contact fields (conditionally required for family_member submissions)
    ContactFirstName: yup.string()
      .when('SubmissionType', {
        is: 'family_member',
        then: (schema) => schema
          .required('Contact first name is required')
          .matches(VALIDATION_PATTERNS.NAME, ERROR_MESSAGES.INVALID_NAME),
        otherwise: (schema) => schema.optional()
      }),
    ContactLastName: yup.string()
      .when('SubmissionType', {
        is: 'family_member',
        then: (schema) => schema
          .required('Contact last name is required')
          .matches(VALIDATION_PATTERNS.NAME, ERROR_MESSAGES.INVALID_NAME),
        otherwise: (schema) => schema.optional()
      }),
    ContactEmail: yup.string()
      .when('SubmissionType', {
        is: 'family_member',
        then: (schema) => schema
          .required('Contact email is required')
          .email(ERROR_MESSAGES.INVALID_EMAIL),
        otherwise: (schema) => schema.optional()
      }),
    ContactHomePhone: yup.string()
      .matches(VALIDATION_PATTERNS.HOME_PHONE, ERROR_MESSAGES.INVALID_PHONE)
      .optional(),
    ContactWorkPhone: yup.string()
      .matches(VALIDATION_PATTERNS.WORK_PHONE, ERROR_MESSAGES.INVALID_PHONE)
      .optional(),
    ContactMobilePhone: yup.string()
      .matches(VALIDATION_PATTERNS.MOBILE_PHONE, ERROR_MESSAGES.INVALID_PHONE)
      .optional(),
    ContactAddressLine1: yup.string()
      .matches(VALIDATION_PATTERNS.ADDRESS_LINE, ERROR_MESSAGES.INVALID_ADDRESS)
      .optional(),
    ContactAddressLine2: yup.string()
      .optional(),
    ContactCity: yup.string()
      .matches(VALIDATION_PATTERNS.CITY, ERROR_MESSAGES.INVALID_CITY)
      .optional(),
    ContactState: yup.string()
      .matches(VALIDATION_PATTERNS.STATE, ERROR_MESSAGES.INVALID_STATE)
      .optional(),
    ContactZipCode: yup.string()
      .matches(VALIDATION_PATTERNS.ZIP_CODE, ERROR_MESSAGES.INVALID_ZIP)
      .optional(),
  });
};

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
}) => {
  // Get theme from context or use provided theme
  const defaultTheme = useTheme();
  const theme = { ...defaultTheme, ...customTheme };
  
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
  } = useForm<AppointmentFormData>({
    resolver: yupResolver(createValidationSchema()),
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

  // Handle form submission
  const onSubmit: SubmitHandler<AppointmentFormData> = async (data) => {
    try {
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
        
        // Redirect after delay
        if (redirectPath) {
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
      <p className="mt-2 text-sm animate-pulse-slow">You will be redirected shortly...</p>
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
            <button 
              type="submit" 
              disabled={isSubmitting || formSubmitting || (!!turnstileKey && !turnstileToken)}
              className="w-full py-3 px-4 font-medium text-white rounded-md transition-colors hover:opacity-90 disabled:opacity-70 disabled:cursor-not-allowed"
              style={{ backgroundColor: theme.primaryColor }}
            >
              {isSubmitting ? 'Submitting...' : theme.buttonText || 'Request Appointment'}
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
      `}</style>
    </div>
  );
};

export default AppointmentForm;
