import { NextApiRequest, NextApiResponse } from 'next';
import type {
  EnquireAppointmentRequest,
  EnquireApiResponse,
} from '../../types/enquire';
import { EnquireCreateReturnCode } from '../../types/enquire';
import { createLogger } from '../../lib/logger';

// Create a logger instance for this API route
const logger = createLogger('api:submit-appointment');

// Validation patterns (duplicated from constants to keep API route self-contained)
const VALIDATION_PATTERNS = {
  NAME: /^[a-zA-Z\s\-'.]+$/,
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  PHONE: /^(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/,
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

  if (data.Phone && !VALIDATION_PATTERNS.PHONE.test(data.Phone)) {
    errors.Phone = 'Phone number format is invalid';
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
    Phone: data.Phone,
    CareType: data.CareType,
    MarketSource: data.MarketSource,
    Message: data.Message?.trim(),
    // Add submission metadata
    SubmissionDate: new Date().toISOString(),
    SubmittedFrom: data.SubmittedFrom || 'API',
  };

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
    } catch (error) {
      // Store the error for potential retry
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // If this is a network error or timeout and we haven't exceeded retries
      if ((error instanceof TypeError || error.name === 'AbortError') && retryCount < MAX_RETRIES) {
        logger.warn(`Network error for ${payload.CommunityName}, will retry`, { error: lastError.message });
        retryCount++;
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
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
    // Extract community name for logging
    const { CommunityName, FirstName, LastName } = req.body;
    
    // Log the incoming request with community information
    logger.info(`Received appointment request for ${FirstName} ${LastName} (Community: ${CommunityName || 'Not specified'})`);

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
