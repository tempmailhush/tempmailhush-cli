export class CliError extends Error {
  readonly code: string;
  readonly exitCode: number;
  readonly details?: unknown;

  constructor(code: string, message: string, exitCode = 1, details?: unknown) {
    super(message);
    this.name = "CliError";
    this.code = code;
    this.exitCode = exitCode;
    this.details = details;
  }
}

export class ApiError extends CliError {
  readonly status: number;
  readonly requestId?: string;

  constructor(status: number, code: string, message: string, requestId?: string, details?: unknown) {
    super(code, message, status === 401 ? 2 : 1, details);
    this.name = "ApiError";
    this.status = status;
    this.requestId = requestId;
  }
}

export function isCliError(error: unknown): error is CliError {
  return error instanceof CliError;
}
