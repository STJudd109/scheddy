/**
 * Logger utility for the Appointment Form application
 * 
 * Provides standardized logging functions with different log levels,
 * context prefixing, and structured format. Designed to be easily
 * extended to support remote logging services in the future.
 */

// Log levels in order of severity
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4, // Used to disable logging
}

// Configuration for the logger
export interface LoggerConfig {
  // Minimum level to log (defaults to INFO in production, DEBUG in development)
  minLevel?: LogLevel;
  
  // Whether to include timestamps in logs
  includeTimestamps?: boolean;
  
  // Whether to include the context in logs
  includeContext?: boolean;
  
  // Remote logging service configuration (placeholder for future implementation)
  remoteLogging?: {
    endpoint?: string;
    apiKey?: string;
    batchSize?: number;
    // Add other remote logging options as needed
  };
}

// Default configuration based on environment
const defaultConfig: LoggerConfig = {
  minLevel: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  includeTimestamps: true,
  includeContext: true,
};

/**
 * Logger class that provides methods for different log levels
 * with context prefixing and structured format.
 */
export class Logger {
  private context: string;
  private config: LoggerConfig;
  
  /**
   * Create a new logger instance
   * 
   * @param context The context for this logger (e.g., component or module name)
   * @param config Configuration options
   */
  constructor(context: string, config: LoggerConfig = defaultConfig) {
    this.context = context;
    this.config = { ...defaultConfig, ...config };
  }
  
  /**
   * Format a log message with context and timestamp
   * 
   * @param level The log level
   * @param message The message to log
   * @returns Formatted message
   */
  private formatMessage(level: string, message: string): string {
    const parts: string[] = [];
    
    // Add timestamp if configured
    if (this.config.includeTimestamps) {
      parts.push(`[${new Date().toISOString()}]`);
    }
    
    // Add log level
    parts.push(`[${level}]`);
    
    // Add context if configured
    if (this.config.includeContext && this.context) {
      parts.push(`[${this.context}]`);
    }
    
    // Add message
    parts.push(message);
    
    return parts.join(' ');
  }
  
  /**
   * Send a log to the console and/or remote logging service
   * 
   * @param level The log level
   * @param levelName The name of the log level
   * @param args The arguments to log
   */
  private log(level: LogLevel, levelName: string, ...args: any[]): void {
    // Skip if below minimum level
    if (level < this.config.minLevel!) {
      return;
    }
    
    // Extract message and data
    const message = typeof args[0] === 'string' ? args[0] : '';
    const data = args.slice(typeof args[0] === 'string' ? 1 : 0);
    
    // Format the message
    const formattedMessage = this.formatMessage(levelName, message);
    
    // Log to console based on level
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage, ...data);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage, ...data);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, ...data);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage, ...data);
        break;
    }
    
    // Send to remote logging service if configured
    this.sendToRemoteLogging(level, levelName, message, data);
  }
  
  /**
   * Send a log to a remote logging service
   * This is a placeholder for future implementation
   * 
   * @param level The log level
   * @param levelName The name of the log level
   * @param message The message to log
   * @param data Additional data to log
   */
  private sendToRemoteLogging(level: LogLevel, levelName: string, message: string, data: any[]): void {
    // Skip if remote logging is not configured
    if (!this.config.remoteLogging?.endpoint) {
      return;
    }
    
    // TODO: Implement remote logging
    // This could send logs to services like Sentry, Datadog, or a custom endpoint
    // For now, this is just a placeholder
  }
  
  /**
   * Log a debug message
   * 
   * @param message The message to log
   * @param data Additional data to log
   */
  debug(message: string, ...data: any[]): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, ...data);
  }
  
  /**
   * Log an info message
   * 
   * @param message The message to log
   * @param data Additional data to log
   */
  info(message: string, ...data: any[]): void {
    this.log(LogLevel.INFO, 'INFO', message, ...data);
  }
  
  /**
   * Log a warning message
   * 
   * @param message The message to log
   * @param data Additional data to log
   */
  warn(message: string, ...data: any[]): void {
    this.log(LogLevel.WARN, 'WARN', message, ...data);
  }
  
  /**
   * Log an error message
   * 
   * @param message The message to log
   * @param error The error object
   * @param data Additional data to log
   */
  error(message: string, error?: unknown, ...data: any[]): void {
    this.log(LogLevel.ERROR, 'ERROR', message, error, ...data);
  }
  
  /**
   * Create a child logger with a sub-context
   * 
   * @param subContext The sub-context to add
   * @returns A new logger with the combined context
   */
  child(subContext: string): Logger {
    return new Logger(`${this.context}:${subContext}`, this.config);
  }
}

/**
 * Create a new logger instance
 * 
 * @param context The context for the logger
 * @param config Configuration options
 * @returns A new logger instance
 */
export function createLogger(context: string, config?: LoggerConfig): Logger {
  return new Logger(context, config);
}

// Default logger instance for the application
const appLogger = new Logger('AppointmentForm');

export default appLogger;
