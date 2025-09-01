// string.extensions.ts

// eslint-disable-next-line
interface String {
  /**
   * Check if a string is a valid email address
   */
  isValidEmail(): boolean;
  /**
   * Check if a string is null or empty
   */
  isNullOrEmpty(): boolean;
  /**
   * Get a URL slug by removing protocol, www, query parameters, and fragments, and trailing slash
   */
  /**
   * Get a URL slug by removing protocol, www, query parameters, and fragments, and trailing slash
   */
  getUrlSlug(): string;
  /**
   * Get the full domain of a website URL including TLD, without protocol or www
   */
  getFullDomain(): string;
  /**
   * Get the domain of a website URL without the protocol or www
   */
  getDomain(): string;
  /**
   * Clean a website URL by adding https:// if missing, adding www. if missing, and removing trailing slash
   */
  cleanWebsiteUrl(): string;
  /**
   * Extract the domain from an email address
   */
  getEmailDomain(): string;
  /**
   * Clean a tenant name for use in domain generation (replace special chars and spaces with underscore)
   */
  cleanForDomain(): string;
}

String.prototype.isValidEmail = function (): boolean {
  if (this.isNullOrEmpty()) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(this.toString());
};

String.prototype.isNullOrEmpty = function (): boolean {
  return (
    this == null || this.trim() == '' || this.toString() == null || this.toString().trim() === ''
  );
};

String.prototype.getUrlSlug = function (): string {
  let url = this.toString();

  // Handle empty or invalid URLs
  if (!url || url.trim() === '') return '';

  // Remove protocol
  url = url.replace(/^https?:\/\//, '');

  // Remove www prefix
  url = url.replace(/^www\./, '');

  // Remove query parameters and fragments
  url = (url.split('?')[0] || '').split('#')[0] || '';

  // Remove trailing slash
  url = url.replace(/\/$/, '');

  // Handle edge cases
  if (!url || url.trim() === '') return '';

  // Split domain and path
  const parts = url.split('/');
  const domain = parts[0] || '';
  const pathParts = parts.slice(1);

  // Handle empty domain
  if (!domain) return '';

  // Remove TLD from domain
  let domainWithoutTld = domain;

  domainWithoutTld = domainWithoutTld.replace(/\.[^.]+$/, '');

  const domainParts = domainWithoutTld.split('.').filter((part) => part && part.trim() !== '');

  // Combine domain parts and path parts
  const allParts = [...domainParts, ...pathParts].filter((part) => part && part.trim() !== '');

  return allParts.join('-')?.toLowerCase() || '';
};

String.prototype.getFullDomain = function (): string {
  let url = this.toString();

  // Handle empty or invalid URLs
  if (!url || url.trim() === '') return '';

  // Remove protocol
  url = url.replace(/^https?:\/\//, '');

  // Remove www prefix
  url = url.replace(/^www\./, '');

  // Split by "/" and take the first part (domain only, no path)
  const domain = url.split('/')[0] || '';

  return domain?.toLowerCase() || '';
};

String.prototype.getDomain = function (): string {
  let url = this.toString();
  url = url.replace(/^https?:\/\//, '');
  url = url.replace(/^www\./, '');
  url = url.replace(/\.[^.]+$/, '');
  return url?.toLowerCase() || '';
};

String.prototype.cleanWebsiteUrl = function (): string {
  let url = this.toString().trim();

  // Add https:// if missing
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }

  // Add www. if missing
  const protocolMatch = url.match(/^(https?:\/\/)/i);
  const protocol = protocolMatch ? protocolMatch[1] : '';
  let host = url.slice(protocol?.length);
  if (!host.startsWith('www.')) {
    host = 'www.' + host;
  }

  // Remove trailing slash
  if (host.endsWith('/')) {
    host = host.slice(0, -1);
  }

  return (protocol + host)?.toLowerCase() || '';
};

String.prototype.getEmailDomain = function (): string {
  const email = this.toString().trim();
  if (!email || !email.includes('@')) return '';

  const parts = email.split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return '';

  return parts[1]?.toLowerCase() || '';
};

String.prototype.cleanForDomain = function (): string {
  return this.toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
};
