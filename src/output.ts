import { CliError } from "./errors.js";

export function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function writePretty(lines: string[]): void {
  process.stdout.write(`${lines.join("\n")}\n`);
}

export function writeError(error: CliError): void {
  process.stderr.write(`${JSON.stringify({
    error: error.code,
    message: error.message,
    ...(error instanceof Error && "status" in error ? { status: error.status } : {}),
    ...(error instanceof Error && "requestId" in error && error.requestId ? { requestId: error.requestId } : {}),
    ...(error.details === undefined ? {} : { details: error.details })
  }, null, 2)}\n`);
}
