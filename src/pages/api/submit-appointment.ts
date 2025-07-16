import { NextApiRequest, NextApiResponse } from 'next';
import { EnquireAppointmentRequest, EnquireApiResponse, EnquireCreateReturnCode } from '../../types/enquire';
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
 * @returns Transformed data for the Enquire API
 */
function transformFormData(data: any): EnquireAppointmentRequest {
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
  if (process.env.ENABLE_GLOBAL_DUPLICATE_CHECK === 'true') {
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
 * @returns The API response
 */
async function submitToEnquireApi(payload: EnquireAppointmentRequest): Promise<EnquireApiResponse> {
  // Get API key from server-side environment variable (not exposed to client)
  const apiKey = process.env.ENQUIRE_API_KEY;
  
  if (!apiKey) {
    logger.error('Missing Enquire API key in environment variables');
    throw new Error('API configuration error');
  }

  // Get API endpoint from environment or use default
  const apiEndpoint = process.env.ENQUIRE_API_ENDPOINT || 'https://api2.enquiresolutions.com/2/Individual/';
  
  logger.info(`Submitting appointment request to Enquire API for ${payload.FirstName} ${payload.LastName}`);
  
  try {
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
      // Add a reasonable timeout
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      // Log detailed error information
      const errorText = await response.text();
      logger.error(`Enquire API error: ${response.status} ${response.statusText}`, { errorText });
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    logger.info('Enquire API response received', { createReturn: data.CreateReturn });
    return data as EnquireApiResponse;
  } catch (error) {
    // Log the error with all available context
    logger.error('Error submitting to Enquire API', error);
    throw error;
  }
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
    // Log the incoming request (excluding sensitive data)
    const { FirstName, LastName } = req.body;
    logger.info(`Received appointment request for ${FirstName} ${LastName}`);

    // Validate the request body
    const validation = validateAppointmentData(req.body);
    if (!validation.isValid) {
      logger.warn('Validation failed for appointment request', validation.errors);
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed', 
        errors: validation.errors 
      });
    }

    // Transform the data for the Enquire API
    const payload = transformFormData(req.body);
    
    // Submit to Enquire API (in production)
    let response: EnquireApiResponse;
    
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_API_IN_DEVELOPMENT === 'true') {
      // Real API call
      response = await submitToEnquireApi(payload);
    } else {
      // Mock successful response for development
      logger.info('Using mock API response in development mode');
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
      data: response,
    });
  } catch (error) {
    // Log the error
    logger.error('Error processing appointment request', error);
    
    // Return an appropriate error response
    return res.status(500).json({
      success: false,
      message: 'An error occurred while processing your request',
    });
  }
}
