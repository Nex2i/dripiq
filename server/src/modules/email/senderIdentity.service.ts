import { emailSenderIdentityRepository, domainValidationRepository } from '@/repositories';
import { EmailSenderIdentity, NewEmailSenderIdentity } from '@/db/schema';
import { sendgridClient } from '@/libs/email/strategies/sendgrid.client';
import { SendgridTokenHelper } from '@/libs/email/sendgridToken.helper';
import { validateEmailSignature } from '@/utils/htmlSanitization';

function normalizeDomainFromEmail(email: string): string {
  const domain = email.getEmailDomain();
  if (!domain) throw new Error('Invalid email address');
  return domain;
}

// Extractor moved to SendgridTokenHelper

function extractSendgridIdFromBody(body: unknown): string | undefined {
  if (body && typeof body === 'object' && 'id' in body) {
    const id = (body as { id?: unknown }).id;
    return typeof id === 'string' ? id : undefined;
  }
  return undefined;
}

function validateAndSanitizeSignature(emailSignature?: string | null): string | null {
  if (emailSignature === undefined || emailSignature === null) {
    return null;
  }

  const validation = validateEmailSignature(emailSignature);
  if (!validation.isValid) {
    const error: any = new Error('Validation error');
    error.statusCode = 422;
    error.details = [{ field: 'emailSignature', message: validation.error }];
    throw error;
  }

  return validation.sanitized || null;
}

export class SenderIdentityService {
  static async createSenderIdentity(params: {
    tenantId: string;
    userId: string;
    fromEmail: string;
    fromName: string;
    address?: string;
    city?: string;
    country?: string;
    emailSignature?: string;
  }): Promise<EmailSenderIdentity> {
    const { tenantId, userId, fromEmail, fromName } = params;
    const domain = normalizeDomainFromEmail(fromEmail).toLowerCase();

    // Validate and sanitize email signature
    const sanitizedSignature = validateAndSanitizeSignature(params.emailSignature);

    // Check if domain is pre-approved for automatic verification
    const isDomainApproved = await domainValidationRepository.domainExists(domain);

    if (isDomainApproved) {
      // Skip SendGrid validation and create as verified
      const created = await emailSenderIdentityRepository.createForTenant(tenantId, {
        userId,
        fromEmail,
        fromName,
        domain,
        sendgridSenderId: null, // No SendGrid ID needed for pre-approved domains
        validationStatus: 'verified',
        lastValidatedAt: new Date(),
        emailSignature: sanitizedSignature,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Omit<NewEmailSenderIdentity, 'tenantId'>);

      return created;
    }

    // Domain not pre-approved, continue with existing SendGrid flow
    if (!params.address || !params.city) {
      const error: any = new Error('Validation error');
      error.statusCode = 422;
      error.details = [
        ...(!params.address ? [{ field: 'address', message: 'required' }] : []),
        ...(!params.city ? [{ field: 'city', message: 'required' }] : []),
      ];
      throw error;
    }

    // Validate with SendGrid FIRST to avoid creating partial records on provider failure
    const country = (params.country || 'USA').toUpperCase();
    const [_resp, body] = await sendgridClient.validateSender({
      email: fromEmail,
      name: fromName,
      address: params.address!,
      city: params.city!,
      country,
    });
    const sendgridId = extractSendgridIdFromBody(body);

    // Create the identity including the provider sender id if available
    const created = await emailSenderIdentityRepository.createForTenant(tenantId, {
      userId,
      fromEmail,
      fromName,
      domain,
      sendgridSenderId: sendgridId,
      validationStatus: 'pending',
      emailSignature: sanitizedSignature,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Omit<NewEmailSenderIdentity, 'tenantId'>);

    return created;
  }

  // Self-scoped helpers
  static async getOrCreateForUser(
    tenantId: string,
    userId: string,
    fromName: string,
    fromEmail: string,
    address?: string,
    city?: string,
    country?: string,
    emailSignature?: string
  ) {
    const existing = await emailSenderIdentityRepository.findByUserIdForTenant(userId, tenantId);
    if (existing) {
      // Check if this existing identity's domain is now pre-approved
      const domain = normalizeDomainFromEmail(existing.fromEmail).toLowerCase();
      const isDomainApproved = await domainValidationRepository.domainExists(domain);

      if (isDomainApproved && existing.validationStatus !== 'verified') {
        // Auto-verify existing identity for pre-approved domain
        const updated = await emailSenderIdentityRepository.updateByIdForTenant(
          existing.id,
          tenantId,
          {
            validationStatus: 'verified',
            lastValidatedAt: new Date(),
            updatedAt: new Date(),
          } as Partial<NewEmailSenderIdentity>
        );
        return updated || existing;
      }

      // If an identity exists but is missing provider id, and caller supplies address/city, attempt validation now
      if (!existing.sendgridSenderId && address && city && !isDomainApproved) {
        const [_resp, body] = await sendgridClient.validateSender({
          email: existing.fromEmail,
          name: existing.fromName,
          address,
          city,
          country: (country || 'USA').toUpperCase(),
        });
        const sendgridId = extractSendgridIdFromBody(body);
        const updated = await emailSenderIdentityRepository.updateByIdForTenant(
          existing.id,
          tenantId,
          {
            sendgridSenderId: sendgridId,
            validationStatus: 'pending',
            updatedAt: new Date(),
          } as Partial<NewEmailSenderIdentity>
        );
        return updated || existing;
      }
      return existing;
    }
    return await this.createSenderIdentity({
      tenantId,
      userId,
      fromEmail,
      fromName,
      address,
      city,
      country,
      emailSignature,
    });
  }

  static async resendForUser(tenantId: string, userId: string) {
    const identity = await emailSenderIdentityRepository.findByUserIdForTenant(userId, tenantId);
    if (!identity) throw new Error('No sender identity found');
    if (!identity.sendgridSenderId) {
      throw new Error('Missing provider sender id. Please complete the initial setup first.', {
        cause: { tenantId, userId },
      });
    } else {
      await sendgridClient.resendSenderVerification(identity.sendgridSenderId);
    }
    return { message: 'Verification email resent' };
  }

  static async retryForUser(
    tenantId: string,
    userId: string,
    fromName: string,
    fromEmail: string,
    address?: string,
    city?: string,
    country?: string,
    emailSignature?: string
  ) {
    const identity = await emailSenderIdentityRepository.findByUserIdForTenant(userId, tenantId);
    if (!identity) {
      return await this.createSenderIdentity({
        tenantId,
        userId,
        fromEmail,
        fromName,
        address,
        city,
        country,
        emailSignature,
      });
    }

    // Check if domain is pre-approved for automatic verification
    const domain = normalizeDomainFromEmail(identity.fromEmail).toLowerCase();
    const isDomainApproved = await domainValidationRepository.domainExists(domain);

    if (isDomainApproved && identity.validationStatus !== 'verified') {
      // Auto-verify for pre-approved domain
      const updated = await emailSenderIdentityRepository.updateByIdForTenant(
        identity.id,
        tenantId,
        {
          validationStatus: 'verified',
          lastValidatedAt: new Date(),
          updatedAt: new Date(),
        } as Partial<NewEmailSenderIdentity>
      );
      return updated || identity;
    }

    if (!identity.sendgridSenderId && !isDomainApproved) {
      if (!address || !city) {
        const error: any = new Error('Validation error');
        error.statusCode = 422;
        error.details = [
          ...(!address ? [{ field: 'address', message: 'required' }] : []),
          ...(!city ? [{ field: 'city', message: 'required' }] : []),
        ];
        throw error;
      }
      const [_resp, body] = await sendgridClient.validateSender({
        email: identity.fromEmail,
        name: identity.fromName,
        address,
        city,
        country: (country || 'USA').toUpperCase(),
      });
      const sendgridId = extractSendgridIdFromBody(body);
      const updated = await emailSenderIdentityRepository.updateByIdForTenant(
        identity.id,
        tenantId,
        {
          sendgridSenderId: sendgridId,
          validationStatus: 'pending',
          updatedAt: new Date(),
        } as Partial<NewEmailSenderIdentity>
      );
      return updated || identity;
    }

    if (identity.sendgridSenderId && !isDomainApproved) {
      await sendgridClient.resendSenderVerification(identity.sendgridSenderId);
    }

    return identity;
  }

  static async verifyForUser(tenantId: string, userId: string, sendgridValidationUrl: string) {
    const identity = await emailSenderIdentityRepository.findByUserIdForTenant(userId, tenantId);
    if (!identity)
      throw new Error('No email sender identity found for the specified user and tenant');

    const token = SendgridTokenHelper.extractTokenFromUrlOrToken(sendgridValidationUrl);
    if (!token) {
      const error: any = new Error('Invalid SendGrid validation URL provided');
      error.statusCode = 422;
      error.details = [
        { field: 'sendgridValidationUrl', message: 'URL must contain a valid verification token' },
      ];
      throw error;
    }

    const { statusCode } = await sendgridClient.verifySenderWithToken(token);
    if (statusCode >= 200 && statusCode < 300) {
      const updated = await emailSenderIdentityRepository.updateByIdForTenant(
        identity.id,
        tenantId,
        {
          validationStatus: 'verified',
          lastValidatedAt: new Date(),
          updatedAt: new Date(),
        } as Partial<NewEmailSenderIdentity>
      );
      return updated ?? identity;
    }

    const error: any = new Error(
      'Failed to verify sender identity with SendGrid - verification token may be invalid or expired'
    );
    error.statusCode = statusCode ?? 400;
    throw error;
  }

  static async updateEmailSignature(
    tenantId: string,
    userId: string,
    emailSignature: string | null
  ): Promise<EmailSenderIdentity> {
    const identity = await emailSenderIdentityRepository.findByUserIdForTenant(userId, tenantId);
    if (!identity) {
      throw new Error('No sender identity found for the specified user and tenant');
    }

    // Validate and sanitize email signature
    const sanitizedSignature = validateAndSanitizeSignature(emailSignature);

    const updated = await emailSenderIdentityRepository.updateByIdForTenant(identity.id, tenantId, {
      emailSignature: sanitizedSignature,
      updatedAt: new Date(),
    } as Partial<NewEmailSenderIdentity>);

    return updated ?? identity;
  }
}
