import { DomainClassifier } from '../infrastructure/domainClassifier';

describe('DomainClassifier', () => {
  let classifier: DomainClassifier;

  beforeEach(() => {
    classifier = new DomainClassifier();
  });

  describe('classifyDomain', () => {
    it('should identify free email providers', () => {
      const result = classifier.classifyDomain('gmail.com', 'user');

      expect(result.isFreeProvider).toBe(true);
      expect(result.smtpProvider).toBe('google');
      expect(result.isDisposable).toBe(false);
      expect(result.isRoleBasedAccount).toBe(false);
    });

    it('should identify disposable email providers', () => {
      const result = classifier.classifyDomain('10minutemail.com', 'user');

      expect(result.isDisposable).toBe(true);
      expect(result.isFreeProvider).toBe(false);
    });

    it('should identify role-based accounts', () => {
      const result = classifier.classifyDomain('company.com', 'admin');

      expect(result.isRoleBasedAccount).toBe(true);
      expect(result.isFreeProvider).toBe(false);
      expect(result.isDisposable).toBe(false);
    });

    it('should identify SMTP providers correctly', () => {
      const testCases = [
        { domain: 'gmail.com', expected: 'google' },
        { domain: 'outlook.com', expected: 'microsoft' },
        { domain: 'yahoo.com', expected: 'yahoo' },
        { domain: 'icloud.com', expected: 'apple' },
        { domain: 'unknown.com', expected: null },
      ];

      testCases.forEach(({ domain, expected }) => {
        const result = classifier.classifyDomain(domain, 'user');
        expect(result.smtpProvider).toBe(expected);
      });
    });

    it('should estimate domain age for known domains', () => {
      const result = classifier.classifyDomain('gmail.com', 'user');
      expect(result.estimatedAgeDays).toBe(7300); // ~20 years
    });

    it('should return null for unknown domain age', () => {
      const result = classifier.classifyDomain('unknown-domain.com', 'user');
      expect(result.estimatedAgeDays).toBe(null);
    });
  });

  describe('suggestDomainCorrection', () => {
    it('should suggest corrections for common typos', () => {
      const testCases = [
        { input: 'gmai.com', expected: 'gmail.com' },
        { input: 'gmial.com', expected: 'gmail.com' },
        { input: 'yahooo.com', expected: 'yahoo.com' },
        { input: 'hotmial.com', expected: 'hotmail.com' },
        { input: 'outlok.com', expected: 'outlook.com' },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = classifier.suggestDomainCorrection(input);
        expect(result).toBe(expected);
      });
    });

    it('should return null for domains without known corrections', () => {
      const result = classifier.suggestDomainCorrection('unknown-domain.com');
      expect(result).toBe(null);
    });

    it('should handle case insensitive corrections', () => {
      const result = classifier.suggestDomainCorrection('GMAI.COM');
      expect(result).toBe('gmail.com');
    });
  });

  describe('role-based account detection', () => {
    it('should detect common role-based prefixes', () => {
      const rolePrefixes = [
        'admin',
        'administrator',
        'info',
        'support',
        'help',
        'contact',
        'sales',
        'marketing',
        'noreply',
        'no-reply',
      ];

      rolePrefixes.forEach((prefix) => {
        const result = classifier.classifyDomain('company.com', prefix);
        expect(result.isRoleBasedAccount).toBe(true);
      });
    });

    it('should not flag normal user accounts as role-based', () => {
      const normalAccounts = ['john', 'jane', 'user123', 'employee'];

      normalAccounts.forEach((account) => {
        const result = classifier.classifyDomain('company.com', account);
        expect(result.isRoleBasedAccount).toBe(false);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty domain', () => {
      const result = classifier.classifyDomain('', 'user');

      expect(result.domain).toBe('');
      expect(result.isFreeProvider).toBe(false);
      expect(result.isDisposable).toBe(false);
      expect(result.smtpProvider).toBe(null);
    });

    it('should normalize domain and account to lowercase', () => {
      const result = classifier.classifyDomain('GMAIL.COM', 'USER');

      expect(result.domain).toBe('gmail.com');
      expect(result.isFreeProvider).toBe(true);
    });

    it('should handle domains with extra whitespace', () => {
      const result = classifier.classifyDomain('  gmail.com  ', '  user  ');

      expect(result.domain).toBe('gmail.com');
      expect(result.isFreeProvider).toBe(true);
    });
  });
});
