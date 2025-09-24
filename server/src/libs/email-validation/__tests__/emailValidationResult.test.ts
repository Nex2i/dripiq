import { EmailValidationResultEntity } from '../domain/emailValidationResult';

describe('EmailValidationResultEntity', () => {
  describe('create', () => {
    it('should create a valid EmailValidationResult entity', () => {
      const params = {
        email: 'user@example.com',
        status: 'valid' as const,
        freeEmail: false,
        account: 'user',
        domain: 'example.com',
        mxFound: true,
      };

      const entity = EmailValidationResultEntity.create(params);

      expect(entity.email).toBe('user@example.com');
      expect(entity.status).toBe('valid');
      expect(entity.freeEmail).toBe(false);
      expect(entity.account).toBe('user');
      expect(entity.domain).toBe('example.com');
      expect(entity.mxFound).toBe(true);
    });

    it('should normalize email to lowercase and trim', () => {
      const params = {
        email: '  USER@EXAMPLE.COM  ',
        status: 'valid' as const,
        freeEmail: false,
        account: '  USER  ',
        domain: '  EXAMPLE.COM  ',
        mxFound: true,
      };

      const entity = EmailValidationResultEntity.create(params);

      expect(entity.email).toBe('user@example.com');
      expect(entity.account).toBe('user');
      expect(entity.domain).toBe('example.com');
    });

    it('should throw error for empty email', () => {
      const params = {
        email: '',
        status: 'valid' as const,
        freeEmail: false,
        account: 'user',
        domain: 'example.com',
        mxFound: true,
      };

      expect(() => EmailValidationResultEntity.create(params)).toThrow('Email address is required');
    });

    it('should throw error for empty account', () => {
      const params = {
        email: 'user@example.com',
        status: 'valid' as const,
        freeEmail: false,
        account: '',
        domain: 'example.com',
        mxFound: true,
      };

      expect(() => EmailValidationResultEntity.create(params)).toThrow(
        'Account and domain must be provided'
      );
    });

    it('should throw error for empty domain', () => {
      const params = {
        email: 'user@example.com',
        status: 'valid' as const,
        freeEmail: false,
        account: 'user',
        domain: '',
        mxFound: true,
      };

      expect(() => EmailValidationResultEntity.create(params)).toThrow(
        'Account and domain must be provided'
      );
    });

    it('should throw error when MX record is provided but mxFound is false', () => {
      const params = {
        email: 'user@example.com',
        status: 'valid' as const,
        freeEmail: false,
        account: 'user',
        domain: 'example.com',
        mxFound: false,
        mxRecord: 'mx.example.com',
      };

      expect(() => EmailValidationResultEntity.create(params)).toThrow(
        'MX record found but mxFound is false'
      );
    });

    it('should allow MX record when mxFound is true', () => {
      const params = {
        email: 'user@example.com',
        status: 'valid' as const,
        freeEmail: false,
        account: 'user',
        domain: 'example.com',
        mxFound: true,
        mxRecord: 'mx.example.com',
      };

      const entity = EmailValidationResultEntity.create(params);
      expect(entity.mxRecord).toBe('mx.example.com');
    });
  });

  describe('toApiResponse', () => {
    it('should convert entity to API response format', () => {
      const entity = EmailValidationResultEntity.create({
        email: 'user@example.com',
        status: 'valid',
        subStatus: 'role_based',
        freeEmail: false,
        didYouMean: null,
        account: 'user',
        domain: 'example.com',
        domainAgeDays: 5000,
        smtpProvider: 'custom',
        mxFound: true,
        mxRecord: 'mx.example.com',
        firstname: 'John',
        lastname: 'Doe',
      });

      const response = entity.toApiResponse();

      expect(response).toEqual({
        email: 'user@example.com',
        status: 'valid',
        sub_status: 'role_based',
        free_email: false,
        did_you_mean: null,
        account: 'user',
        domain: 'example.com',
        domain_age_days: 5000,
        smtp_provider: 'custom',
        mx_found: true,
        mx_record: 'mx.example.com',
        firstname: 'John',
        lastname: 'Doe',
      });
    });

    it('should handle null optional fields', () => {
      const entity = EmailValidationResultEntity.create({
        email: 'user@example.com',
        status: 'unknown',
        freeEmail: true,
        account: 'user',
        domain: 'example.com',
        mxFound: false,
      });

      const response = entity.toApiResponse();

      expect(response.sub_status).toBeNull();
      expect(response.did_you_mean).toBeNull();
      expect(response.domain_age_days).toBeNull();
      expect(response.smtp_provider).toBeNull();
      expect(response.mx_record).toBeNull();
      expect(response.firstname).toBeNull();
      expect(response.lastname).toBeNull();
    });
  });

  describe('business logic methods', () => {
    describe('isRisky', () => {
      it('should return true for invalid emails', () => {
        const entity = EmailValidationResultEntity.create({
          email: 'user@example.com',
          status: 'invalid',
          freeEmail: false,
          account: 'user',
          domain: 'example.com',
          mxFound: false,
        });

        expect(entity.isRisky()).toBe(true);
      });

      it('should return true for disposable emails', () => {
        const entity = EmailValidationResultEntity.create({
          email: 'user@disposable.com',
          status: 'valid',
          subStatus: 'disposable',
          freeEmail: false,
          account: 'user',
          domain: 'disposable.com',
          mxFound: true,
        });

        expect(entity.isRisky()).toBe(true);
      });

      it('should return true for spam traps', () => {
        const entity = EmailValidationResultEntity.create({
          email: 'trap@example.com',
          status: 'valid',
          subStatus: 'spam_trap',
          freeEmail: false,
          account: 'trap',
          domain: 'example.com',
          mxFound: true,
        });

        expect(entity.isRisky()).toBe(true);
      });

      it('should return false for valid emails', () => {
        const entity = EmailValidationResultEntity.create({
          email: 'user@example.com',
          status: 'valid',
          freeEmail: false,
          account: 'user',
          domain: 'example.com',
          mxFound: true,
        });

        expect(entity.isRisky()).toBe(false);
      });
    });

    describe('needsManualReview', () => {
      it('should return true for unknown status', () => {
        const entity = EmailValidationResultEntity.create({
          email: 'user@example.com',
          status: 'unknown',
          freeEmail: false,
          account: 'user',
          domain: 'example.com',
          mxFound: true,
        });

        expect(entity.needsManualReview()).toBe(true);
      });

      it('should return true for do_not_mail sub-status', () => {
        const entity = EmailValidationResultEntity.create({
          email: 'user@example.com',
          status: 'valid',
          subStatus: 'do_not_mail',
          freeEmail: false,
          account: 'user',
          domain: 'example.com',
          mxFound: true,
        });

        expect(entity.needsManualReview()).toBe(true);
      });

      it('should return false for valid emails without special sub-status', () => {
        const entity = EmailValidationResultEntity.create({
          email: 'user@example.com',
          status: 'valid',
          freeEmail: false,
          account: 'user',
          domain: 'example.com',
          mxFound: true,
        });

        expect(entity.needsManualReview()).toBe(false);
      });
    });
  });
});
