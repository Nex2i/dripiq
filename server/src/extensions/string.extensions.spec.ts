import './string.extensions';

describe('String Extensions', () => {
  describe('isValidEmail', () => {
    it('should return true for valid email addresses', () => {
      expect('test@example.com'.isValidEmail()).toBe(true);
      expect('user.name@domain.co.uk'.isValidEmail()).toBe(true);
      expect('admin@test-domain.org'.isValidEmail()).toBe(true);
      expect('user+tag@example.net'.isValidEmail()).toBe(true);
      expect('a@b.co'.isValidEmail()).toBe(true);
      expect('test123@example123.com'.isValidEmail()).toBe(true);
    });

    it('should return false for invalid email addresses', () => {
      expect('invalid-email'.isValidEmail()).toBe(false);
      expect('@example.com'.isValidEmail()).toBe(false);
      expect('user@'.isValidEmail()).toBe(false);
      expect('user@domain'.isValidEmail()).toBe(false);
      expect('user name@example.com'.isValidEmail()).toBe(false);
      expect('user@domain .com'.isValidEmail()).toBe(false);
      expect('user@@example.com'.isValidEmail()).toBe(false);
      expect('user@exam ple.com'.isValidEmail()).toBe(false);
    });

    it('should return false for empty or null strings', () => {
      expect(''.isValidEmail()).toBe(false);
      expect(' '.isValidEmail()).toBe(false);
      expect('   '.isValidEmail()).toBe(false);
      expect('\t'.isValidEmail()).toBe(false);
      expect('\n'.isValidEmail()).toBe(false);
    });
  });

  describe('isNullOrEmpty', () => {
    it('should return true for null, empty, or whitespace strings', () => {
      expect(''.isNullOrEmpty()).toBe(true);
      expect(' '.isNullOrEmpty()).toBe(true);
      expect('   '.isNullOrEmpty()).toBe(true);
      expect('\t'.isNullOrEmpty()).toBe(true);
      expect('\n'.isNullOrEmpty()).toBe(true);
      expect('\r\n'.isNullOrEmpty()).toBe(true);
      expect('  \t  \n  '.isNullOrEmpty()).toBe(true);
    });

    it('should return false for strings with content', () => {
      expect('hello'.isNullOrEmpty()).toBe(false);
      expect('test string'.isNullOrEmpty()).toBe(false);
      expect('a'.isNullOrEmpty()).toBe(false);
      expect(' hello '.isNullOrEmpty()).toBe(false);
      expect('0'.isNullOrEmpty()).toBe(false);
      expect('false'.isNullOrEmpty()).toBe(false);
    });
  });

  describe('getUrlSlug', () => {
    it('should extract domain from simple URLs', () => {
      expect('https://www.google.com/'.getUrlSlug()).toBe('google');
      expect('http://www.facebook.com/'.getUrlSlug()).toBe('facebook');
      expect('https://twitter.com'.getUrlSlug()).toBe('twitter');
      expect('www.example.com'.getUrlSlug()).toBe('example');
    });

    it('should handle URLs with search params as documented', () => {
      // Given https://www.google.com/search?q=test&oq=test&sourceid=chrome&ie=UTF-8
      // should return google/search -> google-search
      expect(
        'https://www.google.com/search?q=test&oq=test&sourceid=chrome&ie=UTF-8'.getUrlSlug()
      ).toBe('google-search');
    });

    it('should handle complex paths as documented', () => {
      // given https://www.google.com/search/internet/tree
      // should return google-search-internet-tree
      expect('https://www.google.com/search/internet/tree'.getUrlSlug()).toBe(
        'google-search-internet-tree'
      );
    });

    it('should handle various URL formats', () => {
      expect('https://subdomain.example.com/path/to/page'.getUrlSlug()).toBe(
        'subdomain-example-path-to-page'
      );
      expect('http://www.site.org/about'.getUrlSlug()).toBe('site-about');
      expect('https://api.service.net/v1/users'.getUrlSlug()).toBe('api-service-v1-users');
    });

    it('should handle URLs without paths', () => {
      expect('https://example.com'.getUrlSlug()).toBe('example');
      expect('http://www.test.org'.getUrlSlug()).toBe('test');
      expect('subdomain.example.net'.getUrlSlug()).toBe('subdomain-example');
    });

    it('should handle URLs with trailing slashes', () => {
      expect('https://www.example.com/'.getUrlSlug()).toBe('example');
      expect('https://www.example.com/path/'.getUrlSlug()).toBe('example-path');
    });

    it('should handle URLs with complex query parameters', () => {
      expect('https://www.example.com/search?q=test%20query&sort=date&page=1'.getUrlSlug()).toBe(
        'example-search'
      );
      expect(
        'https://shop.example.com/products?category=electronics&price=100-500'.getUrlSlug()
      ).toBe('shop-example-products');
    });

    it('should handle edge cases', () => {
      expect(''.getUrlSlug()).toBe('');
      expect('https://'.getUrlSlug()).toBe('');
      expect('http://'.getUrlSlug()).toBe('');
      expect('www.'.getUrlSlug()).toBe('');
    });

    it('should remove various TLDs correctly', () => {
      expect('https://example.com/path'.getUrlSlug()).toBe('example-path');
      expect('https://example.org/path'.getUrlSlug()).toBe('example-path');
      expect('https://example.net/path'.getUrlSlug()).toBe('example-path');
    });
  });

  describe('getFullDomain', () => {
    it('should extract full domain including TLD from URLs', () => {
      expect('https://www.google.com/'.getFullDomain()).toBe('google.com');
      expect('http://www.facebook.com/'.getFullDomain()).toBe('facebook.com');
      expect('https://twitter.com'.getFullDomain()).toBe('twitter.com');
      expect('www.example.com'.getFullDomain()).toBe('example.com');
      expect('leventhal-law.com'.getFullDomain()).toBe('leventhal-law.com');
    });

    it('should extract full domain from URLs with paths', () => {
      expect('https://www.leventhal-law.com/lawyers/alex-wilschke'.getFullDomain()).toBe(
        'leventhal-law.com'
      );
      expect('http://example.org/about/team'.getFullDomain()).toBe('example.org');
      expect('subdomain.example.net/api/v1'.getFullDomain()).toBe('subdomain.example.net');
    });

    it('should handle edge cases', () => {
      expect(''.getFullDomain()).toBe('');
      expect('https://'.getFullDomain()).toBe('');
      expect('http://'.getFullDomain()).toBe('');
      expect('www.'.getFullDomain()).toBe('');
    });
  });

  describe('getDomain', () => {
    it('should extract domain from simple URLs', () => {
      expect('https://www.google.com/'.getDomain()).toBe('google');
      expect('http://www.facebook.com/'.getDomain()).toBe('facebook');
      expect('https://twitter.com'.getDomain()).toBe('twitter');
      expect('www.example.com'.getDomain()).toBe('example');
    });
  });

  describe('cleanWebsiteUrl', () => {
    it.each([
      ['https://www.google.com/', 'https://www.google.com'],
      ['http://www.facebook.com/', 'https://www.facebook.com'],
      ['https://twitter.com', 'https://www.twitter.com'],
      ['www.example.com', 'https://www.example.com'],
      ['http://www.example.com', 'https://www.example.com'],
      ['www.example.com/path', 'https://www.example.com/path'],
    ])('should clean website URL', (url, expected) => {
      expect(url.cleanWebsiteUrl()).toBe(expected);
    });
  });

  describe('getEmailDomain', () => {
    it('should extract domain from valid email addresses', () => {
      expect('ryan@dribble.ai'.getEmailDomain()).toBe('dribble.ai');
      expect('user@filevine.com'.getEmailDomain()).toBe('filevine.com');
      expect('test@subdomain.example.org'.getEmailDomain()).toBe('subdomain.example.org');
      expect('admin@company-name.co.uk'.getEmailDomain()).toBe('company-name.co.uk');
    });

    it('should handle invalid email formats', () => {
      expect('invalid-email'.getEmailDomain()).toBe('');
      expect('@example.com'.getEmailDomain()).toBe('');
      expect('user@'.getEmailDomain()).toBe('');
      expect('user@@example.com'.getEmailDomain()).toBe('');
      expect(''.getEmailDomain()).toBe('');
      expect(' '.getEmailDomain()).toBe('');
    });

    it('should normalize domain to lowercase', () => {
      expect('User@EXAMPLE.COM'.getEmailDomain()).toBe('example.com');
      expect('test@MixedCase.Org'.getEmailDomain()).toBe('mixedcase.org');
    });
  });

  describe('cleanForDomain', () => {
    it('should clean tenant names for domain usage', () => {
      expect('Acme Corp'.cleanForDomain()).toBe('acme_corp');
      expect('Law Firm & Associates'.cleanForDomain()).toBe('law_firm_associates');
      expect('Tech-Company'.cleanForDomain()).toBe('tech_company');
      expect('Company   With   Spaces'.cleanForDomain()).toBe('company_with_spaces');
      expect('Special!@#$%Characters'.cleanForDomain()).toBe('special_characters');
    });

    it('should handle edge cases', () => {
      expect(''.cleanForDomain()).toBe('');
      expect('   '.cleanForDomain()).toBe('');
      expect('123Numbers456'.cleanForDomain()).toBe('123numbers456');
      expect('___Multiple___Underscores___'.cleanForDomain()).toBe('multiple_underscores');
    });

    it('should remove leading and trailing underscores', () => {
      expect('_StartUnderscore'.cleanForDomain()).toBe('startunderscore');
      expect('EndUnderscore_'.cleanForDomain()).toBe('endunderscore');
      expect('_Both_'.cleanForDomain()).toBe('both');
    });
  });
});
