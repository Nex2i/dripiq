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

export class SenderIdentityService {
  static async createSenderIdentity(params: {
    tenantId: string;
    userId: string;
    fromEmail: string;
    fromName: string;
    domain?: string;
    isDefault?: boolean;
  }): Promise<EmailSenderIdentity> {
    const { tenantId, userId, fromEmail, fromName } = params;
    const domain = (params.domain || normalizeDomainFromEmail(fromEmail)).toLowerCase();

    const created = await emailSenderIdentityRepository.createForTenant(tenantId, {
      userId,
      fromEmail,
      fromName,
      domain,
      validationStatus: 'pending',
      isDefault: params.isDefault ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Omit<NewEmailSenderIdentity, 'tenantId'>);

    const [resp, body] = await sendgridClient.validateSender(fromEmail, fromName);
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
  static async getOrCreateForUser(tenantId: string, userId: string, fromName: string, fromEmail: string) {
    const existing = await emailSenderIdentityRepository.findByUserIdForTenant(userId, tenantId);
    if (existing) return existing;
    return await this.createSenderIdentity({ tenantId, userId, fromEmail, fromName, domain: undefined });
  }

  static async resendForUser(tenantId: string, userId: string) {
    const identity = await emailSenderIdentityRepository.findByUserIdForTenant(userId, tenantId);
    if (!identity) throw new Error('No sender identity found');
    if (!identity.sendgridSenderId) {
      const [resp, body] = await sendgridClient.validateSender(identity.fromEmail, identity.fromName);
      const sendgridId = (body as any)?.id as string | undefined;
      await emailSenderIdentityRepository.updateByIdForTenant(identity.id, tenantId, {
        sendgridSenderId: sendgridId,
        updatedAt: new Date(),
      } as Partial<NewEmailSenderIdentity>);
    } else {
      await sendgridClient.resendSenderVerification(identity.sendgridSenderId);
    }
    return { message: 'Verification email resent' };
  }

  static async retryForUser(tenantId: string, userId: string, fromName: string, fromEmail: string) {
    const identity = await emailSenderIdentityRepository.findByUserIdForTenant(userId, tenantId);
    if (!identity) {
      return await this.createSenderIdentity({ tenantId, userId, fromEmail, fromName });
    }
    if (!identity.sendgridSenderId) {
      const [resp, body] = await sendgridClient.validateSender(identity.fromEmail, identity.fromName);
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
}