import type { Command } from "commander";
import { TempMailHushClient } from "../client.js";
import { requireConfig } from "../config.js";
import type { GlobalOptions } from "../types.js";

export async function clientFromOptions(options: GlobalOptions): Promise<TempMailHushClient> {
  return new TempMailHushClient(await requireConfig(options));
}

export function globalOptions(command: Command): GlobalOptions {
  return command.opts() as GlobalOptions;
}
