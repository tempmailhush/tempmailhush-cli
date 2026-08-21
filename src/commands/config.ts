import type { Command } from "commander";
import { clearConfig, configPath, readStoredConfig, saveConfig } from "../config.js";
import { CliError } from "../errors.js";
import { writeJson, writePretty } from "../output.js";
import type { GlobalOptions } from "../types.js";

export function registerConfig(program: Command): void {
  const config = program.command("config").description("Manage local CLI configuration");

  config
    .command("show")
    .description("Show resolved and stored configuration")
    .action(async () => {
      const options = program.opts() as GlobalOptions;
      const stored = await readStoredConfig();
      const resolved = {
        apiKeyPrefix: maskKey(options.apiKey || process.env.TEMPMAILHUSH_API_KEY || stored.apiKey),
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
          apiKeyPrefix: maskKey(stored.apiKey),
          baseUrl: stored.baseUrl
        },
        resolved
      });
    });

  config
    .command("set")
    .argument("<key>", "Config key: api-key or base-url")
    .argument("<value>")
    .description("Set a local config value")
    .action(async (key: string, value: string) => {
      const normalized = normalizeKey(key);
      const saved = await saveConfig(normalized === "apiKey" ? { apiKey: value } : { baseUrl: value });
      writeJson({
        ok: true,
        configPath: configPath(),
        config: {
          apiKeyPrefix: maskKey(saved.apiKey),
          baseUrl: saved.baseUrl
        }
      });
    });

  config
    .command("clear")
    .description("Remove the local config file")
    .action(async () => {
      await clearConfig();
      writeJson({ ok: true, configPath: configPath() });
    });
}

function normalizeKey(key: string): "apiKey" | "baseUrl" {
  if (key === "api-key" || key === "apiKey") return "apiKey";
  if (key === "base-url" || key === "baseUrl") return "baseUrl";
  throw new CliError("invalid_config_key", `Unsupported config key: ${key}. Use api-key or base-url.`);
}

function maskKey(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.length <= 12) return `${value.slice(0, 4)}...`;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}
