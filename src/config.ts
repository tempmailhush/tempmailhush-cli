import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { CliError } from "./errors.js";
import type { GlobalOptions, RuntimeConfig } from "./types.js";

type StoredConfig = {
  apiKey?: string;
  baseUrl?: string;
};

const defaultBaseUrl = "https://tempmailhush.com";

export function configPath(): string {
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "tempmailhush", "config.json");
}

export async function readStoredConfig(): Promise<StoredConfig> {
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

export async function resolveConfig(options: GlobalOptions = {}): Promise<RuntimeConfig> {
  const stored = await readStoredConfig();
  return {
    apiKey: options.apiKey || process.env.TEMPMAILHUSH_API_KEY || stored.apiKey,
    baseUrl: normalizeBaseUrl(options.baseUrl || process.env.TEMPMAILHUSH_BASE_URL || stored.baseUrl || defaultBaseUrl)
  };
}

export async function requireConfig(options: GlobalOptions = {}): Promise<RuntimeConfig & { apiKey: string }> {
  const config = await resolveConfig(options);
  if (!config.apiKey) {
    throw new CliError("missing_api_key", "API key is missing. Run: tmh auth set <api_key>", 2);
  }
  return { ...config, apiKey: config.apiKey };
}

export async function saveConfig(next: StoredConfig): Promise<StoredConfig> {
  const current = await readStoredConfig();
  const merged = { ...current, ...next };
  await mkdir(dirname(configPath()), { recursive: true });
  await writeFile(configPath(), `${JSON.stringify(merged, null, 2)}\n`, { mode: 0o600 });
  return merged;
}

export async function clearConfig(): Promise<void> {
  await rm(configPath(), { force: true });
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
