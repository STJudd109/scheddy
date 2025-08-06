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
 * Submission Type options for the dropdown
 *
 * Determines whether the request is for the resident/prospect themselves
 * or on behalf of a family member / advocate.  The AppointmentForm uses
 * this list to conditionally show contact-person fields when
 * `family_member` is selected.
 */
export const SUBMISSION_TYPE_OPTIONS = [
  { value: 'self',          label: 'I am requesting for myself' },
  { value: 'family_member', label: 'I am requesting for a family member' },
];

/**
 * United States states and territories
 *
 * Two–letter postal abbreviations mapped to human-readable names, formatted
 * like other dropdown option constants so it can be used directly in a
 * <select> component:
 *
 *   <select>
 *     {US_STATES.map(opt => (
 *       <option value={opt.value}>{opt.label}</option>
 *     ))}
 *   </select>
 */
export const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
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
  /* Individual phone field aliases (reuse the generic PHONE regex) */
  HOME_PHONE: /^(\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/,
  WORK_PHONE: /^(\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/,
  MOBILE_PHONE: /^(\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/,
  /* Address-related patterns */
  // More-permissive street address validation:
  //  • Letters, numbers, spaces
  //  • Common symbols: # (apt), - (ranges), . (abbr), () (unit), / (fractions), , (separators)
  //  • Minimum length: 2 characters
  // Note: inside a character class the dash (`-`) must be first or last (or escaped)
  // and `\s` is **not** recognised, so we list a literal space instead.
  // Allowed chars: letters, numbers, space, # . ' ( ) , / -
  ADDRESS_LINE: /^[A-Za-z0-9 #'.(),\/-]{2,}$/,
  CITY: /^[a-zA-Z\\s'-]{2,}$/,                      // Letters, spaces, apostrophes, hyphens
  STATE: /^[A-Z]{2}$/,                              // 2-letter state code
};

/**
 * Form validation error messages
 */
export const ERROR_MESSAGES = {
  REQUIRED: 'This field is required',
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_PHONE: 'Please enter a valid phone number',
  INVALID_NAME: 'Please enter a valid name',
  INVALID_ADDRESS: 'Please enter a valid address',
  INVALID_CITY: 'Please enter a valid city',
  INVALID_STATE: 'Please enter a valid 2-letter state code',
  INVALID_ZIP: 'Please enter a valid ZIP code',
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
