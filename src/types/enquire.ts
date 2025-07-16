/**
 * Type definitions for Enquire Solutions API
 * 
 * These types define the structure of request payloads and response objects
 * when interacting with the Enquire Solutions API for senior living appointment requests.
 */

/**
 * Request payload for creating an appointment/lead in Enquire Solutions
 */
export interface EnquireAppointmentRequest {
  /** Community name as registered in Enquire (required) */
  CommunityName: string;
  
  /** Prospect's first name (required) */
  FirstName: string;
  
  /** Prospect's last name (required) */
  LastName: string;
  
  /** Prospect's email address */
  Email?: string;
  
  /** Prospect's phone number */
  Phone?: string;
  
  /** Type of care the prospect is interested in (e.g., "Independent Living", "Memory Care") */
  CareType?: string;
  
  /** How the prospect heard about the community */
  MarketSource?: string;
  
  /** Additional notes or message from the prospect */
  Message?: string;
  
  /** 
   * Optional referral type flag
   * When set to 0, enables global duplicate check
   */
  ReferralType?: number;
  
  /** Timestamp when the form was submitted */
  SubmissionDate?: string;
  
  /** URL where the form was submitted from */
  SubmittedFrom?: string;
  
  /** Any additional fields that might be supported by the API */
  [key: string]: any;
}

/**
 * Response from the Enquire API after attempting to create a lead
 */
export interface EnquireApiResponse {
  /** 
   * Status code indicating the result of the operation:
   * 1 = Success (lead created)
   * 2 = Duplicate (lead already exists)
   * 4 = Skipped (creation skipped for some reason)
   */
  CreateReturn: number;
  
  /** Error message if something went wrong */
  ErrorMessage?: string;
  
  /** ID of the individual record created (on success) */
  IndividualId?: number;
  
  /** ID of the lead record created (on success) */
  LeadId?: number;
  
  /** Flag indicating if the lead was identified as a duplicate */
  isDuplicate?: boolean;
  
  /** Any additional fields that might be returned by the API */
  [key: string]: any;
}

/**
 * Possible values for the CreateReturn field in the API response
 */
export enum EnquireCreateReturnCode {
  /** Lead successfully created */
  SUCCESS = 1,
  
  /** Lead already exists (duplicate) */
  DUPLICATE = 2,
  
  /** Lead creation skipped */
  SKIPPED = 4
}

/**
 * Form data structure for the appointment request form
 */
export interface AppointmentFormData {
  /** Community name (usually pre-filled and hidden) */
  CommunityName?: string;
  
  /** Prospect's first name */
  FirstName: string;
  
  /** Prospect's last name */
  LastName: string;
  
  /** Prospect's email address */
  Email?: string;
  
  /** Prospect's phone number */
  Phone?: string;
  
  /** Type of care the prospect is interested in */
  CareType?: string;
  
  /** How the prospect heard about the community */
  MarketSource?: string;
  
  /** Additional notes or message from the prospect */
  Message?: string;
  
  /** Any additional form fields */
  [key: string]: any;
}

/**
 * Configuration options for the Enquire API client
 */
export interface EnquireApiConfig {
  /** API key for authentication with Enquire */
  apiKey: string;
  
  /** API endpoint URL (defaults to https://api2.enquiresolutions.com/2/Individual/) */
  endpoint?: string;
  
  /** Request timeout in milliseconds */
  timeout?: number;
  
  /** Whether to enable global duplicate checking */
  globalDuplicateCheck?: boolean;
}

/**
 * Error class for Enquire API errors
 */
export class EnquireApiError extends Error {
  /** HTTP status code if available */
  status?: number;
  
  /** Response data if available */
  data?: any;
  
  constructor(message: string, status?: number, data?: any) {
    super(message);
    this.name = 'EnquireApiError';
    this.status = status;
    this.data = data;
  }
}
