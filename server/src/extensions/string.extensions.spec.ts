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

  describe('getDomain', () => {
    it('should extract domain from simple URLs', () => {
      expect('https://www.google.com/'.getDomain()).toBe('google');
      expect('http://www.facebook.com/'.getDomain()).toBe('facebook');
      expect('https://twitter.com'.getDomain()).toBe('twitter');
      expect('www.example.com'.getDomain()).toBe('example');
    });
  });
});
