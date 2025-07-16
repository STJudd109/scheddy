import React, { useState, useEffect } from 'react';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useTheme, Theme } from '../ThemeProvider';
import { 
  CARE_TYPE_OPTIONS, 
  MARKET_SOURCE_OPTIONS, 
  VALIDATION_PATTERNS, 
  ERROR_MESSAGES,
  DEFAULT_CONFIG
} from '../../lib/constants';
import { AppointmentFormData } from '../../types/enquire';

// Import for API (will create later)
// import createEnquireApi, { getSubmissionStatus } from '../../lib/api';
// import { transformPayload, commonTransformers } from '../../lib/transformPayload';

/**
 * Internal helper for consistent console-logging of errors originating
 * from this form.  Having a single place makes it easier to swap to a
 * remote logger later (Datadog, Sentry, etc.).
 */
const logFormError = (context: string, err: unknown): void => {
  // eslint-disable-next-line no-console
  console.error(`[AppointmentForm] ${context}`, err);
};

// Props for the AppointmentForm component
interface AppointmentFormProps {
  // API and community configuration
  apiKey: string;
  communityName: string;
  apiEndpoint?: string;
  redirectPath?: string;
  redirectDelay?: number;
  globalDuplicateCheck?: boolean;
  
  // Theming/branding
  theme?: Partial<Theme>;
  
  // Custom hooks
  onSubmitSuccess?: (data: any) => void;
  onSubmitFailure?: (error: any) => void;
  beforeSubmitTransform?: (data: AppointmentFormData) => any;
}

// Form submission states
type SubmissionState = 'idle' | 'submitting' | 'success' | 'error';

// Validation schema for the form
const validationSchema = yup.object().shape({
  FirstName: yup.string()
    .required(ERROR_MESSAGES.REQUIRED)
    .matches(VALIDATION_PATTERNS.NAME, ERROR_MESSAGES.INVALID_NAME),
  LastName: yup.string()
    .required(ERROR_MESSAGES.REQUIRED)
    .matches(VALIDATION_PATTERNS.NAME, ERROR_MESSAGES.INVALID_NAME),
  Email: yup.string()
    .email(ERROR_MESSAGES.INVALID_EMAIL),
  Phone: yup.string()
    .matches(VALIDATION_PATTERNS.PHONE, ERROR_MESSAGES.INVALID_PHONE),
  CareType: yup.string(),
  MarketSource: yup.string(),
  Message: yup.string(),
});

/**
 * AppointmentForm Component
 * 
 * A configurable form for senior living appointment requests that submits to the Enquire Solutions API.
 */
const AppointmentForm: React.FC<AppointmentFormProps> = ({
  apiKey,
  communityName,
  apiEndpoint,
  redirectPath = DEFAULT_CONFIG.REDIRECT_PATH,
  redirectDelay = DEFAULT_CONFIG.REDIRECT_DELAY,
  globalDuplicateCheck = false,
  theme: customTheme,
  onSubmitSuccess,
  onSubmitFailure,
  beforeSubmitTransform,
}) => {
  // Get theme from context or use provided theme
  const defaultTheme = useTheme();
  const theme = { ...defaultTheme, ...customTheme };

  // Form state using React Hook Form
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting: formSubmitting },
    reset,
  } = useForm<AppointmentFormData>({
    resolver: yupResolver(validationSchema),
    defaultValues: {
      CommunityName: communityName,
      FirstName: '',
      LastName: '',
      Email: '',
      Phone: '',
      CareType: '',
      MarketSource: '',
      Message: '',
    },
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

  // Handle form submission (simplified for now)
  const onSubmit: SubmitHandler<AppointmentFormData> = async (data) => {
    try {
      setIsSubmitting(true);
      setSubmissionState('submitting');
      setErrorMessage('');

      // This is a placeholder. In a real implementation, we would:
      // 1. Transform data
      // 2. Submit to API
      // 3. Handle response
      
      console.log('[AppointmentForm] Submit initiated', data);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock successful submission
      setSubmissionState('success');
      console.log('[AppointmentForm] Submission success (mock)');
      
      if (onSubmitSuccess) {
        onSubmitSuccess({
          CreateReturn: 1,
          IndividualId: 123456,
          LeadId: 789012
        });
      }
      
      // Redirect after delay
      setTimeout(() => {
        window.location.href = redirectPath;
      }, redirectDelay);
      
    } catch (error) {
      logFormError('submit', error);
      setSubmissionState('error');
      setErrorMessage(ERROR_MESSAGES.SUBMISSION_FAILED);
      
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
          
          {/* Personal Information */}
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
          
          {/* Contact Information */}
          <div className="form-row">
            <div className="form-group">
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
            
            <div className="form-group">
              <label htmlFor="Phone" className="block mb-2 font-medium text-gray-700">
                Phone
              </label>
              <input
                id="Phone"
                type="tel"
                {...register('Phone')}
                placeholder="(123) 456-7890"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                  errors.Phone ? 'border-error focus:ring-error' : 'border-gray-300'
                }`}
                aria-invalid={errors.Phone ? 'true' : 'false'}
              />
              {errors.Phone && (
                <span className="error-text" role="alert">{errors.Phone.message}</span>
              )}
            </div>
          </div>
          
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
          <div className="form-group">
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
          <div className="form-group">
            <label htmlFor="Message" className="block mb-2 font-medium text-gray-700">
              Message
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
          
          {/* Submit Button */}
          <div className="form-group submit-container mt-6">
            <button 
              type="submit" 
              disabled={isSubmitting || formSubmitting}
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
    </div>
  );
};

export default AppointmentForm;
