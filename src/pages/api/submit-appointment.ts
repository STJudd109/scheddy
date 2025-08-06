import { NextApiRequest, NextApiResponse } from 'next';
import type {
  EnquireAppointmentRequest,
  EnquireApiResponse,
} from '../../types/enquire';
import { EnquireCreateReturnCode } from '../../types/enquire';
import { createLogger } from '../../lib/logger';

// Create a logger instance for this API route
const logger = createLogger('api:submit-appointment');

/**
 * --------------------------------------------------------------------
 * Cloudflare Turnstile ‑ optional anti-spam verification
 * --------------------------------------------------------------------
 *
 * If the environment variable `TURNSTILE_SECRET_KEY` is present the API
 * will validate the `turnstileToken` provided by the client.  When the
 * secret is **not** configured the check is skipped so local/dev usage
 * is friction-free.
 *
 * Required environment variables:
 *   • TURNSTILE_SECRET_KEY   – secret provided by Cloudflare dashboard
 *
 * The client must send the token in the body:
 *   { ..., "turnstileToken": "<token-from-widget>" }
 */
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY ?? '';

async function verifyTurnstileToken(token: string | undefined, ip?: string) {
  // Skip if secret key not configured
  if (!TURNSTILE_SECRET_KEY) {
    logger.debug('Turnstile skipped – no secret key configured');
    return true;
  }

  if (!token) {
    logger.warn('Turnstile token missing in request');
    return false;
  }

  try {
    const params = new URLSearchParams();
    params.append('secret', TURNSTILE_SECRET_KEY);
    params.append('response', token);
    if (ip) params.append('remoteip', ip);

    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: params,
    });
    const data = (await resp.json()) as { success: boolean; 'error-codes'?: string[] };

    if (!data.success) {
      logger.warn('Turnstile verification failed', data['error-codes']);
    }
    return data.success;
  } catch (err) {
    logger.error('Error calling Turnstile verify endpoint', err);
    // Fail-closed (treat as failed verification)
    return false;
  }
}

// Validation patterns (duplicated from constants to keep API route self-contained)
const VALIDATION_PATTERNS = {
  NAME: /^[a-zA-Z\s\-'.]+$/,
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  PHONE: /^(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/,
  // Additional phone field patterns (using same regex as PHONE)
  HOME_PHONE: /^(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/,
  WORK_PHONE: /^(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/,
  MOBILE_PHONE: /^(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/,
  // Address-related patterns
  ADDRESS_LINE: /^[a-zA-Z0-9\s,'-.#]{3,}$/,
  CITY: /^[a-zA-Z\s'-]{2,}$/,
  STATE: /^[A-Z]{2}$/,
  ZIP_CODE: /^\d{5}(-\d{4})?$/,
  // Submission type validation
  SUBMISSION_TYPE: /^(self|family_member)$/,
};

/**
 * Get a list of allowed communities from environment variables
 * This serves as a security measure to prevent unauthorized communities
 * 
 * @returns Array of allowed community names or null if no whitelist is configured
 */
function getAllowedCommunities(): string[] | null {
  // Check if we have a whitelist of communities
  const communitiesStr = process.env.ALLOWED_COMMUNITIES;
  if (communitiesStr) {
    return communitiesStr.split(',').map(c => c.trim());
  }
  
  // Check for numbered community environment variables (COMMUNITY_1_NAME, COMMUNITY_2_NAME, etc.)
  const communities: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const communityName = process.env[`COMMUNITY_${i}_NAME`];
    if (communityName) {
      communities.push(communityName);
    } else if (i > 3) {
      // Stop checking after first gap (optimization for when only a few are defined)
      break;
    }
  }
  
  return communities.length > 0 ? communities : null;
}

/**
 * Get API configuration for a specific community
 * 
 * @param communityName The name of the community
 * @returns API configuration for the community
 */
function getCommunityApiConfig(communityName: string): {
  apiKey: string | null;
  endpoint: string;
  globalDuplicateCheck: boolean;
} {
  // Normalize community name for environment variable lookup
  // Replace spaces with underscores and convert to uppercase
  const normalizedName = communityName.replace(/\s+/g, '_').toUpperCase();
  
  // Try to get community-specific API key
  let apiKey = process.env[`ENQUIRE_API_KEY_${normalizedName}`] || null;
  
  // Fall back to default API key if community-specific one is not found
  if (!apiKey) {
    apiKey = process.env.ENQUIRE_API_KEY || null;
  }
  
  // Try to get community-specific API endpoint
  let endpoint = process.env[`ENQUIRE_API_ENDPOINT_${normalizedName}`] || null;
  
  // Fall back to default API endpoint if community-specific one is not found
  if (!endpoint) {
    endpoint = process.env.ENQUIRE_API_ENDPOINT || 'https://api2.enquiresolutions.com/2/Individual/';
  }
  
  // Check for community-specific duplicate check setting
  const globalDuplicateCheck = 
    process.env[`ENABLE_GLOBAL_DUPLICATE_CHECK_${normalizedName}`] === 'true' || 
    process.env.ENABLE_GLOBAL_DUPLICATE_CHECK === 'true';
  
  return {
    apiKey,
    endpoint,
    globalDuplicateCheck
  };
}

/**
 * Validates the appointment request data
 * 
 * @param data The data to validate
 * @returns An object containing validation result and any error messages
 */
function validateAppointmentData(data: any): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  // Required fields
  if (!data.CommunityName) {
    errors.CommunityName = 'Community name is required';
  } else {
    // Check if community is in the allowed list (if a whitelist exists)
    const allowedCommunities = getAllowedCommunities();
    if (allowedCommunities && !allowedCommunities.includes(data.CommunityName)) {
      errors.CommunityName = 'Invalid community name';
      logger.warn(`Attempt to submit to unauthorized community: ${data.CommunityName}`);
    }
  }

  // Validate SubmissionType
  if (!data.SubmissionType) {
    errors.SubmissionType = 'Submission type is required';
  } else if (!VALIDATION_PATTERNS.SUBMISSION_TYPE.test(data.SubmissionType)) {
    errors.SubmissionType = 'Invalid submission type';
  }

  // Resident/Prospect information (always required)
  if (!data.FirstName) {
    errors.FirstName = 'First name is required';
  } else if (!VALIDATION_PATTERNS.NAME.test(data.FirstName)) {
    errors.FirstName = 'First name contains invalid characters';
  }

  if (!data.LastName) {
    errors.LastName = 'Last name is required';
  } else if (!VALIDATION_PATTERNS.NAME.test(data.LastName)) {
    errors.LastName = 'Last name contains invalid characters';
  }

  // Optional fields with format validation
  if (data.Email && !VALIDATION_PATTERNS.EMAIL.test(data.Email)) {
    errors.Email = 'Email format is invalid';
  }

  // Phone field validations
  if (data.Phone && !VALIDATION_PATTERNS.PHONE.test(data.Phone)) {
    errors.Phone = 'Phone number format is invalid';
  }

  if (data.HomePhone && !VALIDATION_PATTERNS.HOME_PHONE.test(data.HomePhone)) {
    errors.HomePhone = 'Home phone number format is invalid';
  }

  if (data.WorkPhone && !VALIDATION_PATTERNS.WORK_PHONE.test(data.WorkPhone)) {
    errors.WorkPhone = 'Work phone number format is invalid';
  }

  if (data.MobilePhone && !VALIDATION_PATTERNS.MOBILE_PHONE.test(data.MobilePhone)) {
    errors.MobilePhone = 'Mobile phone number format is invalid';
  }

  // Address field validations
  if (data.AddressLine1 && !VALIDATION_PATTERNS.ADDRESS_LINE.test(data.AddressLine1)) {
    errors.AddressLine1 = 'Address line 1 format is invalid';
  }

  // No validation for AddressLine2 as it's completely optional

  if (data.City && !VALIDATION_PATTERNS.CITY.test(data.City)) {
    errors.City = 'City format is invalid';
  }

  if (data.State && !VALIDATION_PATTERNS.STATE.test(data.State)) {
    errors.State = 'State should be a 2-letter code';
  }

  if (data.ZipCode && !VALIDATION_PATTERNS.ZIP_CODE.test(data.ZipCode)) {
    errors.ZipCode = 'ZIP code format is invalid';
  }

  // Contact fields validation (required when SubmissionType is 'family_member')
  if (data.SubmissionType === 'family_member') {
    // Required contact fields for family_member submissions
    if (!data.ContactFirstName) {
      errors.ContactFirstName = 'Contact first name is required';
    } else if (!VALIDATION_PATTERNS.NAME.test(data.ContactFirstName)) {
      errors.ContactFirstName = 'Contact first name contains invalid characters';
    }

    if (!data.ContactLastName) {
      errors.ContactLastName = 'Contact last name is required';
    } else if (!VALIDATION_PATTERNS.NAME.test(data.ContactLastName)) {
      errors.ContactLastName = 'Contact last name contains invalid characters';
    }

    if (!data.ContactEmail) {
      errors.ContactEmail = 'Contact email is required';
    } else if (!VALIDATION_PATTERNS.EMAIL.test(data.ContactEmail)) {
      errors.ContactEmail = 'Contact email format is invalid';
    }

    // Optional contact fields with format validation
    if (data.ContactHomePhone && !VALIDATION_PATTERNS.HOME_PHONE.test(data.ContactHomePhone)) {
      errors.ContactHomePhone = 'Contact home phone number format is invalid';
    }

    if (data.ContactWorkPhone && !VALIDATION_PATTERNS.WORK_PHONE.test(data.ContactWorkPhone)) {
      errors.ContactWorkPhone = 'Contact work phone number format is invalid';
    }

    if (data.ContactMobilePhone && !VALIDATION_PATTERNS.MOBILE_PHONE.test(data.ContactMobilePhone)) {
      errors.ContactMobilePhone = 'Contact mobile phone number format is invalid';
    }

    if (data.ContactAddressLine1 && !VALIDATION_PATTERNS.ADDRESS_LINE.test(data.ContactAddressLine1)) {
      errors.ContactAddressLine1 = 'Contact address line 1 format is invalid';
    }

    if (data.ContactCity && !VALIDATION_PATTERNS.CITY.test(data.ContactCity)) {
      errors.ContactCity = 'Contact city format is invalid';
    }

    if (data.ContactState && !VALIDATION_PATTERNS.STATE.test(data.ContactState)) {
      errors.ContactState = 'Contact state should be a 2-letter code';
    }

    if (data.ContactZipCode && !VALIDATION_PATTERNS.ZIP_CODE.test(data.ContactZipCode)) {
      errors.ContactZipCode = 'Contact ZIP code format is invalid';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Transforms the form data into the format expected by the Enquire API
 * 
 * @param data The form data
 * @param communityConfig Configuration for the community
 * @returns Transformed data for the Enquire API
 */
function transformFormData(
  data: any, 
  communityConfig: { globalDuplicateCheck: boolean }
): EnquireAppointmentRequest {
  // Basic field mapping
  const payload: EnquireAppointmentRequest = {
    CommunityName: data.CommunityName,
    FirstName: capitalizeFirstLetter(data.FirstName),
    LastName: capitalizeFirstLetter(data.LastName),
    Email: data.Email?.toLowerCase().trim(),
    Message: data.Message?.trim(),
    CareType: data.CareType,
    MarketSource: data.MarketSource,
    // Add submission metadata
    SubmissionDate: new Date().toISOString(),
    SubmittedFrom: data.SubmittedFrom || 'API',
    // Add submission type
    SubmissionType: data.SubmissionType || 'self',
  };

  // Handle phone fields with backward compatibility
  if (data.HomePhone) {
    payload.HomePhone = data.HomePhone;
  }
  
  if (data.WorkPhone) {
    payload.WorkPhone = data.WorkPhone;
  }
  
  if (data.MobilePhone) {
    payload.MobilePhone = data.MobilePhone;
  }
  
  // If no specific phone fields are provided but legacy Phone is,
  // map it to HomePhone for backward compatibility
  if (!data.HomePhone && !data.WorkPhone && !data.MobilePhone && data.Phone) {
    payload.HomePhone = data.Phone;
    // Also keep the legacy field for maximum compatibility
    payload.Phone = data.Phone;
  } else if (data.Phone) {
    // If we have specific phone fields but also a legacy Phone field,
    // include it for backward compatibility
    payload.Phone = data.Phone;
  }

  // Add address fields if provided
  if (data.AddressLine1) {
    payload.AddressLine1 = data.AddressLine1;
  }
  
  if (data.AddressLine2) {
    payload.AddressLine2 = data.AddressLine2;
  }
  
  if (data.City) {
    payload.City = data.City;
  }
  
  if (data.State) {
    payload.State = data.State;
  }
  
  if (data.ZipCode) {
    payload.ZipCode = data.ZipCode;
  }

  // Add contact fields if this is a family_member submission
  if (data.SubmissionType === 'family_member') {
    if (data.ContactFirstName) {
      payload.ContactFirstName = capitalizeFirstLetter(data.ContactFirstName);
    }
    
    if (data.ContactLastName) {
      payload.ContactLastName = capitalizeFirstLetter(data.ContactLastName);
    }
    
    if (data.ContactEmail) {
      payload.ContactEmail = data.ContactEmail.toLowerCase().trim();
    }
    
    if (data.ContactHomePhone) {
      payload.ContactHomePhone = data.ContactHomePhone;
    }
    
    if (data.ContactWorkPhone) {
      payload.ContactWorkPhone = data.ContactWorkPhone;
    }
    
    if (data.ContactMobilePhone) {
      payload.ContactMobilePhone = data.ContactMobilePhone;
    }
    
    if (data.ContactAddressLine1) {
      payload.ContactAddressLine1 = data.ContactAddressLine1;
    }
    
    if (data.ContactAddressLine2) {
      payload.ContactAddressLine2 = data.ContactAddressLine2;
    }
    
    if (data.ContactCity) {
      payload.ContactCity = data.ContactCity;
    }
    
    if (data.ContactState) {
      payload.ContactState = data.ContactState;
    }
    
    if (data.ContactZipCode) {
      payload.ContactZipCode = data.ContactZipCode;
    }
  }

  // Set ReferralType to 0 for global duplicate check if specified
  // Use community-specific setting if available
  if (communityConfig.globalDuplicateCheck) {
    payload.ReferralType = 0;
  }

  return payload;
}

/**
 * Helper function to capitalize the first letter of each word
 */
function capitalizeFirstLetter(str?: string): string {
  if (!str) return '';
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Makes the actual API request to Enquire Solutions
 * 
 * @param payload The data to send to the Enquire API
 * @param apiConfig API configuration including key and endpoint
 * @returns The API response
 */
async function submitToEnquireApi(
  payload: EnquireAppointmentRequest, 
  apiConfig: { apiKey: string | null; endpoint: string }
): Promise<EnquireApiResponse> {
  const { apiKey, endpoint } = apiConfig;
  
  if (!apiKey) {
    logger.error(`Missing Enquire API key for community: ${payload.CommunityName}`);
    throw new Error('API configuration error: No API key provided');
  }

  logger.info(`Submitting appointment request to Enquire API for ${payload.FirstName} ${payload.LastName} (Community: ${payload.CommunityName})`);
  logger.debug(`API endpoint: ${endpoint}`, { 
    communityName: payload.CommunityName,
    hasApiKey: !!apiKey,
    payloadFields: Object.keys(payload)
  });
  
  // Maximum number of retries
  const MAX_RETRIES = 1;
  let retryCount = 0;
  let lastError: Error | null = null;

  while (retryCount <= MAX_RETRIES) {
    try {
      // If this is a retry, log it
      if (retryCount > 0) {
        logger.info(`Retry attempt ${retryCount} for ${payload.CommunityName}`);
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Use the Azure API Management header format instead of Bearer token
          'Ocp-Apim-Subscription-Key': apiKey,
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
        // Add a reasonable timeout
        signal: AbortSignal.timeout(10000),
      });

      // Get response text for logging regardless of status
      const responseText = await response.text();
      
      if (!response.ok) {
        // Parse response text if it's JSON
        let parsedError;
        try {
          parsedError = JSON.parse(responseText);
        } catch (e) {
          // Not JSON, use text as is
          parsedError = responseText;
        }

        logger.error(`Enquire API error for ${payload.CommunityName}: ${response.status} ${response.statusText}`, { 
          errorDetails: parsedError,
          endpoint,
          statusCode: response.status,
          headers: Object.fromEntries(response.headers.entries())
        });

        // Check if this is an authentication error
        if (response.status === 401 || response.status === 403 || 
            (response.status === 400 && responseText.includes("subscription key"))) {
          throw new Error(`API key rejected: The API key for ${payload.CommunityName} was not accepted. Please check your ENQUIRE_API_KEY environment variable.`);
        }

        // Only retry on server errors (5xx) or network issues
        if (response.status >= 500 && retryCount < MAX_RETRIES) {
          lastError = new Error(`API request failed with status ${response.status}`);
          retryCount++;
          // Wait before retrying (simple exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          continue;
        }

        throw new Error(`API request failed with status ${response.status}: ${parsedError?.Message || responseText}`);
      }

      // Try to parse the response as JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        logger.error(`Failed to parse Enquire API response as JSON for ${payload.CommunityName}`, { responseText });
        throw new Error('Invalid response format from API');
      }

      logger.info(`Enquire API response received for ${payload.CommunityName}`, { 
        createReturn: data.CreateReturn,
        responseData: data
      });
      
      return data as EnquireApiResponse;
    } catch (error: unknown) {
      // Normalise error to an Error instance for consistent handling
      lastError = error instanceof Error ? error : new Error(String(error));

      // Determine if this is a network-type error we should retry
      const isAbortError =
        typeof (error as any)?.name === 'string' &&
        (error as any).name === 'AbortError';

      if (
        (error instanceof TypeError || isAbortError) &&
        retryCount < MAX_RETRIES
      ) {
        logger.warn(
          `Network error for ${payload.CommunityName}, will retry`,
          { error: lastError.message }
        );
        retryCount += 1;
        // Simple exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * retryCount)
        );
        continue;
      }
      
      // Log the error with all available context
      logger.error(`Error submitting to Enquire API for ${payload.CommunityName}`, {
        error: lastError.message,
        stack: lastError.stack,
        retryAttempts: retryCount
      });
      
      throw lastError;
    }
  }

  // This should never happen, but TypeScript requires a return value
  throw lastError || new Error('Unknown error occurred');
}

/**
 * Gets a human-readable status message based on the API response code
 * 
 * @param createReturn The CreateReturn code from the API response
 * @returns Status information including success flag and message
 */
function getSubmissionStatus(createReturn: number) {
  switch (createReturn) {
    case EnquireCreateReturnCode.SUCCESS:
      return { success: true, duplicate: false, message: 'Appointment request submitted successfully' };
    case EnquireCreateReturnCode.DUPLICATE:
      return { success: true, duplicate: true, message: 'Your information is already in our system' };
    case EnquireCreateReturnCode.SKIPPED:
      return { success: false, duplicate: false, message: 'Submission was skipped by the system' };
    default:
      return { success: false, duplicate: false, message: 'Unknown submission status' };
  }
}

/**
 * API route handler for appointment form submissions
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    logger.warn(`Invalid method: ${req.method}`);
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    // Extract community name and submission type for logging
    const { CommunityName, FirstName, LastName, SubmissionType, turnstileToken } = req.body;
    
    // Log the incoming request with community information
    logger.info(`Received appointment request for ${FirstName} ${LastName} (Community: ${CommunityName || 'Not specified'}, Type: ${SubmissionType || 'self'})`);

    /* ---------------------------------------------------------------
     * Turnstile verification (if enabled)
     * ------------------------------------------------------------- */
    const remoteIp = req.headers['x-forwarded-for']?.toString().split(',')[0];
    const turnstileOk = await verifyTurnstileToken(turnstileToken, remoteIp);
    if (!turnstileOk) {
      return res.status(400).json({
        success: false,
        message: 'Security check failed. Please refresh the page and try again.',
      });
    }

    // Validate the request body
    const validation = validateAppointmentData(req.body);
    if (!validation.isValid) {
      logger.warn(`Validation failed for appointment request to ${CommunityName || 'unknown community'}`, validation.errors);
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed', 
        errors: validation.errors 
      });
    }

    // Get community-specific API configuration
    const communityConfig = getCommunityApiConfig(CommunityName);
    
    // Transform the data for the Enquire API
    const payload = transformFormData(req.body, communityConfig);
    
    // Submit to Enquire API (in production)
    let response: EnquireApiResponse;
    
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_API_IN_DEVELOPMENT === 'true') {
      // Real API call
      response = await submitToEnquireApi(payload, communityConfig);
    } else {
      // Mock successful response for development
      logger.info(`Using mock API response in development mode for ${CommunityName}`);
      response = {
        CreateReturn: EnquireCreateReturnCode.SUCCESS,
        IndividualId: 123456,
        LeadId: 789012,
      };
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Get status information
    const status = getSubmissionStatus(response.CreateReturn);
    
    // Return the response to the client
    return res.status(200).json({
      success: status.success,
      message: status.message,
      isDuplicate: status.duplicate,
      community: CommunityName, // Include community name in response for client reference
      submissionType: SubmissionType, // Include submission type in response
      data: response,
    });
  } catch (error) {
    // Log the error
    logger.error('Error processing appointment request', error);
    
    // Return an appropriate error response
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'An error occurred while processing your request',
    });
  }
}
