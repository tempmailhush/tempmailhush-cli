export type GlobalOptions = {
  apiKey?: string;
  baseUrl?: string;
  pretty?: boolean;
  raw?: boolean;
};

export type RuntimeConfig = {
  apiKey?: string;
  baseUrl: string;
};

export type Mailbox = {
  id: string;
  address: string;
  expiresAt: string;
  pollAfter?: number;
};

export type MessageSummary = {
  id: string;
  sender: string;
  senderName?: string;
  subject: string;
  textPreview: string;
  receivedAt: string;
  attachmentCount: number;
  sizeBytes: number;
  htmlUrl?: string;
};

export type MessageDetail = MessageSummary & {
  textBody: string;
};

export type Usage = {
  period: string;
  plan: string;
  limit: number;
  used: number;
  remaining: number;
};

export type RateLimit = {
  rateLimitPerMinute: number;
};

export type Domain = {
  domain: string;
};

export type Attachment = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
};

export type AttachmentBody = {
  mailboxId: string;
  messageId: string;
  attachmentId: string;
  filename?: string;
  contentType?: string;
  base64: string;
};

export type WaitResult =
  | {
      status: "received";
      mailboxId: string;
      message: MessageSummary;
      elapsedSeconds: number;
    }
  | {
      status: "timeout";
      mailboxId: string;
      timeoutSeconds: number;
      elapsedSeconds: number;
    };

export type CreateAndWaitResult =
  | {
      status: "received";
      mailbox: Mailbox;
      message: MessageSummary;
      elapsedSeconds: number;
    }
  | {
      status: "timeout";
      mailbox: Mailbox;
      timeoutSeconds: number;
      elapsedSeconds: number;
    };

export type CodeExtraction = {
  mailboxId: string;
  messageId: string;
  code: string | null;
  candidates: string[];
};
