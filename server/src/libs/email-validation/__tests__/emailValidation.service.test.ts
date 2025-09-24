import '@/extensions';
import { EmailValidationService } from '../emailValidation.service';
import { DomainClassifier } from '../infrastructure/domainClassifier';
import { DnsValidator } from '../infrastructure/dnsValidator';
import { SmtpValidator } from '../infrastructure/smtpValidator';

describe('EmailValidationService', () => {
  let service: EmailValidationService;
  let mockDomainClassifier: jest.Mocked<DomainClassifier>;
  let mockDnsValidator: jest.Mocked<DnsValidator>;
  let mockSmtpValidator: jest.Mocked<SmtpValidator>;

  beforeEach(() => {
    // Create mocks
    mockDomainClassifier = {
      classifyDomain: jest.fn(),
      suggestDomainCorrection: jest.fn(),
    } as any;

    mockDnsValidator = {
      validateMxRecords: jest.fn(),
    } as any;

    mockSmtpValidator = {
      validateEmail: jest.fn(),
      shouldAttemptSmtpValidation: jest.fn(),
    } as any;

    // Create service with mocked dependencies
    service = new EmailValidationService(
      { enableSmtpValidation: false },
      mockDomainClassifier,
      mockDnsValidator,
      mockSmtpValidator
    );
  });

  describe('validateEmail', () => {
    it('should return invalid result for syntactically invalid email', async () => {
      const result = await service.validateEmail('invalid-email');

      expect(result.status).toBe('invalid');
      expect(result.sub_status).toBe('invalid_syntax');
      expect(result.email).toBe('invalid-email');
    });

    it('should return invalid result for email without domain', async () => {
      const result = await service.validateEmail('user@');

      expect(result.status).toBe('invalid');
      expect(result.sub_status).toBe('invalid_syntax'); // user@ fails syntax validation first
    });

    it('should return invalid result when no MX records found', async () => {
      mockDomainClassifier.classifyDomain.mockReturnValue({
        domain: 'nonexistent.com',
        isDisposable: false,
        isFreeProvider: false,
        isRoleBasedAccount: false,
        smtpProvider: null,
        estimatedAgeDays: null,
      });

      mockDomainClassifier.suggestDomainCorrection.mockReturnValue(null);

      mockDnsValidator.validateMxRecords.mockResolvedValue({
        found: false,
        primaryRecord: null,
        allRecords: [],
      });

      const result = await service.validateEmail('user@nonexistent.com');

      expect(result.status).toBe('invalid');
      expect(result.sub_status).toBe('no_mx_record');
      expect(result.mx_found).toBe(false);
    });

    it('should return invalid result for disposable email', async () => {
      mockDomainClassifier.classifyDomain.mockReturnValue({
        domain: 'tempmail.org',
        isDisposable: true,
        isFreeProvider: false,
        isRoleBasedAccount: false,
        smtpProvider: null,
        estimatedAgeDays: null,
      });

      mockDomainClassifier.suggestDomainCorrection.mockReturnValue(null);

      mockDnsValidator.validateMxRecords.mockResolvedValue({
        found: true,
        primaryRecord: 'mx.tempmail.org',
        allRecords: ['mx.tempmail.org'],
      });

      const result = await service.validateEmail('user@tempmail.org');

      expect(result.status).toBe('invalid');
      expect(result.sub_status).toBe('disposable');
      expect(result.mx_found).toBe(false); // MX lookup skipped for disposable domains
    });

    it('should return valid result for role-based email', async () => {
      mockDomainClassifier.classifyDomain.mockReturnValue({
        domain: 'example.com',
        isDisposable: false,
        isFreeProvider: false,
        isRoleBasedAccount: true,
        smtpProvider: null,
        estimatedAgeDays: 5000,
      });

      mockDomainClassifier.suggestDomainCorrection.mockReturnValue(null);

      mockDnsValidator.validateMxRecords.mockResolvedValue({
        found: true,
        primaryRecord: 'mx.example.com',
        allRecords: ['mx.example.com'],
      });

      const result = await service.validateEmail('admin@example.com');

      expect(result.status).toBe('valid');
      expect(result.sub_status).toBe('role_based');
      expect(result.account).toBe('admin');
      expect(result.domain).toBe('example.com');
    });

    it('should return valid result for free email provider', async () => {
      mockDomainClassifier.classifyDomain.mockReturnValue({
        domain: 'gmail.com',
        isDisposable: false,
        isFreeProvider: true,
        isRoleBasedAccount: false,
        smtpProvider: 'google',
        estimatedAgeDays: 7300,
      });

      mockDomainClassifier.suggestDomainCorrection.mockReturnValue(null);

      mockDnsValidator.validateMxRecords.mockResolvedValue({
        found: true,
        primaryRecord: 'gmail-smtp-in.l.google.com',
        allRecords: ['gmail-smtp-in.l.google.com', 'alt1.gmail-smtp-in.l.google.com'],
      });

      const result = await service.validateEmail('john.doe@gmail.com');

      expect(result.status).toBe('valid');
      expect(result.sub_status).toBe(null);
      expect(result.free_email).toBe(true);
      expect(result.smtp_provider).toBe('google');
      expect(result.firstname).toBe('John');
      expect(result.lastname).toBe('Doe');
    });

    it('should suggest correction for typos', async () => {
      mockDomainClassifier.classifyDomain.mockReturnValue({
        domain: 'gmai.com',
        isDisposable: false,
        isFreeProvider: false,
        isRoleBasedAccount: false,
        smtpProvider: null,
        estimatedAgeDays: null,
      });

      mockDomainClassifier.suggestDomainCorrection.mockReturnValue('gmail.com');

      mockDnsValidator.validateMxRecords.mockResolvedValue({
        found: false,
        primaryRecord: null,
        allRecords: [],
      });

      const result = await service.validateEmail('user@gmai.com');

      expect(result.status).toBe('invalid');
      expect(result.did_you_mean).toBe('user@gmail.com');
    });

    it('should extract names from email patterns', async () => {
      mockDomainClassifier.classifyDomain.mockReturnValue({
        domain: 'company.com',
        isDisposable: false,
        isFreeProvider: false,
        isRoleBasedAccount: false,
        smtpProvider: null,
        estimatedAgeDays: 3000,
      });

      mockDomainClassifier.suggestDomainCorrection.mockReturnValue(null);

      mockDnsValidator.validateMxRecords.mockResolvedValue({
        found: true,
        primaryRecord: 'mx.company.com',
        allRecords: ['mx.company.com'],
      });

      const testCases = [
        { email: 'jane.smith@company.com', expectedFirst: 'Jane', expectedLast: 'Smith' },
        { email: 'mike_johnson@company.com', expectedFirst: 'Mike', expectedLast: 'Johnson' },
        { email: 'bob-wilson@company.com', expectedFirst: 'Bob', expectedLast: 'Wilson' },
      ];

      for (const testCase of testCases) {
        const result = await service.validateEmail(testCase.email);
        expect(result.firstname).toBe(testCase.expectedFirst);
        expect(result.lastname).toBe(testCase.expectedLast);
      }
    });

    it('should not extract names from role-based accounts', async () => {
      mockDomainClassifier.classifyDomain.mockReturnValue({
        domain: 'company.com',
        isDisposable: false,
        isFreeProvider: false,
        isRoleBasedAccount: true,
        smtpProvider: null,
        estimatedAgeDays: 3000,
      });

      mockDomainClassifier.suggestDomainCorrection.mockReturnValue(null);

      mockDnsValidator.validateMxRecords.mockResolvedValue({
        found: true,
        primaryRecord: 'mx.company.com',
        allRecords: ['mx.company.com'],
      });

      const result = await service.validateEmail('admin@company.com');

      expect(result.firstname).toBe(null);
      expect(result.lastname).toBe(null);
    });
  });

  describe('factory methods', () => {
    it('should create default service with SMTP validation enabled', () => {
      const defaultService = EmailValidationService.createDefault();
      expect(defaultService).toBeInstanceOf(EmailValidationService);
    });

    it('should create service with SMTP validation enabled', () => {
      const smtpService = EmailValidationService.createWithSmtpValidation();
      expect(smtpService).toBeInstanceOf(EmailValidationService);
    });
  });

  describe('edge cases', () => {
    it('should handle empty email', async () => {
      const result = await service.validateEmail('');
      expect(result.status).toBe('invalid');
      expect(result.sub_status).toBe('invalid_syntax');
    });

    it('should handle whitespace-only email', async () => {
      const result = await service.validateEmail('   ');
      expect(result.status).toBe('invalid');
      expect(result.sub_status).toBe('invalid_syntax');
    });

    it('should trim and normalize email', async () => {
      mockDomainClassifier.classifyDomain.mockReturnValue({
        domain: 'example.com',
        isDisposable: false,
        isFreeProvider: false,
        isRoleBasedAccount: false,
        smtpProvider: null,
        estimatedAgeDays: null,
      });

      mockDomainClassifier.suggestDomainCorrection.mockReturnValue(null);

      mockDnsValidator.validateMxRecords.mockResolvedValue({
        found: true,
        primaryRecord: 'mx.example.com',
        allRecords: ['mx.example.com'],
      });

      const result = await service.validateEmail('  USER@EXAMPLE.COM  ');

      expect(result.email).toBe('user@example.com');
      expect(result.account).toBe('user');
      expect(result.domain).toBe('example.com');
    });
  });
});
