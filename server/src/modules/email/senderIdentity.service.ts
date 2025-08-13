import { emailSenderIdentityRepository } from '@/repositories';
import { EmailSenderIdentity, NewEmailSenderIdentity } from '@/db/schema';
import { sendgridClient } from '@/libs/email/sendgrid.client';

function normalizeDomainFromEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) throw new Error('Invalid email address');
  return parts[1]!.toLowerCase();
}

function mapSendgridStatusToValidationStatus(body: any): 'pending' | 'verified' | 'failed' | 'validated' {
  if (!body) return 'pending';
  if (body.verified === true) return 'verified';
  return 'pending';
}

function extractTokenFromUrlOrToken(input: string): string | null {
  try {
    // If it's a URL, parse query param 'token'
    if (input.startsWith('http://') || input.startsWith('https://')) {
      const url = new URL(input);
      const token = url.searchParams.get('token');
      return token;
    }
    // Else assume it's the raw token
    return input;
  } catch {
    return null;
  }
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
  }): Promise<EmailSenderIdentity> {
    const { tenantId, userId, fromEmail, fromName } = params;
    const domain = normalizeDomainFromEmail(fromEmail).toLowerCase();

    if (!params.address || !params.city) {
      const error: any = new Error('Validation error');
      error.statusCode = 422;
      error.details = [
        ...(!params.address ? [{ field: 'address', message: 'required' }] : []),
        ...(!params.city ? [{ field: 'city', message: 'required' }] : []),
      ];
      throw error;
    }

    const created = await emailSenderIdentityRepository.createForTenant(tenantId, {
      userId,
      fromEmail,
      fromName,
      domain,
      validationStatus: 'pending',
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Omit<NewEmailSenderIdentity, 'tenantId'>);

    const country = (params.country || 'USA').toUpperCase();
    const [resp, body] = await sendgridClient.validateSender({
      email: fromEmail,
      name: fromName,
      address: params.address!,
      city: params.city!,
      country,
    });
    const sendgridId = (body as any)?.id as string | undefined;

    const updated = await emailSenderIdentityRepository.updateByIdForTenant(created.id, tenantId, {
      sendgridSenderId: sendgridId,
      updatedAt: new Date(),
    } as Partial<NewEmailSenderIdentity>);

    return updated || created;
  }

  static async checkStatus(tenantId: string, id: string): Promise<EmailSenderIdentity> {
    const identity = await emailSenderIdentityRepository.findByIdForTenant(id, tenantId);
    if (!identity) throw new Error('Sender identity not found');
    if (!identity.sendgridSenderId) return identity;

    const { body } = await sendgridClient.getVerifiedSender(identity.sendgridSenderId);
    const mapped = mapSendgridStatusToValidationStatus(body);

    const updated = await emailSenderIdentityRepository.updateByIdForTenant(id, tenantId, {
      validationStatus: mapped,
      lastValidatedAt: new Date(),
      updatedAt: new Date(),
    } as Partial<NewEmailSenderIdentity>);

    return updated || (identity as EmailSenderIdentity);
  }

  // Self-scoped helpers
  static async getOrCreateForUser(tenantId: string, userId: string, fromName: string, fromEmail: string, address?: string, city?: string, country?: string) {
    const existing = await emailSenderIdentityRepository.findByUserIdForTenant(userId, tenantId);
    if (existing) return existing;
    return await this.createSenderIdentity({ tenantId, userId, fromEmail, fromName, address, city, country });
  }

  static async resendForUser(tenantId: string, userId: string) {
    const identity = await emailSenderIdentityRepository.findByUserIdForTenant(userId, tenantId);
    if (!identity) throw new Error('No sender identity found');
    if (!identity.sendgridSenderId) {
      throw new Error('Missing provider sender id. Please retry creation.');
    } else {
      await sendgridClient.resendSenderVerification(identity.sendgridSenderId);
    }
    return { message: 'Verification email resent' };
  }

  static async retryForUser(tenantId: string, userId: string, fromName: string, fromEmail: string, address?: string, city?: string, country?: string) {
    const identity = await emailSenderIdentityRepository.findByUserIdForTenant(userId, tenantId);
    if (!identity) {
      return await this.createSenderIdentity({ tenantId, userId, fromEmail, fromName, address, city, country });
    }
    if (!identity.sendgridSenderId) {
      if (!address || !city) {
        const error: any = new Error('Validation error');
        error.statusCode = 422;
        error.details = [
          ...(!address ? [{ field: 'address', message: 'required' }] : []),
          ...(!city ? [{ field: 'city', message: 'required' }] : []),
        ];
        throw error;
      }
      const [resp, body] = await sendgridClient.validateSender({
        email: identity.fromEmail,
        name: identity.fromName,
        address,
        city,
        country: (country || 'USA').toUpperCase(),
      });
      const sendgridId = (body as any)?.id as string | undefined;
      const updated = await emailSenderIdentityRepository.updateByIdForTenant(identity.id, tenantId, {
        sendgridSenderId: sendgridId,
        validationStatus: 'pending',
        updatedAt: new Date(),
      } as Partial<NewEmailSenderIdentity>);
      return updated || identity;
    }
    await sendgridClient.resendSenderVerification(identity.sendgridSenderId);
    return identity;
  }

  static async checkForUser(tenantId: string, userId: string) {
    const identity = await emailSenderIdentityRepository.findByUserIdForTenant(userId, tenantId);
    if (!identity) throw new Error('No sender identity found');
    return this.checkStatus(tenantId, identity.id);
  }

  static async verifyForUser(tenantId: string, userId: string, sendgridValidationUrl: string) {
    const identity = await emailSenderIdentityRepository.findByUserIdForTenant(userId, tenantId);
    if (!identity) throw new Error('No sender identity found');

    const token = extractTokenFromUrlOrToken(sendgridValidationUrl);
    if (!token) {
      const error: any = new Error('Validation error');
      error.statusCode = 422;
      error.details = [{ field: 'sendgridValidationUrl', message: 'invalid' }];
      throw error;
    }

    const { statusCode } = await sendgridClient.verifySenderWithToken(token);
    if (statusCode >= 200 && statusCode < 300) {
      const updated = await emailSenderIdentityRepository.updateByIdForTenant(identity.id, tenantId, {
        validationStatus: 'verified',
        lastValidatedAt: new Date(),
        updatedAt: new Date(),
      } as Partial<NewEmailSenderIdentity>);
      return updated ?? identity;
    }

    const error: any = new Error('Verification failed');
    error.statusCode = 400;
    throw error;
  }
}