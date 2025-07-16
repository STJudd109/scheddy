/**
 * Constants for the Appointment Form application
 * 
 * This file contains common values used throughout the application,
 * including dropdown options, validation patterns, and default configuration.
 */

/**
 * Care Type options for the dropdown
 */
export const CARE_TYPE_OPTIONS = [
  { value: 'Independent Living', label: 'Independent Living' },
  { value: 'Assisted Living', label: 'Assisted Living' },
  { value: 'Memory Care', label: 'Memory Care' },
  { value: 'Skilled Nursing', label: 'Skilled Nursing' },
  { value: 'Respite Care', label: 'Respite Care' },
  { value: 'Rehabilitation', label: 'Rehabilitation' },
  { value: 'Hospice', label: 'Hospice' },
  { value: 'Not Sure', label: 'Not Sure' },
];

/**
 * Market Source options for the dropdown
 */
export const MARKET_SOURCE_OPTIONS = [
  { value: 'Internet Search', label: 'Internet Search' },
  { value: 'Social Media', label: 'Social Media' },
  { value: 'Friend/Family', label: 'Friend or Family Referral' },
  { value: 'Healthcare Provider', label: 'Healthcare Provider' },
  { value: 'Print Advertisement', label: 'Print Advertisement' },
  { value: 'Radio/TV', label: 'Radio or TV' },
  { value: 'Community Event', label: 'Community Event' },
  { value: 'Current Resident', label: 'Current Resident' },
  { value: 'Other', label: 'Other' },
];

/**
 * API related constants
 */
export const API_CONSTANTS = {
  DEFAULT_ENDPOINT: 'https://api2.enquiresolutions.com/2/Individual/',
  TIMEOUT: 15000, // 15 seconds
  RETRY_ATTEMPTS: 2,
  HEADER_API_KEY: 'Ocp-Apim-Subscription-Key',
};

/**
 * Form validation patterns
 */
export const VALIDATION_PATTERNS = {
  EMAIL: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
  PHONE: /^(\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/,
  NAME: /^[a-zA-Z\s'-]+$/,
  ZIP_CODE: /^\d{5}(-\d{4})?$/,
};

/**
 * Form validation error messages
 */
export const ERROR_MESSAGES = {
  REQUIRED: 'This field is required',
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_PHONE: 'Please enter a valid phone number',
  INVALID_NAME: 'Please enter a valid name',
  SUBMISSION_FAILED: 'There was an error submitting your request. Please try again.',
  DUPLICATE: 'It looks like you have already submitted a request. We will contact you soon.',
};

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
  REDIRECT_DELAY: 3000, // 3 seconds
  REDIRECT_PATH: '/',
  FORM_SPACING: '1rem',
};

/**
 * Default theme values
 */
export const DEFAULT_THEME = {
  PRIMARY_COLOR: '#0066cc',
  SECONDARY_COLOR: '#f8f9fa',
  SUCCESS_COLOR: '#28a745',
  ERROR_COLOR: '#dc3545',
  WARNING_COLOR: '#ffc107',
  INFO_COLOR: '#17a2b8',
  FONT_FAMILY: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  BORDER_RADIUS: '0.25rem',
  BOX_SHADOW: '0 4px 6px rgba(0, 0, 0, 0.1)',
  BUTTON_TEXT: 'Request Appointment',
};

/**
 * Enquire API response codes
 */
export const ENQUIRE_RESPONSE_CODES = {
  SUCCESS: 1,
  DUPLICATE: 2,
  SKIPPED: 4,
};

/**
 * Local storage keys
 */
export const STORAGE_KEYS = {
  SUBMISSION_HISTORY: 'appointment_form_submission_history',
  FORM_DATA: 'appointment_form_saved_data',
};
