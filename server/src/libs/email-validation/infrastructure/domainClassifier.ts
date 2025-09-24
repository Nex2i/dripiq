import { DomainInfo } from '../types/emailValidation.types';

/**
 * Infrastructure service for classifying email domains
 * Handles detection of disposable, free, and role-based email addresses
 */
export class DomainClassifier {
  // Common free email providers
  private readonly freeProviders = new Set([
    'gmail.com',
    'yahoo.com',
    'hotmail.com',
    'outlook.com',
    'aol.com',
    'icloud.com',
    'protonmail.com',
    'mail.com',
    'gmx.com',
    'yandex.com',
    'zoho.com',
    'fastmail.com',
  ]);

  // Common disposable email providers (subset for demo)
  private readonly disposableProviders = new Set([
    '10minutemail.com',
    'tempmail.org',
    'guerrillamail.com',
    'mailinator.com',
    'throwaway.email',
    '0-mail.com',
    '1-mail.com',
    '33mail.com',
    'emailondeck.com',
    'getnada.com',
    'temp-mail.org',
    'yopmail.com',
  ]);

  // Common role-based account prefixes
  private readonly roleBasedPrefixes = new Set([
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
    'postmaster',
    'webmaster',
    'abuse',
    'security',
    'privacy',
    'legal',
    'billing',
    'accounting',
    'hr',
    'jobs',
    'careers',
  ]);

  // SMTP provider identification
  private readonly smtpProviders = new Map([
    ['gmail.com', 'google'],
    ['googlemail.com', 'google'],
    ['outlook.com', 'microsoft'],
    ['hotmail.com', 'microsoft'],
    ['live.com', 'microsoft'],
    ['msn.com', 'microsoft'],
    ['yahoo.com', 'yahoo'],
    ['yahoo.co.uk', 'yahoo'],
    ['ymail.com', 'yahoo'],
    ['aol.com', 'aol'],
    ['icloud.com', 'apple'],
    ['me.com', 'apple'],
    ['mac.com', 'apple'],
    ['protonmail.com', 'proton'],
    ['pm.me', 'proton'],
    ['zoho.com', 'zoho'],
    ['fastmail.com', 'fastmail'],
  ]);

  /**
   * Classifies a domain and returns detailed information
   */
  classifyDomain(domain: string, account: string): DomainInfo {
    const normalizedDomain = domain.toLowerCase().trim();
    const normalizedAccount = account.toLowerCase().trim();

    return {
      domain: normalizedDomain,
      isDisposable: this.isDisposableDomain(normalizedDomain),
      isFreeProvider: this.isFreeProvider(normalizedDomain),
      isRoleBasedAccount: this.isRoleBasedAccount(normalizedAccount),
      smtpProvider: this.getSmtpProvider(normalizedDomain),
      estimatedAgeDays: this.estimateDomainAge(normalizedDomain),
    };
  }

  /**
   * Checks if domain is a known disposable email provider
   */
  private isDisposableDomain(domain: string): boolean {
    return this.disposableProviders.has(domain);
  }

  /**
   * Checks if domain is a free email provider
   */
  private isFreeProvider(domain: string): boolean {
    return this.freeProviders.has(domain);
  }

  /**
   * Checks if the account part suggests a role-based email
   */
  private isRoleBasedAccount(account: string): boolean {
    return this.roleBasedPrefixes.has(account);
  }

  /**
   * Identifies the SMTP provider for the domain
   */
  private getSmtpProvider(domain: string): string | null {
    return this.smtpProviders.get(domain) || null;
  }

  /**
   * Estimates domain age (simplified implementation)
   * In production, this would integrate with domain age APIs
   */
  private estimateDomainAge(domain: string): number | null {
    // Simplified estimation based on known domains
    const wellKnownDomains = new Map([
      ['gmail.com', 7300], // ~20 years
      ['yahoo.com', 10950], // ~30 years
      ['hotmail.com', 10220], // ~28 years
      ['outlook.com', 4380], // ~12 years
      ['aol.com', 12775], // ~35 years
      ['icloud.com', 4745], // ~13 years
    ]);

    return wellKnownDomains.get(domain) || null;
  }

  /**
   * Suggests alternative spellings for common domain typos
   */
  suggestDomainCorrection(domain: string): string | null {
    const commonTypos = new Map([
      ['gmai.com', 'gmail.com'],
      ['gmial.com', 'gmail.com'],
      ['gmaill.com', 'gmail.com'],
      ['yahooo.com', 'yahoo.com'],
      ['yahho.com', 'yahoo.com'],
      ['hotmial.com', 'hotmail.com'],
      ['hotmial.com', 'hotmail.com'],
      ['outlok.com', 'outlook.com'],
      ['outloook.com', 'outlook.com'],
    ]);

    return commonTypos.get(domain.toLowerCase()) || null;
  }
}
