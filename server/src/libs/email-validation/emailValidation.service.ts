import '@/extensions';
import { EmailValidationResult, EmailValidationConfig } from './types/emailValidation.types';
import { EmailValidationResultEntity } from './domain/emailValidationResult';
import { DomainClassifier } from './infrastructure/domainClassifier';
import { DnsValidator } from './infrastructure/dnsValidator';
import { SmtpValidator } from './infrastructure/smtpValidator';

/**
 * Main email validation service that orchestrates all validation processes
 * Follows clean architecture principles with dependency injection
 */
export class EmailValidationService {
  private readonly domainClassifier: DomainClassifier;
  private readonly dnsValidator: DnsValidator;
  private readonly smtpValidator: SmtpValidator;
  private readonly config: EmailValidationConfig;

  constructor(
    config: Partial<EmailValidationConfig> = {},
    domainClassifier?: DomainClassifier,
    dnsValidator?: DnsValidator,
    smtpValidator?: SmtpValidator
  ) {
    this.config = {
      enableSmtpValidation: true,
      smtpTimeout: 10000,
      maxRetries: 1,
      enableCaching: false,
      cacheTtlSeconds: 3600,
      ...config,
    };

    // Dependency injection with defaults
    this.domainClassifier = domainClassifier || new DomainClassifier();
    this.dnsValidator = dnsValidator || new DnsValidator();
    this.smtpValidator =
      smtpValidator || new SmtpValidator(this.config.smtpTimeout, this.config.maxRetries);
  }

  /**
   * Main validation method that orchestrates all validation steps
   */
  async validateEmail(email: string): Promise<EmailValidationResult> {
    // Step 1: Basic syntax validation using existing extension
    const trimmedEmail = email.trim();

    if (!trimmedEmail.isValidEmail()) {
      return this.createInvalidResult(trimmedEmail, 'invalid_syntax');
    }

    // Step 2: Extract account and domain parts
    const domain = trimmedEmail.getEmailDomain();
    const account = trimmedEmail.split('@')[0] || '';

    if (!domain || !account) {
      return this.createInvalidResult(trimmedEmail, 'invalid_format');
    }

    // Step 3: Domain classification
    const domainInfo = this.domainClassifier.classifyDomain(domain, account);

    // Step 4: Check for domain typos and suggest corrections
    const suggestion = this.domainClassifier.suggestDomainCorrection(domain);

    // Step 5: Check for disposable domains first (reject regardless of MX records)
    if (domainInfo.isDisposable) {
      return this.createInvalidResult(trimmedEmail, 'disposable', {
        account,
        domain,
        domainInfo,
        suggestion,
        mxInfo: { found: false, primaryRecord: null, allRecords: [] },
      });
    }

    // Step 6: DNS/MX record validation
    const mxInfo = await this.dnsValidator.validateMxRecords(domain);

    if (!mxInfo.found) {
      return this.createInvalidResult(trimmedEmail, 'no_mx_record', {
        account,
        domain,
        domainInfo,
        suggestion,
        mxInfo,
      });
    }

    // Step 7: Determine validation status based on domain classification
    let status: 'valid' | 'invalid' | 'unknown' = 'valid';
    let subStatus: string | null = null;

    if (domainInfo.isRoleBasedAccount) {
      status = 'valid';
      subStatus = 'role_based';
    }

    // Step 8: SMTP validation (optional and limited)
    let smtpResult = null;
    if (
      this.config.enableSmtpValidation &&
      this.smtpValidator.shouldAttemptSmtpValidation(domain, mxInfo.primaryRecord || undefined) &&
      status === 'valid'
    ) {
      try {
        smtpResult = await this.smtpValidator.validateEmail(trimmedEmail, mxInfo.primaryRecord!);

        if (!smtpResult.isValid) {
          // Check if this is a genuine mailbox failure vs connection/blocking issue
          if (smtpResult.errorMessage && 
              (smtpResult.errorMessage.includes('550') || 
               smtpResult.errorMessage.includes('551') || 
               smtpResult.errorMessage.includes('553') ||
               smtpResult.errorMessage.includes('5.1.1') ||  // No such user
               smtpResult.errorMessage.includes('5.7.1'))) { // Access denied/blocked
            // Genuine SMTP rejection - mailbox likely doesn't exist
            status = 'invalid';
            subStatus = 'mailbox_not_found';
          } else if (smtpResult.errorMessage && smtpResult.errorMessage.includes('SMTP validation failed:')) {
            // For Google Workspace domains, SMTP connection failures often indicate non-existent mailboxes
            // This is a heuristic based on the fact that Google tends to block connections for invalid addresses
            if (mxInfo.primaryRecord && mxInfo.primaryRecord.toLowerCase().includes('aspmx.l.google.com')) {
              status = 'invalid';
              subStatus = 'mailbox_not_found';
            } else {
              status = 'unknown';
              subStatus = 'smtp_verification_unavailable';
            }
          } else {
            // Connection issue, timeout, or provider blocking - don't mark as invalid
            status = 'unknown';
            subStatus = 'smtp_verification_unavailable';
          }
        } else if (smtpResult.isCatchAll) {
          subStatus = 'catch_all';
        }
      } catch (_error) {
        // SMTP validation failed, but don't mark email as invalid
        // Many legitimate email providers block SMTP validation
        status = 'unknown';
        subStatus = 'smtp_validation_failed';
      }
    }

    // Step 9: Extract potential name information from email
    const nameInfo = this.extractNameFromEmail(account);

    // Step 10: Create result entity
    const resultEntity = EmailValidationResultEntity.create({
      email: trimmedEmail,
      status,
      subStatus,
      freeEmail: domainInfo.isFreeProvider,
      didYouMean: suggestion ? `${account}@${suggestion}` : null,
      account,
      domain,
      domainAgeDays: domainInfo.estimatedAgeDays,
      smtpProvider: domainInfo.smtpProvider,
      mxFound: mxInfo.found,
      mxRecord: mxInfo.primaryRecord,
      firstname: nameInfo.firstName,
      lastname: nameInfo.lastName,
    });

    return resultEntity.toApiResponse();
  }

  /**
   * Creates an invalid email validation result
   */
  private createInvalidResult(
    email: string,
    subStatus: string,
    additionalInfo?: any
  ): EmailValidationResult {
    const domain = email.includes('@') ? email.getEmailDomain() : '';
    const account = email.includes('@') ? email.split('@')[0] || '' : '';

    // For invalid emails, provide fallback values to satisfy entity constraints
    const safeEmail = email.trim() || 'invalid@invalid.invalid';
    const safeAccount = account || 'invalid';
    const safeDomain = domain || 'invalid.invalid';

    const resultEntity = EmailValidationResultEntity.create({
      email: safeEmail,
      status: 'invalid',
      subStatus,
      freeEmail: additionalInfo?.domainInfo?.isFreeProvider || false,
      didYouMean: additionalInfo?.suggestion ? `${safeAccount}@${additionalInfo.suggestion}` : null,
      account: safeAccount,
      domain: safeDomain,
      domainAgeDays: additionalInfo?.domainInfo?.estimatedAgeDays || null,
      smtpProvider: additionalInfo?.domainInfo?.smtpProvider || null,
      mxFound: additionalInfo?.mxInfo?.found || false,
      mxRecord: additionalInfo?.mxInfo?.primaryRecord || null,
    });

    // Override the email in the response with the original (potentially invalid) email
    const response = resultEntity.toApiResponse();
    response.email = email;
    return response;
  }

  /**
   * Attempts to extract first and last name from email account part
   * This is speculative and has limited accuracy
   */
  private extractNameFromEmail(account: string): {
    firstName: string | null;
    lastName: string | null;
  } {
    // Skip role-based accounts
    const roleBasedPrefixes = ['admin', 'info', 'support', 'contact', 'sales', 'noreply'];
    if (roleBasedPrefixes.some((prefix) => account.toLowerCase().startsWith(prefix))) {
      return { firstName: null, lastName: null };
    }

    // Try to extract names from common patterns
    const patterns = [
      /^([a-z]+)\.([a-z]+)$/i, // john.doe
      /^([a-z]+)_([a-z]+)$/i, // john_doe
      /^([a-z]+)-([a-z]+)$/i, // john-doe
      /^([a-z]+)([a-z]+)$/i, // johndoe (less reliable)
    ];

    for (const pattern of patterns) {
      const match = account.match(pattern);
      if (match && match[1] && match[2]) {
        return {
          firstName: this.capitalizeFirst(match[1]),
          lastName: this.capitalizeFirst(match[2]),
        };
      }
    }

    return { firstName: null, lastName: null };
  }

  /**
   * Capitalizes the first letter of a string
   */
  private capitalizeFirst(str: string): string {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  /**
   * Factory method to create service with default configuration
   */
  static createDefault(): EmailValidationService {
    return new EmailValidationService({
      enableSmtpValidation: true, // Enabled by default for accurate validation
      smtpTimeout: 10000,
      maxRetries: 2,
      enableCaching: false,
    });
  }

  /**
   * Factory method to create service with aggressive validation
   */
  static createWithSmtpValidation(): EmailValidationService {
    return new EmailValidationService({
      enableSmtpValidation: true,
      smtpTimeout: 10000,
      maxRetries: 2,
      enableCaching: true,
      cacheTtlSeconds: 3600,
    });
  }
}
