import type { Command } from "commander";
import { clearConfig, configPath, readStoredConfig, saveConfig } from "../config.js";
import { writeJson, writePretty } from "../output.js";
import type { GlobalOptions } from "../types.js";

export function registerAuth(program: Command): void {
  const auth = program.command("auth").description("Manage local API key configuration");

  auth
    .command("set")
    .argument("<api_key>")
    .description("Save an API key in the local config file")
    .action(async (apiKey: string) => {
      const config = await saveConfig({ apiKey });
      writeJson({ ok: true, configPath: configPath(), apiKeyPrefix: maskKey(config.apiKey) });
    });

  auth
    .command("show")
    .description("Show current local auth configuration")
    .action(async () => {
      const options = program.opts() as GlobalOptions;
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

  auth
    .command("clear")
    .description("Remove the local config file")
    .action(async () => {
      await clearConfig();
      writeJson({ ok: true, configPath: configPath() });
    });
}

function maskKey(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.length <= 12) return `${value.slice(0, 4)}...`;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}
