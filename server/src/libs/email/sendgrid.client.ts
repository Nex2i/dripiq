import sgMail, { ClientResponse, MailDataRequired } from '@sendgrid/mail';
import sgClient from '@sendgrid/client';
import { ClientRequest } from '@sendgrid/client/src/request';
import { logger } from '../logger';
import { ProviderIds, SenderValidationVerdict } from './sendgrid.types';
import { SendBase } from './sendgrid.types';

class SendgridClient {
  constructor() {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');
    sgClient.setApiKey(process.env.SENDGRID_API_KEY || '');
  }

  async sendEmail(input: SendBase): Promise<ProviderIds> {
    const hasHtml = !!input.html;
    const hasText = !!input.text;

    if (!hasHtml && !hasText) {
      throw new Error('Email body is required: provide html or text');
    }

    // Handle reply-to: default to from email if reply_to is null or whitespace
    const replyToEmail =
      input.reply_to && input.reply_to.trim() ? input.reply_to.trim() : input.from.email;

    const msg: Partial<MailDataRequired> = {
      from: input.from,
      to: input.to,
      subject: input.subject,
      replyTo: replyToEmail,
      headers: input.headers,
      categories: input.categories,
      customArgs: this.buildCustomArgs(input),
      ...(input.asmGroupId ? { asm: { groupId: input.asmGroupId } } : {}),
    };

    if (hasHtml) {
      msg.html = input.html;
    }
    if (hasText) {
      msg.text = input.text;
    }

    try {
      const [resp] = await sgMail.send(msg as MailDataRequired, false); // no built-in retry; you handle backoff in worker
      return this.extractProviderIds(resp);
    } catch (error) {
      logger.error(
        `Error sending email: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          error,
          msg,
        }
      );
      throw error;
    }
  }

  async validateEmail(
    email: string,
    source: string = 'lead_list'
  ): Promise<SenderValidationVerdict> {
    const data = {
      email: email,
      source: source,
    };

    const request: ClientRequest = {
      url: `/v3/validations/email`,
      method: 'POST',
      body: data,
    };

    const [_response] = await sgClient.request(request);
    return 'Valid';
  }

  async validateSender(input: {
    email: string;
    name: string;
    address: string;
    city: string;
    country: string;
  }) {
    const data = {
      nickname: input.name,
      from_email: input.email,
      from_name: input.name,
      reply_to: input.email,
      reply_to_name: input.name,
      address: input.address,
      city: input.city,
      country: input.country,
    };

    const request: ClientRequest = {
      url: `/v3/verified_senders`,
      method: 'POST',
      body: data,
    };

    try {
      const response = await sgClient.request(request);
      return response;
    } catch (err: any) {
      throw this.normalizeSendgridError(err, 'Failed to create verified sender in SendGrid');
    }
  }

  async resendSenderVerification(id: string) {
    const request: ClientRequest = {
      url: `/v3/verified_senders/resend/${id}`,
      method: 'POST',
    };

    try {
      const response = await sgClient.request(request);
      return response;
    } catch (err: any) {
      throw this.normalizeSendgridError(err, 'Failed to resend verification email in SendGrid');
    }
  }

  async getVerifiedSender(id: string): Promise<{ statusCode: number; body: any; headers: any }> {
    const request: ClientRequest = {
      url: `/v3/verified_senders/${id}`,
      method: 'GET',
    };

    const [resp, body] = await sgClient.request(request);
    return { statusCode: resp.statusCode, body, headers: resp.headers };
  }

  async verifySenderWithToken(
    token: string
  ): Promise<{ statusCode: number; body: any; headers: any }> {
    const postReq: ClientRequest = {
      url: `/v3/verified_senders/verify/${token}`,
      method: 'GET',
    } as any;
    const [resp, body] = await sgClient.request(postReq);
    return { statusCode: resp.statusCode, body, headers: resp.headers };
  }

  private extractProviderIds(resp: ClientResponse): ProviderIds {
    // SendGrid returns 202 + X-Message-Id when accepted
    const headers = resp.headers as Record<string, string | string[] | undefined>;
    const providerMessageId =
      (headers['x-message-id'] as string) || (headers['X-Message-Id'] as unknown as string);

    return {
      providerMessageId,
      responseStatus: resp.statusCode,
      responseHeaders: headers,
    };
  }

  private buildCustomArgs(input: {
    tenantId: string;
    campaignId: string;
    nodeId: string;
    outboundMessageId?: string;
    dedupeKey?: string;
    [k: string]: any;
  }) {
    return {
      tenant_id: input.tenantId,
      campaign_id: input.campaignId,
      node_id: input.nodeId,
      environment: process.env.NODE_ENV || 'development',
      ...(input.outboundMessageId ? { outbound_message_id: input.outboundMessageId } : {}),
      ...(input.dedupeKey ? { dedupe_key: input.dedupeKey } : {}),
    } as Record<string, string>;
  }

  private normalizeSendgridError(err: any, fallbackMessage: string) {
    const sgErrors: Array<{ field?: string; message?: string }> =
      err?.response?.body?.errors || err?.response?.data?.errors || [];

    const details = sgErrors
      .filter((e) => e && (e.field || e.message))
      .map((e) => ({
        field: String(e.field || 'sendgrid'),
        message: String(e.message || 'error'),
      }));

    const messageParts = details.length
      ? details.map((e) => (e.field ? `${e.field}: ${e.message}` : e.message))
      : [];

    const combinedMessage = messageParts.length
      ? `${fallbackMessage} - ${messageParts.join(', ')}`
      : fallbackMessage;

    const normalized: any = new Error(combinedMessage);
    normalized.statusCode = 422;
    normalized.details = details;
    normalized.provider = 'sendgrid';
    normalized.original = err;
    return normalized;
  }
}

export const sendgridClient = new SendgridClient();
