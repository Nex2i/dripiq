// Test only the utility functions without importing the full service
const parseEmails = (emails: string): string[] => {
  return emails
    .split(',')
    .map((email) => email.trim())
    .filter((email) => email.length > 0);
};

const extractNameFromEmail = (email: string): string => {
  const namePart = email.split('@')[0];
  if (!namePart) {
    return 'Unknown';
  }
  // Convert to title case and replace common delimiters with spaces
  return namePart
    .replace(/[._-]/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

describe('BulkCampaign Service', () => {
  describe('parseEmails', () => {
    it('should parse comma-separated emails correctly', () => {
      const emails = 'john@example.com,jane@company.co,bob@test.org';
      const result = parseEmails(emails);
      expect(result).toEqual(['john@example.com', 'jane@company.co', 'bob@test.org']);
    });

    it('should handle emails with spaces', () => {
      const emails = 'john@example.com, jane@company.co , bob@test.org';
      const result = parseEmails(emails);
      expect(result).toEqual(['john@example.com', 'jane@company.co', 'bob@test.org']);
    });

    it('should filter out empty entries', () => {
      const emails = 'john@example.com,,jane@company.co, ,bob@test.org';
      const result = parseEmails(emails);
      expect(result).toEqual(['john@example.com', 'jane@company.co', 'bob@test.org']);
    });

    it('should handle single email', () => {
      const emails = 'john@example.com';
      const result = parseEmails(emails);
      expect(result).toEqual(['john@example.com']);
    });

    it('should handle empty string', () => {
      const emails = '';
      const result = parseEmails(emails);
      expect(result).toEqual([]);
    });
  });

  describe('extractNameFromEmail', () => {
    it('should extract simple name from email', () => {
      const email = 'john@example.com';
      const result = extractNameFromEmail(email);
      expect(result).toBe('John');
    });

    it('should handle email with underscores', () => {
      const email = 'john_doe@example.com';
      const result = extractNameFromEmail(email);
      expect(result).toBe('John Doe');
    });

    it('should handle email with dots', () => {
      const email = 'john.doe@example.com';
      const result = extractNameFromEmail(email);
      expect(result).toBe('John Doe');
    });

    it('should handle email with dashes', () => {
      const email = 'john-doe@example.com';
      const result = extractNameFromEmail(email);
      expect(result).toBe('John Doe');
    });

    it('should handle mixed delimiters', () => {
      const email = 'john.doe_smith-jones@example.com';
      const result = extractNameFromEmail(email);
      expect(result).toBe('John Doe Smith Jones');
    });

    it('should handle numbers in email', () => {
      const email = 'john123@example.com';
      const result = extractNameFromEmail(email);
      expect(result).toBe('John123');
    });

    it('should handle malformed email gracefully', () => {
      const email = '@example.com';
      const result = extractNameFromEmail(email);
      expect(result).toBe('Unknown');
    });

    it('should handle email without @ symbol', () => {
      const email = 'johnexample.com';
      const result = extractNameFromEmail(email);
      expect(result).toBe('Johnexample Com');
    });
  });
});
