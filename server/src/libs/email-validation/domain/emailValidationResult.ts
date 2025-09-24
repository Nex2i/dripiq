import { EmailValidationResult } from '../types/emailValidation.types';

/**
 * Domain entity for email validation results
 * Encapsulates business logic and validation rules
 */
export class EmailValidationResultEntity {
  private constructor(
    public readonly email: string,
    public readonly status: 'valid' | 'invalid' | 'unknown',
    public readonly subStatus: string | null,
    public readonly freeEmail: boolean,
    public readonly didYouMean: string | null,
    public readonly account: string,
    public readonly domain: string,
    public readonly domainAgeDays: number | null,
    public readonly smtpProvider: string | null,
    public readonly mxFound: boolean,
    public readonly mxRecord: string | null,
    public readonly firstname: string | null,
    public readonly lastname: string | null
  ) {}

  /**
   * Creates a new EmailValidationResult entity with validation
   */
  static create(params: {
    email: string;
    status: 'valid' | 'invalid' | 'unknown';
    subStatus?: string | null;
    freeEmail: boolean;
    didYouMean?: string | null;
    account: string;
    domain: string;
    domainAgeDays?: number | null;
    smtpProvider?: string | null;
    mxFound: boolean;
    mxRecord?: string | null;
    firstname?: string | null;
    lastname?: string | null;
  }): EmailValidationResultEntity {
    // Business rule: email must not be empty
    if (!params.email?.trim()) {
      throw new Error('Email address is required');
    }

    // Business rule: account and domain must be extracted from email
    if (!params.account?.trim() || !params.domain?.trim()) {
      throw new Error('Account and domain must be provided');
    }

    // Business rule: if MX record is found, mxFound should be true
    if (params.mxRecord && !params.mxFound) {
      throw new Error('MX record found but mxFound is false');
    }

    return new EmailValidationResultEntity(
      params.email.toLowerCase().trim(),
      params.status,
      params.subStatus || null,
      params.freeEmail,
      params.didYouMean || null,
      params.account.toLowerCase().trim(),
      params.domain.toLowerCase().trim(),
      params.domainAgeDays || null,
      params.smtpProvider || null,
      params.mxFound,
      params.mxRecord || null,
      params.firstname || null,
      params.lastname || null
    );
  }

  /**
   * Converts to API response format
   */
  toApiResponse(): EmailValidationResult {
    return {
      email: this.email,
      status: this.status,
      sub_status: this.subStatus,
      free_email: this.freeEmail,
      did_you_mean: this.didYouMean,
      account: this.account,
      domain: this.domain,
      domain_age_days: this.domainAgeDays,
      smtp_provider: this.smtpProvider,
      mx_found: this.mxFound,
      mx_record: this.mxRecord,
      firstname: this.firstname,
      lastname: this.lastname,
    };
  }

  /**
   * Business rule: determines if email is considered risky
   */
  isRisky(): boolean {
    return (
      this.status === 'invalid' ||
      this.subStatus === 'disposable' ||
      this.subStatus === 'spam_trap' ||
      this.subStatus === 'abuse'
    );
  }

  /**
   * Business rule: determines if email needs manual review
   */
  needsManualReview(): boolean {
    return this.status === 'unknown' || this.subStatus === 'do_not_mail';
  }
}
