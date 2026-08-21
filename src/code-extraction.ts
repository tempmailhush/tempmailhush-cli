import type { CodeExtraction, MessageDetail } from "./types.js";

const explicitCodePatterns = [
  /\b(?:code|otp|verification code|verify code|passcode|pin)\b[^A-Z0-9]{0,24}([A-Z0-9]{4,10})\b/gi,
  /\b([A-Z0-9]{4,10})\b[^A-Z0-9]{0,24}\b(?:code|otp|verification code|verify code|passcode|pin)\b/gi
];

const fallbackPattern = /\b(?=[A-Z0-9]*\d)[A-Z0-9]{4,10}\b/g;

export function extractCode(mailboxId: string, messageId: string, message: Pick<MessageDetail, "subject" | "textPreview" | "textBody">): CodeExtraction {
  const text = [message.subject, message.textPreview, message.textBody].filter(Boolean).join("\n");
  const candidates = unique([...explicitCandidates(text), ...fallbackCandidates(text)])
    .filter(containsDigit)
    .filter((candidate) => !looksLikeYear(candidate))
    .slice(0, 10);

  return {
    mailboxId,
    messageId,
    code: candidates[0] ?? null,
    candidates
  };
}

function explicitCandidates(text: string): string[] {
  return explicitCodePatterns.flatMap((pattern) => {
    pattern.lastIndex = 0;
    return Array.from(text.matchAll(pattern), (match) => normalizeCode(match[1]));
  });
}

function fallbackCandidates(text: string): string[] {
  fallbackPattern.lastIndex = 0;
  return Array.from(text.matchAll(fallbackPattern), (match) => normalizeCode(match[0]));
}

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function looksLikeYear(value: string): boolean {
  return /^(19|20)\d{2}$/.test(value);
}

function containsDigit(value: string): boolean {
  return /\d/.test(value);
}
