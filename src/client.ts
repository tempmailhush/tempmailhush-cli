import { ApiError } from "./errors.js";
import type { Attachment, AttachmentBody, Domain, Mailbox, MessageDetail, MessageSummary, RateLimit, RuntimeConfig, Usage } from "./types.js";

type RequestOptions = {
  method?: string;
  raw?: boolean;
};

export class TempMailHushClient {
  readonly baseUrl: string;
  readonly apiKey: string;

  constructor(config: RuntimeConfig & { apiKey: string }) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
  }

  createMailbox(): Promise<Mailbox> {
    return this.request("/api/v1/mailboxes", { method: "POST" });
  }

  getMailbox(mailboxId: string): Promise<Mailbox> {
    return this.request(`/api/v1/mailboxes/${encodeURIComponent(mailboxId)}`);
  }

  extendMailbox(mailboxId: string): Promise<Mailbox> {
    return this.request(`/api/v1/mailboxes/${encodeURIComponent(mailboxId)}/extend`, { method: "POST" });
  }

  switchMailbox(mailboxId: string): Promise<Mailbox> {
    return this.request(`/api/v1/mailboxes/${encodeURIComponent(mailboxId)}/switch`, { method: "POST" });
  }

  async deleteMailbox(mailboxId: string): Promise<{ deleted: true; id: string }> {
    await this.request(`/api/v1/mailboxes/${encodeURIComponent(mailboxId)}`, { method: "DELETE" });
    return { deleted: true, id: mailboxId };
  }

  async listMessages(mailboxId: string): Promise<MessageSummary[]> {
    const data = await this.request<{ messages: MessageSummary[] }>(`/api/v1/mailboxes/${encodeURIComponent(mailboxId)}/messages`);
    return data.messages;
  }

  getMessage(mailboxId: string, messageId: string): Promise<MessageDetail> {
    return this.request(`/api/v1/mailboxes/${encodeURIComponent(mailboxId)}/messages/${encodeURIComponent(messageId)}`);
  }

  async deleteMessage(mailboxId: string, messageId: string): Promise<{ deleted: true; mailboxId: string; messageId: string }> {
    await this.request(`/api/v1/mailboxes/${encodeURIComponent(mailboxId)}/messages/${encodeURIComponent(messageId)}`, { method: "DELETE" });
    return { deleted: true, mailboxId, messageId };
  }

  getHtml(mailboxId: string, messageId: string): Promise<string> {
    return this.request(`/api/v1/mailboxes/${encodeURIComponent(mailboxId)}/messages/${encodeURIComponent(messageId)}/html`, { raw: true });
  }

  getSource(mailboxId: string, messageId: string): Promise<string> {
    return this.request(`/api/v1/mailboxes/${encodeURIComponent(mailboxId)}/messages/${encodeURIComponent(messageId)}/source`, { raw: true });
  }

  async listAttachments(mailboxId: string, messageId: string): Promise<Attachment[]> {
    const data = await this.request<{ attachments: Attachment[] }>(`/api/v1/mailboxes/${encodeURIComponent(mailboxId)}/messages/${encodeURIComponent(messageId)}/attachments`);
    return data.attachments;
  }

  async getAttachment(mailboxId: string, messageId: string, attachmentId: string): Promise<AttachmentBody> {
    const response = await this.fetchResponse(`/api/v1/mailboxes/${encodeURIComponent(mailboxId)}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`);
    if (!response.ok) {
      throw await toApiError(response);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    return {
      mailboxId,
      messageId,
      attachmentId,
      filename: filenameFromContentDisposition(response.headers.get("Content-Disposition")),
      contentType: response.headers.get("Content-Type") || undefined,
      base64: bytes.toString("base64")
    };
  }

  async listDomains(): Promise<Domain[]> {
    const data = await this.request<{ domains: Domain[] }>("/api/v1/domains");
    return data.domains;
  }

  getUsage(): Promise<Usage> {
    return this.request("/api/v1/usage");
  }

  getRateLimit(): Promise<RateLimit> {
    return this.request("/api/v1/rate_limit");
  }

  private async request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    const response = await this.fetchResponse(path, options);

    if (!response.ok) {
      throw await toApiError(response);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    if (options.raw) {
      return (await response.text()) as T;
    }

    return (await response.json()) as T;
  }

  private fetchResponse(path: string, options: RequestOptions = {}): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      method: options.method || "GET",
      headers: {
        "X-API-Key": this.apiKey,
        "Accept": options.raw ? "*/*" : "application/json"
      }
    });
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const requestId = response.headers.get("X-Request-ID") || undefined;
  const retryAfter = response.headers.get("Retry-After") || undefined;
  const details: Record<string, unknown> = {};
  if (retryAfter) details.retryAfterSeconds = Number(retryAfter);

  try {
    const body = await response.json() as { error?: string; message?: string; requestId?: string };
    return new ApiError(
      response.status,
      body.error || `http_${response.status}`,
      body.message || response.statusText,
      body.requestId || requestId,
      Object.keys(details).length ? details : undefined
    );
  } catch {
    return new ApiError(response.status, `http_${response.status}`, response.statusText, requestId, Object.keys(details).length ? details : undefined);
  }
}

function filenameFromContentDisposition(value: string | null): string | undefined {
  if (!value) return undefined;
  const match = value.match(/filename="([^"]+)"/);
  return match?.[1];
}
