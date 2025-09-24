/**
 * Email validation result interface matching ZeroBounce-like functionality
 */
export interface EmailValidationResult {
  email: string;
  status: 'valid' | 'invalid' | 'unknown';
  sub_status: string | null;
  free_email: boolean;
  did_you_mean: string | null;
  account: string;
  domain: string;
  domain_age_days: number | null;
  smtp_provider: string | null;
  mx_found: boolean;
  mx_record: string | null;
  firstname: string | null;
  lastname: string | null;
}

/**
 * Email validation request interface
 */
export interface EmailValidationRequest {
  email: string;
}

/**
 * Domain classification information
 */
export interface DomainInfo {
  domain: string;
  isDisposable: boolean;
  isFreeProvider: boolean;
  isRoleBasedAccount: boolean;
  smtpProvider: string | null;
  estimatedAgeDays: number | null;
}

/**
 * SMTP validation result
 */
export interface SmtpValidationResult {
  isValid: boolean;
  isCatchAll: boolean;
  errorMessage: string | null;
}

/**
 * DNS/MX record information
 */
export interface MxRecordInfo {
  found: boolean;
  primaryRecord: string | null;
  allRecords: string[];
}

/**
 * Email validation configuration
 */
export interface EmailValidationConfig {
  enableSmtpValidation: boolean;
  smtpTimeout: number;
  maxRetries: number;
  enableCaching: boolean;
  cacheTtlSeconds: number;
}
