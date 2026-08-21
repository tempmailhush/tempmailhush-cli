import { writeFile } from "node:fs/promises";
import type { Command } from "commander";
import { extractCode } from "../code-extraction.js";
import { writeJson, writePretty } from "../output.js";
import { clientFromOptions, globalOptions } from "./context.js";

export function registerMessage(program: Command): void {
  const message = program.command("message").description("Read and delete messages");

  message
    .command("get")
    .argument("<mailbox_id>")
    .argument("<message_id>")
    .description("Get a message")
    .action(async (mailboxId: string, messageId: string) => {
      const options = globalOptions(program);
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

  message
    .command("html")
    .argument("<mailbox_id>")
    .argument("<message_id>")
    .description("Get sanitized message HTML")
    .option("-o, --output <file>", "Write HTML to a file")
    .action(async (mailboxId: string, messageId: string, command: Command & { output?: string }) => {
      const options = globalOptions(program);
      const commandOptions = typeof command.opts === "function" ? command.opts<{ output?: string }>() : command;
      const html = await (await clientFromOptions(options)).getHtml(mailboxId, messageId);
      if (commandOptions.output) {
        if (commandOptions.output === "-") {
          process.stdout.write(html);
          return;
        }
        await writeFile(commandOptions.output, html);
        writeJson({ ok: true, output: commandOptions.output });
        return;
      }
      if (options.raw || options.pretty) {
        process.stdout.write(html);
        return;
      }
      writeJson({ mailboxId, messageId, html });
    });

  message
    .command("source")
    .argument("<mailbox_id>")
    .argument("<message_id>")
    .description("Get raw RFC822 message source")
    .option("-o, --output <file>", "Write source to a file")
    .action(async (mailboxId: string, messageId: string, command: Command & { output?: string }) => {
      const options = globalOptions(program);
      const commandOptions = typeof command.opts === "function" ? command.opts<{ output?: string }>() : command;
      const source = await (await clientFromOptions(options)).getSource(mailboxId, messageId);
      if (commandOptions.output) {
        if (commandOptions.output === "-") {
          process.stdout.write(source);
          return;
        }
        await writeFile(commandOptions.output, source);
        writeJson({ ok: true, output: commandOptions.output });
        return;
      }
      if (options.raw || options.pretty) {
        process.stdout.write(source);
        return;
      }
      writeJson({ mailboxId, messageId, source });
    });

  message
    .command("code")
    .argument("<mailbox_id>")
    .argument("<message_id>")
    .description("Extract a verification code from a message")
    .action(async (mailboxId: string, messageId: string) => {
      const options = globalOptions(program);
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

  message
    .command("delete")
    .argument("<mailbox_id>")
    .argument("<message_id>")
    .description("Delete a message")
    .action(async (mailboxId: string, messageId: string) => {
      const options = globalOptions(program);
      const data = await (await clientFromOptions(options)).deleteMessage(mailboxId, messageId);
      if (options.pretty) {
        writePretty([`Message deleted: ${messageId}`]);
        return;
      }
      writeJson(data);
    });
}
