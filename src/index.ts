#!/usr/bin/env node
import { Command } from "commander";
import { isCliError, CliError } from "./errors.js";
import { writeError } from "./output.js";
import { registerAttachment } from "./commands/attachment.js";
import { registerAuth } from "./commands/auth.js";
import { registerConfig } from "./commands/config.js";
import { registerDomains } from "./commands/domains.js";
import { registerMailbox } from "./commands/mailbox.js";
import { registerMessage } from "./commands/message.js";
import { registerUsage } from "./commands/usage.js";

const program = new Command();

program
  .name("tmh")
  .description("A free, open-source CLI tool for temporary email addresses, designed for use by AI agents.")
  .version("0.1.1")
  .option("--api-key <key>", "TempMailHush API key")
  .option("--base-url <url>", "TempMailHush API base URL")
  .option("--pretty", "Print human-readable output instead of JSON")
  .option("--raw", "Print raw body for HTML/source commands");

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

  const cliError = isCliError(error)
    ? error
    : new CliError("unexpected_error", error instanceof Error ? error.message : String(error));
  writeError(cliError);
  process.exit(cliError.exitCode);
}

function isCommanderExit(error: unknown): error is { exitCode: number } {
  return typeof error === "object" && error !== null && "code" in error && String(error.code).startsWith("commander.");
}
