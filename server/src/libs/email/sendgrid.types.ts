export type SenderValidationVerdict = 'Valid' | 'Risky' | 'Invalid';

export type ProviderIds = {
  providerMessageId?: string; // X-Message-Id
  smtpIdHeader?: string; // X-SES-??? not used; keep for parity
  responseStatus: number;
  responseHeaders: Record<string, string | string[] | undefined>;
};

export type SendBase = {
  tenantId: string;
  campaignId: string;
  nodeId: string;
  outboundMessageId: string; // your DB id for outbound_messages
  dedupeKey: string; // ${tenant}:${contact}:${campaign}:${node}:${channel}
  from: { email: string; name?: string };
  to: string;
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  categories?: string[]; // e.g. ["outreach","tenant:<id>"]
  asmGroupId?: number; // per-tenant unsubscribe group
  reply_to?: string; // reply-to email address
};
