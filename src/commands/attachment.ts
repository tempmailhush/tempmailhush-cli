import { writeFile } from "node:fs/promises";
import type { Command } from "commander";
import { writeJson, writePretty } from "../output.js";
import { clientFromOptions, globalOptions } from "./context.js";

export function registerAttachment(program: Command): void {
  const attachment = program.command("attachment").description("List and download message attachments");

  attachment
    .command("list")
    .argument("<mailbox_id>")
    .argument("<message_id>")
    .description("List message attachments")
    .action(async (mailboxId: string, messageId: string) => {
      const options = globalOptions(program);
      const attachments = await (await clientFromOptions(options)).listAttachments(mailboxId, messageId);
      if (options.pretty) {
        writePretty(attachments.length ? attachments.map((item) => `${item.id}\t${item.filename}\t${item.contentType}\t${item.sizeBytes} bytes`) : ["No attachments"]);
        return;
      }
      writeJson({ mailboxId, messageId, attachments });
    });

  attachment
    .command("get")
    .argument("<mailbox_id>")
    .argument("<message_id>")
    .argument("<attachment_id>")
    .description("Download an attachment")
    .option("-o, --output <file>", "Write attachment bytes to a file")
    .action(async (mailboxId: string, messageId: string, attachmentId: string, command: Command & { output?: string }) => {
      const options = globalOptions(program);
      const commandOptions = typeof command.opts === "function" ? command.opts<{ output?: string }>() : command;
      const data = await (await clientFromOptions(options)).getAttachment(mailboxId, messageId, attachmentId);

      if (commandOptions.output) {
        await writeFile(commandOptions.output, Buffer.from(data.base64, "base64"));
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
