import type { Command } from "commander";
import { CliError } from "../errors.js";
import { writeJson, writePretty } from "../output.js";
import type { CreateAndWaitResult, Mailbox, MessageSummary, WaitResult } from "../types.js";
import { createAndWaitResult, waitForMessage } from "../wait.js";
import { clientFromOptions, globalOptions } from "./context.js";

export function registerMailbox(program: Command): void {
  const mailbox = program.command("mailbox").description("Create and manage mailboxes");

  mailbox
    .command("create")
    .description("Create a mailbox")
    .action(async () => {
      const options = globalOptions(program);
      const data = await (await clientFromOptions(options)).createMailbox();
      outputMailbox(data, options.pretty, "Mailbox created");
    });

  mailbox
    .command("new")
    .description("Create a mailbox and include useful follow-up commands")
    .action(async () => {
      const options = globalOptions(program);
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

  mailbox
    .command("create-and-wait")
    .description("Create a mailbox and wait for its first message")
    .option("--timeout <seconds>", "Timeout in seconds", parsePositiveInt, 120)
    .option("--interval <seconds>", "Polling interval in seconds", parsePositiveInt, 5)
    .action(async (command: Command & { timeout?: number; interval?: number }) => {
      const options = globalOptions(program);
      const commandOptions = typeof command.opts === "function" ? command.opts<{ timeout?: number; interval?: number }>() : command;
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

  mailbox
    .command("get")
    .argument("<mailbox_id>")
    .description("Get a mailbox")
    .action(async (mailboxId: string) => {
      const options = globalOptions(program);
      const data = await (await clientFromOptions(options)).getMailbox(mailboxId);
      outputMailbox(data, options.pretty, "Mailbox");
    });

  mailbox
    .command("extend")
    .argument("<mailbox_id>")
    .description("Extend a mailbox")
    .action(async (mailboxId: string) => {
      const options = globalOptions(program);
      const data = await (await clientFromOptions(options)).extendMailbox(mailboxId);
      outputMailbox(data, options.pretty, "Mailbox extended");
    });

  mailbox
    .command("switch")
    .argument("<mailbox_id>")
    .description("Switch to a new mailbox and delete the old one")
    .action(async (mailboxId: string) => {
      const options = globalOptions(program);
      const data = await (await clientFromOptions(options)).switchMailbox(mailboxId);
      outputMailbox(data, options.pretty, "Mailbox switched");
    });

  mailbox
    .command("delete")
    .argument("<mailbox_id>")
    .description("Delete a mailbox")
    .action(async (mailboxId: string) => {
      const options = globalOptions(program);
      const data = await (await clientFromOptions(options)).deleteMailbox(mailboxId);
      if (options.pretty) {
        writePretty([`Mailbox deleted: ${mailboxId}`]);
        return;
      }
      writeJson(data);
    });

  mailbox
    .command("messages")
    .argument("<mailbox_id>")
    .description("List mailbox messages")
    .action(async (mailboxId: string) => {
      const options = globalOptions(program);
      const messages = await (await clientFromOptions(options)).listMessages(mailboxId);
      if (options.pretty) {
        writePretty(messages.length ? messages.map(formatMessageSummary) : ["No messages"]);
        return;
      }
      writeJson({ mailboxId, messages });
    });

  mailbox
    .command("wait")
    .argument("<mailbox_id>")
    .description("Poll until the mailbox receives a message or times out")
    .option("--timeout <seconds>", "Timeout in seconds", parsePositiveInt, 120)
    .option("--interval <seconds>", "Polling interval in seconds", parsePositiveInt, 5)
    .action(async (mailboxId: string, command: Command & { timeout?: number; interval?: number }) => {
      const options = globalOptions(program);
      const commandOptions = typeof command.opts === "function" ? command.opts<{ timeout?: number; interval?: number }>() : command;
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

function outputMailbox(mailbox: Mailbox, pretty: boolean | undefined, title: string): void {
  if (!pretty) {
    writeJson(mailbox);
    return;
  }
  writePretty([
    title,
    `ID: ${mailbox.id}`,
    `Address: ${mailbox.address}`,
    `Expires: ${mailbox.expiresAt}`,
    ...(mailbox.pollAfter === undefined ? [] : [`Poll after: ${mailbox.pollAfter}ms`])
  ]);
}

function outputWaitResult(result: WaitResult, pretty: boolean | undefined): void {
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

function outputCreateAndWaitResult(result: CreateAndWaitResult, pretty: boolean | undefined): void {
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

function formatMessageSummary(message: MessageSummary): string {
  return [
    `ID: ${message.id}`,
    `From: ${message.senderName ? `${message.senderName} <${message.sender}>` : message.sender}`,
    `Subject: ${message.subject}`,
    `Received: ${message.receivedAt}`,
    `Preview: ${message.textPreview}`
  ].join("\n");
}

function parsePositiveInt(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new CliError("invalid_option", `Expected a positive integer, got: ${value}`);
  }
  return parsed;
}
