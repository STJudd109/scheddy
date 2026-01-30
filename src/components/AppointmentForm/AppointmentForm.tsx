import React, { useState, useEffect, useRef } from 'react';
import { useForm, Controller, SubmitHandler, useWatch } from 'react-hook-form';
import { useTheme, Theme } from '../ThemeProvider';
import { AnimatePresence, motion } from 'framer-motion';
import { Modal } from '../ui/modal';
import { 
  CARE_TYPE_OPTIONS, 
  MARKET_SOURCE_OPTIONS, 
  VALIDATION_PATTERNS, 
  ERROR_MESSAGES,
  DEFAULT_CONFIG,
  US_STATES,
  SUBMISSION_TYPE_OPTIONS,
  DEFAULT_SCHEDULING_URL
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
   *  "formInteracted" event to Google Tag Manager / Site Kit. */
  onInteraction?: () => void;
  
  // Wizard and scheduling configuration
  schedulingUrl?: string;
  schedulingProvider?: 'calendly' | 'calcom';
  schedulingOptional?: boolean;
  wizard?: boolean;
}

// Form submission states
type SubmissionState = 'idle' | 'submitting' | 'success' | 'error';

// Step types for the wizard
type StepType = 'submission' | 'personal' | 'preferences' | 'schedule' | 'review';

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
  schedulingUrl = DEFAULT_SCHEDULING_URL,
  schedulingProvider = 'calendly',
  schedulingOptional = true,
  wizard = true,
}) => {
  // Get theme from context or use provided theme
  const defaultTheme = useTheme();
  const theme = { ...defaultTheme, ...customTheme };
  
  // Wizard step state
  const [currentStep, setCurrentStep] = useState<StepType>('submission');
  const [stepHistory, setStepHistory] = useState<StepType[]>(['submission']);
  
  // Schedule modal state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  
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
  
  // Reference for scheduling iframe
  const schedulingIframeRef = useRef<HTMLIFrameElement>(null);
  const [schedulingComplete, setSchedulingComplete] = useState<boolean>(false);

  /* ------------------------------------------------------------------
   * Debug / Dev – log validation errors whenever they appear so that
   * implementers can see what went wrong without digging into UI.
   * ----------------------------------------------------------------- */
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      logFormError('validation-error', errors);
    }
  }, [errors]);
  
  // Auto-open modal on entering schedule step
  useEffect(() => {
    if (currentStep === 'schedule' && schedulingUrl) {
      setIsScheduleModalOpen(true);
    }
  }, [currentStep, schedulingUrl]);
  
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
        // Add scheduling information if completed
        SchedulingCompleted: schedulingComplete,
        SchedulingProvider: schedulingComplete ? schedulingProvider : undefined,
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

        // Redirect when not embedded
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
  
  // Handle step navigation
  const goToNextStep = async () => {
    // Validate current step before proceeding
    let canProceed = true;
    
    if (currentStep === 'submission') {
      // Validate submission type is selected
      canProceed = await trigger('SubmissionType');
    }
    else if (currentStep === 'personal') {
      // Validate required personal fields
      canProceed = await trigger(['FirstName', 'LastName']);
      
      // If family member, also validate contact fields
      if (canProceed && submissionType === 'family_member') {
        canProceed = await trigger(['ContactFirstName', 'ContactLastName', 'ContactEmail']);
      }
    }
    
    if (!canProceed) return;
    
    // Determine next step
    let nextStep: StepType;
    switch (currentStep) {
      case 'submission':
        nextStep = 'personal';
        break;
      case 'personal':
        nextStep = 'preferences';
        break;
      case 'preferences':
        nextStep = schedulingUrl ? 'schedule' : 'review';
        break;
      case 'schedule':
        nextStep = 'review';
        break;
      default:
        nextStep = 'review';
    }
    
    // Update step state
    setCurrentStep(nextStep);
    setStepHistory([...stepHistory, nextStep]);
  };
  
  const goToPreviousStep = () => {
    if (stepHistory.length <= 1) return;
    
    // Remove current step from history
    const newHistory = [...stepHistory];
    newHistory.pop();
    
    // Set current step to the previous one
    const previousStep = newHistory[newHistory.length - 1];
    setCurrentStep(previousStep);
    setStepHistory(newHistory);
  };
  
  // Skip scheduling step
  const skipScheduling = () => {
    if (currentStep === 'schedule') {
      setCurrentStep('review');
      setStepHistory([...stepHistory, 'review']);
    }
  };
  
  // Handle scheduling completion
  const handleSchedulingComplete = () => {
    setSchedulingComplete(true);
    goToNextStep();
  };
  
  // Load scheduling provider script when modal opens
  useEffect(() => {
    if (!schedulingUrl || !isScheduleModalOpen) return;
    
    if (schedulingProvider === 'calendly') {
      // Load Calendly script if not already loaded
      if (!document.getElementById('calendly-script')) {
        const script = document.createElement('script');
        script.id = 'calendly-script';
        script.src = 'https://assets.calendly.com/assets/external/widget.js';
        script.async = true;
        document.head.appendChild(script);
      }
    } else if (schedulingProvider === 'calcom') {
      // Load Cal.com script if not already loaded
      if (!document.getElementById('calcom-script')) {
        const script = document.createElement('script');
        script.id = 'calcom-script';
        script.src = 'https://cal.com/embed.js';
        script.async = true;
        document.head.appendChild(script);
      }
    }
  }, [schedulingUrl, schedulingProvider, isScheduleModalOpen]);

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
  
  // Scheduling step component
  const SchedulingStep = () => {
    if (!schedulingUrl) return null;
    
    return (
      <div className="scheduling-step">
        <h3 className="text-2xl font-medium mb-6 text-center">Schedule Your Visit</h3>
        <p className="text-center mb-6">Please select a date and time for your visit.</p>
        
        {/* Action buttons */}
        <div className="text-center mt-4 flex flex-col items-center gap-3">
          {/* Primary button to open scheduling modal */}
          <button
            type="button"
            onClick={() => setIsScheduleModalOpen(true)}
            className="py-2 px-6 font-medium text-white rounded-md transition-colors hover:opacity-90"
            style={{ backgroundColor: theme.primaryColor || '#0066cc' }}
          >
            Schedule Now
          </button>

          {/* Optional skip link – only rendered when schedulingOptional === true */}
          {schedulingOptional && (
            <button
              type="button"
              onClick={skipScheduling}
              className="text-gray-500 underline hover:text-gray-700"
            >
              Skip scheduling for now
            </button>
          )}
        </div>
        
        {/* Scheduling Modal */}
        <Modal 
          open={isScheduleModalOpen} 
          onClose={() => setIsScheduleModalOpen(false)}
          title="Schedule Your Visit"
        >
          {schedulingProvider === 'calendly' && (
            <div 
              className="calendly-inline-widget" 
              data-url={schedulingUrl}
              style={{ minWidth: '320px', height: '580px' }}
            ></div>
          )}
          
          {schedulingProvider === 'calcom' && (
            <div 
              className="cal-inline-widget" 
              data-cal-link={schedulingUrl}
              style={{ minWidth: '320px', height: '580px' }}
            ></div>
          )}
          
          <div className="mt-4 flex justify-center gap-4">
            <button
              type="button"
              onClick={() => {
                setIsScheduleModalOpen(false);
                setSchedulingComplete(true);
                goToNextStep();
              }}
              className="py-2 px-6 font-medium text-white rounded-md transition-colors hover:opacity-90"
              style={{ backgroundColor: theme.primaryColor || '#0066cc' }}
            >
              Done
            </button>
            
            {schedulingOptional && (
              <button
                type="button"
                onClick={() => {
                  setIsScheduleModalOpen(false);
                  skipScheduling();
                }}
                className="py-2 px-6 text-gray-500 hover:text-gray-700"
              >
                Skip
              </button>
            )}
          </div>
        </Modal>
      </div>
    );
  };
  
  // Render the form with wizard if enabled
  const renderForm = () => {
    if (submissionState === 'success') {
      return <SuccessMessage />;
    } 
    
    if (submissionState === 'error') {
      return <ErrorMessage />;
    } 
    
    if (submissionState === 'submitting') {
      return <LoadingIndicator />;
    }
    
    if (!wizard) {
      // Render the original form without wizard
      return (
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
      );
    }
    
    // Stable slide indexing to avoid peeking/overflow issues
    const stepOrder: StepType[] = schedulingUrl
      ? ['submission', 'personal', 'preferences', 'schedule', 'review']
      : ['submission', 'personal', 'preferences', 'review'];
    
    // Helper to render the current step content
    const renderStepContent = () => {
      switch(currentStep) {
        case 'submission':
          return (
            <>
              <h2 className="text-2xl font-medium mb-6 text-center">
                We would love to have you tour our community.
              </h2>
              <h3 className="text-xl mb-6 text-center">
                Could you please tell me who is interested in moving to {communityName}?
              </h3>
              
              <div className="form-group mb-6">
                <Controller
                  name="SubmissionType"
                  control={control}
                  rules={{ required: 'Please select who this appointment is for' }}
                  render={({ field }) => (
                    <div className="flex flex-col gap-4">
                      {SUBMISSION_TYPE_OPTIONS.map(option => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            field.onChange(option.value);
                            setTimeout(goToNextStep, 100);
                          }}
                          className="w-full py-3 px-4 font-medium text-white rounded-md transition-colors hover:opacity-90"
                          style={{ backgroundColor: theme.primaryColor || '#0066cc' }}
                        >
                          {option.value === 'self' ? 'Myself' : 'Family Member'}
                        </button>
                      ))}
                    </div>
                  )}
                />
                {errors.SubmissionType && (
                  <span className="error-text text-center block mt-4" role="alert">
                    {errors.SubmissionType.message}
                  </span>
                )}
              </div>
            </>
          );
        case 'personal':
          return (
            <>
              <h2 className="text-2xl font-medium mb-6 text-center">
                Please provide {submissionType === 'family_member' ? 'their' : 'your'} information
              </h2>
              
              <div className="form-group mb-4">
                <label htmlFor="FirstName" className="block mb-2 font-medium text-gray-700">
                  First Name <span className="text-error">*</span>
                </label>
                <input
                  id="FirstName"
                  type="text"
                  {...register('FirstName', { required: 'First name is required' })}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                    errors.FirstName ? 'border-error focus:ring-error' : 'border-gray-300'
                  }`}
                  aria-invalid={errors.FirstName ? 'true' : 'false'}
                />
                {errors.FirstName && (
                  <span className="error-text" role="alert">{errors.FirstName.message}</span>
                )}
              </div>
              
              <div className="form-group mb-4">
                <label htmlFor="LastName" className="block mb-2 font-medium text-gray-700">
                  Last Name <span className="text-error">*</span>
                </label>
                <input
                  id="LastName"
                  type="text"
                  {...register('LastName', { required: 'Last name is required' })}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                    errors.LastName ? 'border-error focus:ring-error' : 'border-gray-300'
                  }`}
                  aria-invalid={errors.LastName ? 'true' : 'false'}
                />
                {errors.LastName && (
                  <span className="error-text" role="alert">{errors.LastName.message}</span>
                )}
              </div>
              
              <div className="form-group mb-4">
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
              
              <div className="form-group mb-4">
                <label htmlFor="HomePhone" className="block mb-2 font-medium text-gray-700">
                  Phone Number <span className="text-error">*</span>
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
              
              {/* Primary Contact Information - Only shown when submissionType is 'family_member' */}
              {submissionType === 'family_member' && (
                <div className="mt-8 mb-4">
                  <h3 className="text-lg font-medium mb-4 text-gray-700">Your Contact Information</h3>
                  
                  <div className="form-group mb-4">
                    <label htmlFor="ContactFirstName" className="block mb-2 font-medium text-gray-700">
                      Your First Name <span className="text-error">*</span>
                    </label>
                    <input
                      id="ContactFirstName"
                      type="text"
                      {...register('ContactFirstName', { required: 'Your first name is required' })}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                        errors.ContactFirstName ? 'border-error focus:ring-error' : 'border-gray-300'
                      }`}
                      aria-invalid={errors.ContactFirstName ? 'true' : 'false'}
                    />
                    {errors.ContactFirstName && (
                      <span className="error-text" role="alert">{errors.ContactFirstName.message}</span>
                    )}
                  </div>
                  
                  <div className="form-group mb-4">
                    <label htmlFor="ContactLastName" className="block mb-2 font-medium text-gray-700">
                      Your Last Name <span className="text-error">*</span>
                    </label>
                    <input
                      id="ContactLastName"
                      type="text"
                      {...register('ContactLastName', { required: 'Your last name is required' })}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                        errors.ContactLastName ? 'border-error focus:ring-error' : 'border-gray-300'
                      }`}
                      aria-invalid={errors.ContactLastName ? 'true' : 'false'}
                    />
                    {errors.ContactLastName && (
                      <span className="error-text" role="alert">{errors.ContactLastName.message}</span>
                    )}
                  </div>
                  
                  <div className="form-group mb-4">
                    <label htmlFor="ContactEmail" className="block mb-2 font-medium text-gray-700">
                      Your Email <span className="text-error">*</span>
                    </label>
                    <input
                      id="ContactEmail"
                      type="email"
                      {...register('ContactEmail', { required: 'Your email is required' })}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                        errors.ContactEmail ? 'border-error focus:ring-error' : 'border-gray-300'
                      }`}
                      aria-invalid={errors.ContactEmail ? 'true' : 'false'}
                    />
                    {errors.ContactEmail && (
                      <span className="error-text" role="alert">{errors.ContactEmail.message}</span>
                    )}
                  </div>
                  
                  <div className="form-group mb-4">
                    <label htmlFor="ContactHomePhone" className="block mb-2 font-medium text-gray-700">
                      Your Phone Number <span className="text-error">*</span>
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
                </div>
              )}
            </>
          );
        case 'preferences':
          return (
            <>
              <h2 className="text-2xl font-medium mb-6 text-center">
                What is {submissionType === 'family_member' ? 'their' : 'your'} timeline for potentially making a move?
              </h2>
              
              <div className="form-group mb-8">
                <div className="flex flex-col gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      const formData = getValues();
                      formData.Message = (formData.Message || '') + '\nTimeline: Immediately';
                      goToNextStep();
                    }}
                    className="w-full py-3 px-4 font-medium text-white rounded-md transition-colors hover:opacity-90"
                    style={{ backgroundColor: theme.primaryColor || '#0066cc' }}
                  >
                    Immediately
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      const formData = getValues();
                      formData.Message = (formData.Message || '') + '\nTimeline: 1-3 Months';
                      goToNextStep();
                    }}
                    className="w-full py-3 px-4 font-medium text-white rounded-md transition-colors hover:opacity-90"
                    style={{ backgroundColor: theme.primaryColor || '#0066cc' }}
                  >
                    1 - 3 Months
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      const formData = getValues();
                      formData.Message = (formData.Message || '') + '\nTimeline: 3+ Months';
                      goToNextStep();
                    }}
                    className="w-full py-3 px-4 font-medium text-white rounded-md transition-colors hover:opacity-90"
                    style={{ backgroundColor: theme.primaryColor || '#0066cc' }}
                  >
                    3 Months +
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      const formData = getValues();
                      formData.Message = (formData.Message || '') + '\nTimeline: Just Researching';
                      goToNextStep();
                    }}
                    className="w-full py-3 px-4 font-medium text-white rounded-md transition-colors hover:opacity-90"
                    style={{ backgroundColor: theme.primaryColor || '#0066cc' }}
                  >
                    Just Researching
                  </button>
                </div>
              </div>
            </>
          );
        case 'schedule':
          return <SchedulingStep />;
        case 'review':
          return (
            <>
              <h2 className="text-2xl font-medium mb-6 text-center">
                Please review and submit your request
              </h2>
              
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3">Contact Information</h3>
                <p>
                  <strong>Name:</strong> {getValues('FirstName')} {getValues('LastName')}
                </p>
                {getValues('Email') && (
                  <p><strong>Email:</strong> {getValues('Email')}</p>
                )}
                <p>
                  <strong>Phone:</strong> {getValues('HomePhone') || getValues('MobilePhone') || getValues('WorkPhone')}
                </p>
                
                {submissionType === 'family_member' && (
                  <div className="mt-4">
                    <h3 className="text-lg font-medium mb-2">Your Information</h3>
                    <p>
                      <strong>Name:</strong> {getValues('ContactFirstName')} {getValues('ContactLastName')}
                    </p>
                    <p><strong>Email:</strong> {getValues('ContactEmail')}</p>
                    <p>
                      <strong>Phone:</strong> {getValues('ContactHomePhone') || getValues('ContactMobilePhone') || getValues('ContactWorkPhone')}
                    </p>
                  </div>
                )}
              </div>
              
              {/* Scheduling status */}
              {schedulingUrl && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-2">Scheduling Status</h3>
                  <p>
                    {schedulingComplete ? (
                      <span className="text-green-600">✓ Appointment scheduled</span>
                    ) : (
                      <span className="text-gray-500">No appointment scheduled</span>
                    )}
                  </p>
                </div>
              )}
              
              {/* Cloudflare Turnstile */}
              {turnstileKey && (
                <div className="form-group turnstile-container mt-6 mb-6">
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
                  className="w-full py-3 px-4 font-medium text-white rounded-md transition-colors hover:opacity-90 disabled:opacity-70 disabled:cursor-not-allowed embedded-submit-button"
                  style={{ 
                    backgroundColor: theme.primaryColor || '#0066cc',
                    color: '#ffffff'
                  }}
                >
                  {getButtonText()}
                </button>
              </div>
              
              {/* Privacy notice */}
              <div className="mt-4 text-center text-sm text-gray-500">
                By submitting this form, you agree to our privacy policy and consent to be contacted regarding your request.
              </div>
            </>
          );
        default:
          return null;
      }
    };
    
    return (
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="animate-fade-in">
        {/* Hidden Community Name field */}
        <input type="hidden" {...register('CommunityName')} value={communityName} />
        
        <AnimatePresence mode="wait">
          <motion.div 
            key={currentStep} 
            initial={{ opacity: 0, x: 24 }} 
            animate={{ opacity: 1, x: 0 }} 
            exit={{ opacity: 0, x: -24 }}
            className="p-4"
          >
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>

        {/* Wizard navigation (outside of animated panel) */}
        {currentStep !== 'review' && (
          <div className="wizard-navigation mt-6 flex justify-between">
            <div>
              {currentStep !== 'submission' && (
                <button
                  type="button"
                  onClick={goToPreviousStep}
                  className="py-2 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Back
                </button>
              )}
            </div>
            <div>
              <button
                type="button"
                onClick={goToNextStep}
                className="py-2 px-4 font-medium text-white rounded-md transition-colors hover:opacity-90"
                style={{ backgroundColor: theme.primaryColor || '#0066cc' }}
                disabled={isSubmitting || formSubmitting}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </form>
    );
  };

  // Fallback (should not reach here)
  return renderForm();
};

export default AppointmentForm;