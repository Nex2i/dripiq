import crypto from 'crypto';
import { FRONTEND_ORIGIN } from '@/config';
import {
  leadPointOfContactRepository,
  leadRepository,
  scheduleBookingTokenRepository,
} from '@/repositories';
import { BadRequestError, NotFoundError } from '@/exceptions/error';
import { ScheduleBookingToken } from '@/db/schema';

export interface IssueBookingTokenInput {
  tenantId: string;
  leadId: string;
  contactId: string;
  userId: string;
  campaignId?: string;
  nodeId?: string;
  outboundMessageId?: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface BookingTokenContext {
  token: ScheduleBookingToken;
  lead: {
    id: string;
    name: string;
    url: string;
  };
  contact: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    company: string | null;
  };
}

const DEFAULT_TOKEN_TTL_DAYS = 90;

export class BookingTokenService {
  async issue(input: IssueBookingTokenInput): Promise<{ rawToken: string; record: ScheduleBookingToken }> {
    const lead = await leadRepository.findByIdForTenant(input.leadId, input.tenantId);
    if (!lead) {
      throw new NotFoundError('Lead not found');
    }

    if (lead.ownerId !== input.userId) {
      throw new BadRequestError('Lead owner does not match scheduling user');
    }

    const contact = await leadPointOfContactRepository.findByIdForTenant(
      input.contactId,
      input.tenantId
    );
    if (!contact || contact.leadId !== input.leadId) {
      throw new NotFoundError('Contact not found');
    }

    const rawToken = this.generateRawToken();
    const tokenHash = this.hashToken(rawToken);
    const expiresAt =
      input.expiresAt ?? new Date(Date.now() + DEFAULT_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    const record = await scheduleBookingTokenRepository.createForTenant(input.tenantId, {
      userId: input.userId,
      leadId: input.leadId,
      contactId: input.contactId,
      tokenHash,
      campaignId: input.campaignId,
      nodeId: input.nodeId,
      outboundMessageId: input.outboundMessageId,
      expiresAt,
      metadata: input.metadata ?? {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { rawToken, record };
  }

  async resolve(rawToken: string): Promise<BookingTokenContext> {
    const token = await scheduleBookingTokenRepository.findActiveByTokenHash(this.hashToken(rawToken));
    if (!token) {
      throw new NotFoundError('Booking link not found or expired');
    }

    const lead = await leadRepository.findByIdForTenant(token.leadId, token.tenantId);
    if (!lead) {
      throw new NotFoundError('Lead not found');
    }

    const contact = await leadPointOfContactRepository.findByIdForTenant(
      token.contactId,
      token.tenantId
    );
    if (!contact || contact.leadId !== lead.id) {
      throw new NotFoundError('Contact not found');
    }

    return {
      token,
      lead: {
        id: lead.id,
        name: lead.name,
        url: lead.url,
      },
      contact: {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
      },
    };
  }

  buildBookingUrl(rawToken: string): string {
    const origin = (FRONTEND_ORIGIN || process.env.API_URL || '').replace(/\/$/, '');
    if (!origin) {
      throw new Error('FRONTEND_ORIGIN or API_URL is required to build booking URLs');
    }

    return `${origin}/schedule/${encodeURIComponent(rawToken)}`;
  }

  async cleanupExpired(before = new Date()): Promise<number> {
    const deleted = await scheduleBookingTokenRepository.deleteExpired(before);
    return deleted.length;
  }

  hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  private generateRawToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }
}

export const bookingTokenService = new BookingTokenService();
