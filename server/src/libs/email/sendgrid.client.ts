import sgMail, { ClientResponse, MailDataRequired } from '@sendgrid/mail';
import sgClient from '@sendgrid/client';
import { ClientRequest } from '@sendgrid/client/src/request';
import { ProviderIds, SenderValidationVerdict } from './sendgrid.types';
import { SendBase } from './sendgrid.types';

class SendgridClient {
  constructor() {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');
    sgClient.setApiKey(process.env.SENDGRID_API_KEY || '');
  }

  async sendEmail(input: SendBase): Promise<ProviderIds> {
    const body = input.html ?? input.text;
    if (!body) {
      throw new Error('Email body is required: provide html or text');
    }

    const msg: MailDataRequired = {
      from: input.from,
      to: input.to,
      subject: input.subject,
      html: body,
      headers: input.headers,
      categories: input.categories,
      customArgs: this.buildCustomArgs(input),
      ...(input.asmGroupId ? { asm: { groupId: input.asmGroupId } } : {}),
    };

    const [resp] = await sgMail.send(msg, false); // no built-in retry; you handle backoff in worker
    return this.extractProviderIds(resp);
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

    const response = await sgClient.request(request);
    return response;
  }

  async resendSenderVerification(id: string) {
    const request: ClientRequest = {
      url: `/v3/verified_senders/resend/${id}`,
      method: 'POST',
    };

    const response = await sgClient.request(request);
    return response;
  }

  async getVerifiedSender(id: string): Promise<{ statusCode: number; body: any; headers: any }> {
    const request: ClientRequest = {
      url: `/v3/verified_senders/${id}`,
      method: 'GET',
    };

    const [resp, body] = await sgClient.request(request);
    return { statusCode: resp.statusCode, body, headers: resp.headers };
  }

  async verifySenderWithToken(token: string): Promise<{ statusCode: number; body: any; headers: any }> {
    const postReq: ClientRequest = {
      url: `/v3/verified_senders/verify`,
      method: 'POST',
      body: { token },
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
      ...(input.outboundMessageId ? { outbound_message_id: input.outboundMessageId } : {}),
      ...(input.dedupeKey ? { dedupe_key: input.dedupeKey } : {}),
    } as Record<string, string>;
  }
}

export const sendgridClient = new SendgridClient();
