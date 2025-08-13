import { emailSenderIdentityRepository } from '@/repositories';
import { EmailSenderIdentity, NewEmailSenderIdentity } from '@/db/schema';
import { sendgridClient } from '@/libs/email/sendgrid.client';

function normalizeDomainFromEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) throw new Error('Invalid email address');
  return parts[1]!.toLowerCase();
}

function mapSendgridStatusToValidationStatus(body: any): 'pending' | 'verified' | 'failed' {
  // SendGrid verified sender object includes fields like verified, from_email, nickname, id
  // We treat verified === true as 'verified'; if false and there was an error state we could map to 'failed', else 'pending'.
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

    // Create SendGrid Verified Single Sender and trigger verification email
    const [resp, body] = await sendgridClient.validateSender(fromEmail, fromName);
    const sendgridId = (body as any)?.id as string | undefined;

    const updated = await emailSenderIdentityRepository.updateByIdForTenant(created.id, tenantId, {
      sendgridSenderId: sendgridId,
      updatedAt: new Date(),
    } as Partial<NewEmailSenderIdentity>);

    return updated || created;
  }

  static async listSenderIdentities(tenantId: string): Promise<EmailSenderIdentity[]> {
    return await emailSenderIdentityRepository.findAllForTenant(tenantId);
  }

  static async getSenderIdentity(tenantId: string, id: string): Promise<EmailSenderIdentity | undefined> {
    return await emailSenderIdentityRepository.findByIdForTenant(id, tenantId);
  }

  static async resendVerification(tenantId: string, id: string) {
    const identity = await emailSenderIdentityRepository.findByIdForTenant(id, tenantId);
    if (!identity) throw new Error('Sender identity not found');
    if (!identity.sendgridSenderId) throw new Error('No provider sender id available');

    await sendgridClient.resendSenderVerification(identity.sendgridSenderId);

    return { message: 'Verification email resent' };
  }

  static async checkStatus(tenantId: string, id: string): Promise<EmailSenderIdentity> {
    const identity = await emailSenderIdentityRepository.findByIdForTenant(id, tenantId);
    if (!identity) throw new Error('Sender identity not found');
    if (!identity.sendgridSenderId) return identity; // still pending create

    const { body } = await sendgridClient.getVerifiedSender(identity.sendgridSenderId);
    const mapped = mapSendgridStatusToValidationStatus(body);

    const updated = await emailSenderIdentityRepository.updateByIdForTenant(id, tenantId, {
      validationStatus: mapped,
      lastValidatedAt: new Date(),
      updatedAt: new Date(),
    } as Partial<NewEmailSenderIdentity>);

    return updated || (identity as EmailSenderIdentity);
  }

  static async setDefault(tenantId: string, id: string): Promise<EmailSenderIdentity> {
    const all = await emailSenderIdentityRepository.findAllForTenant(tenantId);

    // Unset defaults
    await Promise.all(
      all
        .filter((s) => s.isDefault && s.id !== id)
        .map((s) =>
          emailSenderIdentityRepository.updateByIdForTenant(s.id, tenantId, {
            isDefault: false,
            updatedAt: new Date(),
          } as Partial<NewEmailSenderIdentity>)
        )
    );

    const updated = await emailSenderIdentityRepository.updateByIdForTenant(id, tenantId, {
      isDefault: true,
      updatedAt: new Date(),
    } as Partial<NewEmailSenderIdentity>);

    if (!updated) throw new Error('Unable to set default sender identity');
    return updated;
  }

  static async remove(tenantId: string, id: string): Promise<{ message: string }> {
    const identity = await emailSenderIdentityRepository.findByIdForTenant(id, tenantId);
    if (!identity) throw new Error('Sender identity not found');
    if (identity.isDefault) throw new Error('Cannot delete default sender identity');

    await emailSenderIdentityRepository.deleteByIdForTenant(id, tenantId);
    return { message: 'Sender identity deleted' };
  }
}