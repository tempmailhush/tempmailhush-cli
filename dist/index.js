#!/usr/bin/env node

// src/index.ts
import { Command } from "commander";

// src/errors.ts
var CliError = class extends Error {
  code;
  exitCode;
  details;
  constructor(code, message, exitCode = 1, details) {
    super(message);
    this.name = "CliError";
    this.code = code;
    this.exitCode = exitCode;
    this.details = details;
  }
};
var ApiError = class extends CliError {
  status;
  requestId;
  constructor(status, code, message, requestId, details) {
    super(code, message, status === 401 ? 2 : 1, details);
    this.name = "ApiError";
    this.status = status;
    this.requestId = requestId;
  }
};
function isCliError(error) {
  return error instanceof CliError;
}

// src/output.ts
function writeJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}
`);
}
function writePretty(lines) {
  process.stdout.write(`${lines.join("\n")}
`);
}
function writeError(error) {
  process.stderr.write(`${JSON.stringify({
    error: error.code,
    message: error.message,
    ...error instanceof Error && "status" in error ? { status: error.status } : {},
    ...error instanceof Error && "requestId" in error && error.requestId ? { requestId: error.requestId } : {},
    ...error.details === void 0 ? {} : { details: error.details }
  }, null, 2)}
`);
}

// src/commands/attachment.ts
import { writeFile as writeFile2 } from "fs/promises";

// src/client.ts
var TempMailHushClient = class {
  baseUrl;
  apiKey;
  constructor(config) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
  }
  createMailbox() {
    return this.request("/api/v1/mailboxes", { method: "POST" });
  }
  getMailbox(mailboxId) {
    return this.request(`/api/v1/mailboxes/${encodeURIComponent(mailboxId)}`);
  }
  extendMailbox(mailboxId) {
    return this.request(`/api/v1/mailboxes/${encodeURIComponent(mailboxId)}/extend`, { method: "POST" });
  }
  switchMailbox(mailboxId) {
    return this.request(`/api/v1/mailboxes/${encodeURIComponent(mailboxId)}/switch`, { method: "POST" });
  }
  async deleteMailbox(mailboxId) {
    await this.request(`/api/v1/mailboxes/${encodeURIComponent(mailboxId)}`, { method: "DELETE" });
    return { deleted: true, id: mailboxId };
  }
  async listMessages(mailboxId) {
    const data = await this.request(`/api/v1/mailboxes/${encodeURIComponent(mailboxId)}/messages`);
    return data.messages;
  }
  getMessage(mailboxId, messageId) {
    return this.request(`/api/v1/mailboxes/${encodeURIComponent(mailboxId)}/messages/${encodeURIComponent(messageId)}`);
  }
  async deleteMessage(mailboxId, messageId) {
    await this.request(`/api/v1/mailboxes/${encodeURIComponent(mailboxId)}/messages/${encodeURIComponent(messageId)}`, { method: "DELETE" });
    return { deleted: true, mailboxId, messageId };
  }
  getHtml(mailboxId, messageId) {
    return this.request(`/api/v1/mailboxes/${encodeURIComponent(mailboxId)}/messages/${encodeURIComponent(messageId)}/html`, { raw: true });
  }
  getSource(mailboxId, messageId) {
    return this.request(`/api/v1/mailboxes/${encodeURIComponent(mailboxId)}/messages/${encodeURIComponent(messageId)}/source`, { raw: true });
  }
  async listAttachments(mailboxId, messageId) {
    const data = await this.request(`/api/v1/mailboxes/${encodeURIComponent(mailboxId)}/messages/${encodeURIComponent(messageId)}/attachments`);
    return data.attachments;
  }
  async getAttachment(mailboxId, messageId, attachmentId) {
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
      contentType: response.headers.get("Content-Type") || void 0,
      base64: bytes.toString("base64")
    };
  }
  async listDomains() {
    const data = await this.request("/api/v1/domains");
    return data.domains;
  }
  getUsage() {
    return this.request("/api/v1/usage");
  }
  getRateLimit() {
    return this.request("/api/v1/rate_limit");
  }
  async request(path, options = {}) {
    const response = await this.fetchResponse(path, options);
    if (!response.ok) {
      throw await toApiError(response);
    }
    if (response.status === 204) {
      return void 0;
    }
    if (options.raw) {
      return await response.text();
    }
    return await response.json();
  }
  fetchResponse(path, options = {}) {
    return fetch(`${this.baseUrl}${path}`, {
      method: options.method || "GET",
      headers: {
        "X-API-Key": this.apiKey,
        "Accept": options.raw ? "*/*" : "application/json"
      }
    });
  }
};
async function toApiError(response) {
  const requestId = response.headers.get("X-Request-ID") || void 0;
  const retryAfter = response.headers.get("Retry-After") || void 0;
  const details = {};
  if (retryAfter) details.retryAfterSeconds = Number(retryAfter);
  try {
    const body = await response.json();
    return new ApiError(
      response.status,
      body.error || `http_${response.status}`,
      body.message || response.statusText,
      body.requestId || requestId,
      Object.keys(details).length ? details : void 0
    );
  } catch {
    return new ApiError(response.status, `http_${response.status}`, response.statusText, requestId, Object.keys(details).length ? details : void 0);
  }
}
function filenameFromContentDisposition(value) {
  if (!value) return void 0;
  const match = value.match(/filename="([^"]+)"/);
  return match?.[1];
}

// src/config.ts
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { homedir } from "os";
var defaultBaseUrl = "https://tempmailhush.com";
function configPath() {
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "tempmailhush", "config.json");
}
async function readStoredConfig() {
  try {
    const raw = await readFile(configPath(), "utf8");
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch (error) {
    if (isNotFound(error)) return {};
    if (error instanceof SyntaxError) {
      throw new CliError("invalid_config", `Invalid JSON in config file: ${configPath()}`);
    }
    throw error;
  }
}
async function resolveConfig(options = {}) {
  const stored = await readStoredConfig();
  return {
    apiKey: options.apiKey || process.env.TEMPMAILHUSH_API_KEY || stored.apiKey,
    baseUrl: normalizeBaseUrl(options.baseUrl || process.env.TEMPMAILHUSH_BASE_URL || stored.baseUrl || defaultBaseUrl)
  };
}
async function requireConfig(options = {}) {
  const config = await resolveConfig(options);
  if (!config.apiKey) {
    throw new CliError("missing_api_key", "API key is missing. Run: tmh auth set <api_key>", 2);
  }
  return { ...config, apiKey: config.apiKey };
}
async function saveConfig(next) {
  const current = await readStoredConfig();
  const merged = { ...current, ...next };
  await mkdir(dirname(configPath()), { recursive: true });
  await writeFile(configPath(), `${JSON.stringify(merged, null, 2)}
`, { mode: 384 });
  return merged;
}
async function clearConfig() {
  await rm(configPath(), { force: true });
}
function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}
function isNotFound(error) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

// src/commands/context.ts
async function clientFromOptions(options) {
  return new TempMailHushClient(await requireConfig(options));
}
function globalOptions(command) {
  return command.opts();
}

// src/commands/attachment.ts
function registerAttachment(program2) {
  const attachment = program2.command("attachment").description("List and download message attachments");
  attachment.command("list").argument("<mailbox_id>").argument("<message_id>").description("List message attachments").action(async (mailboxId, messageId) => {
    const options = globalOptions(program2);
    const attachments = await (await clientFromOptions(options)).listAttachments(mailboxId, messageId);
    if (options.pretty) {
      writePretty(attachments.length ? attachments.map((item) => `${item.id}	${item.filename}	${item.contentType}	${item.sizeBytes} bytes`) : ["No attachments"]);
      return;
    }
    writeJson({ mailboxId, messageId, attachments });
  });
  attachment.command("get").argument("<mailbox_id>").argument("<message_id>").argument("<attachment_id>").description("Download an attachment").option("-o, --output <file>", "Write attachment bytes to a file").action(async (mailboxId, messageId, attachmentId, command) => {
    const options = globalOptions(program2);
    const commandOptions = typeof command.opts === "function" ? command.opts() : command;
    const data = await (await clientFromOptions(options)).getAttachment(mailboxId, messageId, attachmentId);
    if (commandOptions.output) {
      await writeFile2(commandOptions.output, Buffer.from(data.base64, "base64"));
      writeJson({ ok: true, output: commandOptions.output, filename: data.filename, contentType: data.contentType });
      return;
    }
    if (options.pretty) {
      writePretty([
        `Attachment: ${data.attachmentId}`,
        `Filename: ${data.filename || "(unknown)"}`,
        `Content-Type: ${data.contentType || "(unknown)"}`,
        "Use --output <file> to write attachment bytes."
      ]);
      return;
    }
    writeJson(data);
  });
}

// src/commands/auth.ts
function registerAuth(program2) {
  const auth = program2.command("auth").description("Manage local API key configuration");
  auth.command("set").argument("<api_key>").description("Save an API key in the local config file").action(async (apiKey) => {
    const config = await saveConfig({ apiKey });
    writeJson({ ok: true, configPath: configPath(), apiKeyPrefix: maskKey(config.apiKey) });
  });
  auth.command("show").description("Show current local auth configuration").action(async () => {
    const options = program2.opts();
    const config = await readStoredConfig();
    if (options.pretty) {
      writePretty([
        `Config: ${configPath()}`,
        `API key: ${maskKey(options.apiKey || process.env.TEMPMAILHUSH_API_KEY || config.apiKey) || "(not set)"}`,
        `Base URL: ${options.baseUrl || process.env.TEMPMAILHUSH_BASE_URL || config.baseUrl || "https://tempmailhush.com"}`
      ]);
      return;
    }
    writeJson({
      configPath: configPath(),
      apiKeyPrefix: maskKey(options.apiKey || process.env.TEMPMAILHUSH_API_KEY || config.apiKey),
      baseUrl: options.baseUrl || process.env.TEMPMAILHUSH_BASE_URL || config.baseUrl || "https://tempmailhush.com"
    });
  });
  auth.command("clear").description("Remove the local config file").action(async () => {
    await clearConfig();
    writeJson({ ok: true, configPath: configPath() });
  });
}
function maskKey(value) {
  if (!value) return void 0;
  if (value.length <= 12) return `${value.slice(0, 4)}...`;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

// src/commands/config.ts
function registerConfig(program2) {
  const config = program2.command("config").description("Manage local CLI configuration");
  config.command("show").description("Show resolved and stored configuration").action(async () => {
    const options = program2.opts();
    const stored = await readStoredConfig();
    const resolved = {
      apiKeyPrefix: maskKey2(options.apiKey || process.env.TEMPMAILHUSH_API_KEY || stored.apiKey),
      baseUrl: options.baseUrl || process.env.TEMPMAILHUSH_BASE_URL || stored.baseUrl || "https://tempmailhush.com"
    };
    if (options.pretty) {
      writePretty([
        `Config: ${configPath()}`,
        `API key: ${resolved.apiKeyPrefix || "(not set)"}`,
        `Base URL: ${resolved.baseUrl}`
      ]);
      return;
    }
    writeJson({
      configPath: configPath(),
      stored: {
        apiKeyPrefix: maskKey2(stored.apiKey),
        baseUrl: stored.baseUrl
      },
      resolved
    });
  });
  config.command("set").argument("<key>", "Config key: api-key or base-url").argument("<value>").description("Set a local config value").action(async (key, value) => {
    const normalized = normalizeKey(key);
    const saved = await saveConfig(normalized === "apiKey" ? { apiKey: value } : { baseUrl: value });
    writeJson({
      ok: true,
      configPath: configPath(),
      config: {
        apiKeyPrefix: maskKey2(saved.apiKey),
        baseUrl: saved.baseUrl
      }
    });
  });
  config.command("clear").description("Remove the local config file").action(async () => {
    await clearConfig();
    writeJson({ ok: true, configPath: configPath() });
  });
}
function normalizeKey(key) {
  if (key === "api-key" || key === "apiKey") return "apiKey";
  if (key === "base-url" || key === "baseUrl") return "baseUrl";
  throw new CliError("invalid_config_key", `Unsupported config key: ${key}. Use api-key or base-url.`);
}
function maskKey2(value) {
  if (!value) return void 0;
  if (value.length <= 12) return `${value.slice(0, 4)}...`;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

// src/commands/domains.ts
function registerDomains(program2) {
  program2.command("domains").description("List available TempMailHush domains").action(async () => {
    const options = globalOptions(program2);
    const domains = await (await clientFromOptions(options)).listDomains();
    if (options.pretty) {
      writePretty(domains.map((item) => item.domain));
      return;
    }
    writeJson({ domains });
  });
}

// src/wait.ts
async function waitForMessage(client, mailboxId, options) {
  const started = Date.now();
  const deadline = started + options.timeoutSeconds * 1e3;
  while (Date.now() <= deadline) {
    const messages = await client.listMessages(mailboxId);
    if (messages.length > 0) {
      return {
        status: "received",
        mailboxId,
        message: messages[0],
        elapsedSeconds: elapsedSeconds(started)
      };
    }
    await sleep(options.intervalSeconds * 1e3);
  }
  return {
    status: "timeout",
    mailboxId,
    timeoutSeconds: options.timeoutSeconds,
    elapsedSeconds: elapsedSeconds(started)
  };
}
function createAndWaitResult(mailbox, waitResult) {
  if (waitResult.status === "received") {
    return {
      status: "received",
      mailbox,
      message: waitResult.message,
      elapsedSeconds: waitResult.elapsedSeconds
    };
  }
  return {
    status: "timeout",
    mailbox,
    timeoutSeconds: waitResult.timeoutSeconds,
    elapsedSeconds: waitResult.elapsedSeconds
  };
}
function elapsedSeconds(started) {
  return Math.round((Date.now() - started) / 1e3);
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// src/commands/mailbox.ts
function registerMailbox(program2) {
  const mailbox = program2.command("mailbox").description("Create and manage mailboxes");
  mailbox.command("create").description("Create a mailbox").action(async () => {
    const options = globalOptions(program2);
    const data = await (await clientFromOptions(options)).createMailbox();
    outputMailbox(data, options.pretty, "Mailbox created");
  });
  mailbox.command("new").description("Create a mailbox and include useful follow-up commands").action(async () => {
    const options = globalOptions(program2);
    const data = await (await clientFromOptions(options)).createMailbox();
    const result = {
      mailbox: data,
      commands: {
        wait: `tmh mailbox wait ${data.id}`,
        messages: `tmh mailbox messages ${data.id}`,
        delete: `tmh mailbox delete ${data.id}`
      }
    };
    if (options.pretty) {
      writePretty([
        "Mailbox created",
        `ID: ${data.id}`,
        `Address: ${data.address}`,
        `Wait: ${result.commands.wait}`
      ]);
      return;
    }
    writeJson(result);
  });
  mailbox.command("create-and-wait").description("Create a mailbox and wait for its first message").option("--timeout <seconds>", "Timeout in seconds", parsePositiveInt, 120).option("--interval <seconds>", "Polling interval in seconds", parsePositiveInt, 5).action(async (command) => {
    const options = globalOptions(program2);
    const commandOptions = typeof command.opts === "function" ? command.opts() : command;
    const timeout = commandOptions.timeout ?? 120;
    const interval = commandOptions.interval ?? 5;
    const client = await clientFromOptions(options);
    const mailboxData = await client.createMailbox();
    const waitResult = await waitForMessage(client, mailboxData.id, { timeoutSeconds: timeout, intervalSeconds: interval });
    const result = createAndWaitResult(mailboxData, waitResult);
    outputCreateAndWaitResult(result, options.pretty);
    if (result.status === "timeout") {
      process.exitCode = 3;
    }
  });
  mailbox.command("get").argument("<mailbox_id>").description("Get a mailbox").action(async (mailboxId) => {
    const options = globalOptions(program2);
    const data = await (await clientFromOptions(options)).getMailbox(mailboxId);
    outputMailbox(data, options.pretty, "Mailbox");
  });
  mailbox.command("extend").argument("<mailbox_id>").description("Extend a mailbox").action(async (mailboxId) => {
    const options = globalOptions(program2);
    const data = await (await clientFromOptions(options)).extendMailbox(mailboxId);
    outputMailbox(data, options.pretty, "Mailbox extended");
  });
  mailbox.command("switch").argument("<mailbox_id>").description("Switch to a new mailbox and delete the old one").action(async (mailboxId) => {
    const options = globalOptions(program2);
    const data = await (await clientFromOptions(options)).switchMailbox(mailboxId);
    outputMailbox(data, options.pretty, "Mailbox switched");
  });
  mailbox.command("delete").argument("<mailbox_id>").description("Delete a mailbox").action(async (mailboxId) => {
    const options = globalOptions(program2);
    const data = await (await clientFromOptions(options)).deleteMailbox(mailboxId);
    if (options.pretty) {
      writePretty([`Mailbox deleted: ${mailboxId}`]);
      return;
    }
    writeJson(data);
  });
  mailbox.command("messages").argument("<mailbox_id>").description("List mailbox messages").action(async (mailboxId) => {
    const options = globalOptions(program2);
    const messages = await (await clientFromOptions(options)).listMessages(mailboxId);
    if (options.pretty) {
      writePretty(messages.length ? messages.map(formatMessageSummary) : ["No messages"]);
      return;
    }
    writeJson({ mailboxId, messages });
  });
  mailbox.command("wait").argument("<mailbox_id>").description("Poll until the mailbox receives a message or times out").option("--timeout <seconds>", "Timeout in seconds", parsePositiveInt, 120).option("--interval <seconds>", "Polling interval in seconds", parsePositiveInt, 5).action(async (mailboxId, command) => {
    const options = globalOptions(program2);
    const commandOptions = typeof command.opts === "function" ? command.opts() : command;
    const timeout = commandOptions.timeout ?? 120;
    const interval = commandOptions.interval ?? 5;
    const client = await clientFromOptions(options);
    const result = await waitForMessage(client, mailboxId, { timeoutSeconds: timeout, intervalSeconds: interval });
    outputWaitResult(result, options.pretty);
    if (result.status === "timeout") {
      process.exitCode = 3;
    }
  });
}
function outputMailbox(mailbox, pretty, title) {
  if (!pretty) {
    writeJson(mailbox);
    return;
  }
  writePretty([
    title,
    `ID: ${mailbox.id}`,
    `Address: ${mailbox.address}`,
    `Expires: ${mailbox.expiresAt}`,
    ...mailbox.pollAfter === void 0 ? [] : [`Poll after: ${mailbox.pollAfter}ms`]
  ]);
}
function outputWaitResult(result, pretty) {
  if (!pretty) {
    writeJson(result);
    return;
  }
  if (result.status === "timeout") {
    writePretty([`Timeout after ${result.timeoutSeconds}s`, `Mailbox: ${result.mailboxId}`]);
    return;
  }
  writePretty(["Message received", formatMessageSummary(result.message)]);
}
function outputCreateAndWaitResult(result, pretty) {
  if (!pretty) {
    writeJson(result);
    return;
  }
  if (result.status === "timeout") {
    writePretty([
      "Mailbox created, timed out waiting for message",
      `ID: ${result.mailbox.id}`,
      `Address: ${result.mailbox.address}`,
      `Timeout: ${result.timeoutSeconds}s`
    ]);
    return;
  }
  writePretty([
    "Mailbox created and message received",
    `ID: ${result.mailbox.id}`,
    `Address: ${result.mailbox.address}`,
    "",
    formatMessageSummary(result.message)
  ]);
}
function formatMessageSummary(message) {
  return [
    `ID: ${message.id}`,
    `From: ${message.senderName ? `${message.senderName} <${message.sender}>` : message.sender}`,
    `Subject: ${message.subject}`,
    `Received: ${message.receivedAt}`,
    `Preview: ${message.textPreview}`
  ].join("\n");
}
function parsePositiveInt(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new CliError("invalid_option", `Expected a positive integer, got: ${value}`);
  }
  return parsed;
}

// src/commands/message.ts
import { writeFile as writeFile3 } from "fs/promises";

// src/code-extraction.ts
var explicitCodePatterns = [
  /\b(?:code|otp|verification code|verify code|passcode|pin)\b[^A-Z0-9]{0,24}([A-Z0-9]{4,10})\b/gi,
  /\b([A-Z0-9]{4,10})\b[^A-Z0-9]{0,24}\b(?:code|otp|verification code|verify code|passcode|pin)\b/gi
];
var fallbackPattern = /\b(?=[A-Z0-9]*\d)[A-Z0-9]{4,10}\b/g;
function extractCode(mailboxId, messageId, message) {
  const text = [message.subject, message.textPreview, message.textBody].filter(Boolean).join("\n");
  const candidates = unique([...explicitCandidates(text), ...fallbackCandidates(text)]).filter(containsDigit).filter((candidate) => !looksLikeYear(candidate)).slice(0, 10);
  return {
    mailboxId,
    messageId,
    code: candidates[0] ?? null,
    candidates
  };
}
function explicitCandidates(text) {
  return explicitCodePatterns.flatMap((pattern) => {
    pattern.lastIndex = 0;
    return Array.from(text.matchAll(pattern), (match) => normalizeCode(match[1]));
  });
}
function fallbackCandidates(text) {
  fallbackPattern.lastIndex = 0;
  return Array.from(text.matchAll(fallbackPattern), (match) => normalizeCode(match[0]));
}
function normalizeCode(value) {
  return value.trim().toUpperCase();
}
function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}
function looksLikeYear(value) {
  return /^(19|20)\d{2}$/.test(value);
}
function containsDigit(value) {
  return /\d/.test(value);
}

// src/commands/message.ts
function registerMessage(program2) {
  const message = program2.command("message").description("Read and delete messages");
  message.command("get").argument("<mailbox_id>").argument("<message_id>").description("Get a message").action(async (mailboxId, messageId) => {
    const options = globalOptions(program2);
    const data = await (await clientFromOptions(options)).getMessage(mailboxId, messageId);
    if (options.pretty) {
      writePretty([
        `ID: ${data.id}`,
        `From: ${data.senderName ? `${data.senderName} <${data.sender}>` : data.sender}`,
        `Subject: ${data.subject}`,
        `Received: ${data.receivedAt}`,
        "",
        data.textBody || data.textPreview
      ]);
      return;
    }
    writeJson(data);
  });
  message.command("html").argument("<mailbox_id>").argument("<message_id>").description("Get sanitized message HTML").option("-o, --output <file>", "Write HTML to a file").action(async (mailboxId, messageId, command) => {
    const options = globalOptions(program2);
    const commandOptions = typeof command.opts === "function" ? command.opts() : command;
    const html = await (await clientFromOptions(options)).getHtml(mailboxId, messageId);
    if (commandOptions.output) {
      if (commandOptions.output === "-") {
        process.stdout.write(html);
        return;
      }
      await writeFile3(commandOptions.output, html);
      writeJson({ ok: true, output: commandOptions.output });
      return;
    }
    if (options.raw || options.pretty) {
      process.stdout.write(html);
      return;
    }
    writeJson({ mailboxId, messageId, html });
  });
  message.command("source").argument("<mailbox_id>").argument("<message_id>").description("Get raw RFC822 message source").option("-o, --output <file>", "Write source to a file").action(async (mailboxId, messageId, command) => {
    const options = globalOptions(program2);
    const commandOptions = typeof command.opts === "function" ? command.opts() : command;
    const source = await (await clientFromOptions(options)).getSource(mailboxId, messageId);
    if (commandOptions.output) {
      if (commandOptions.output === "-") {
        process.stdout.write(source);
        return;
      }
      await writeFile3(commandOptions.output, source);
      writeJson({ ok: true, output: commandOptions.output });
      return;
    }
    if (options.raw || options.pretty) {
      process.stdout.write(source);
      return;
    }
    writeJson({ mailboxId, messageId, source });
  });
  message.command("code").argument("<mailbox_id>").argument("<message_id>").description("Extract a verification code from a message").action(async (mailboxId, messageId) => {
    const options = globalOptions(program2);
    const data = await (await clientFromOptions(options)).getMessage(mailboxId, messageId);
    const result = extractCode(mailboxId, messageId, data);
    if (options.pretty) {
      writePretty([
        `Code: ${result.code || "(not found)"}`,
        `Candidates: ${result.candidates.join(", ") || "(none)"}`
      ]);
      return;
    }
    writeJson(result);
    if (!result.code) {
      process.exitCode = 4;
    }
  });
  message.command("delete").argument("<mailbox_id>").argument("<message_id>").description("Delete a message").action(async (mailboxId, messageId) => {
    const options = globalOptions(program2);
    const data = await (await clientFromOptions(options)).deleteMessage(mailboxId, messageId);
    if (options.pretty) {
      writePretty([`Message deleted: ${messageId}`]);
      return;
    }
    writeJson(data);
  });
}

// src/commands/usage.ts
function registerUsage(program2) {
  program2.command("usage").description("Show monthly API usage").action(async () => {
    const options = globalOptions(program2);
    const usage = await (await clientFromOptions(options)).getUsage();
    if (options.pretty) {
      writePretty([
        `Period: ${usage.period}`,
        `Plan: ${usage.plan}`,
        `Used: ${usage.used}`,
        `Limit: ${usage.limit}`,
        `Remaining: ${usage.remaining}`
      ]);
      return;
    }
    writeJson(usage);
  });
  program2.command("rate-limit").alias("rate_limit").description("Show per-minute API rate limit").action(async () => {
    const options = globalOptions(program2);
    const rateLimit = await (await clientFromOptions(options)).getRateLimit();
    if (options.pretty) {
      writePretty([`Rate limit: ${rateLimit.rateLimitPerMinute} requests/minute`]);
      return;
    }
    writeJson(rateLimit);
  });
}

// src/index.ts
var program = new Command();
program.name("tmh").description("AI-agent friendly CLI for TempMailHush Premium API").version("0.1.0").option("--api-key <key>", "TempMailHush API key").option("--base-url <url>", "TempMailHush API base URL").option("--pretty", "Print human-readable output instead of JSON").option("--raw", "Print raw body for HTML/source commands");
registerAuth(program);
registerAttachment(program);
registerConfig(program);
registerDomains(program);
registerMailbox(program);
registerMessage(program);
registerUsage(program);
program.exitOverride();
try {
  await program.parseAsync(process.argv);
} catch (error) {
  if (isCommanderExit(error)) {
    process.exit(error.exitCode);
  }
  const cliError = isCliError(error) ? error : new CliError("unexpected_error", error instanceof Error ? error.message : String(error));
  writeError(cliError);
  process.exit(cliError.exitCode);
}
function isCommanderExit(error) {
  return typeof error === "object" && error !== null && "code" in error && String(error.code).startsWith("commander.");
}
