export type SenderValidationVerdict = 'Valid' | 'Risky' | 'Invalid';

export type ProviderIds = {
  providerMessageId?: string; // X-Message-Id
  smtpIdHeader?: string; // X-SES-??? not used; keep for parity
  responseStatus: number;
  responseHeaders: Record<string, string | string[] | undefined>;
};

export type EmailSendBase = {
  tenantId: string;
  campaignId: string;
  nodeId: string;
  outboundMessageId: string; // your DB id for outbound_messages
  dedupeKey: string; // ${tenant}:${contact}:${campaign}:${node}:${channel}
  from: string; // email address
  to: string; // email address
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  categories?: string[]; // e.g. ["outreach","tenant:<id>"]
  asmGroupId?: number; // per-tenant unsubscribe group
};
