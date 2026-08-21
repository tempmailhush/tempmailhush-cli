import type { TempMailHushClient } from "./client.js";
import type { CreateAndWaitResult, Mailbox, MessageSummary, WaitResult } from "./types.js";

type WaitOptions = {
  timeoutSeconds: number;
  intervalSeconds: number;
};

export async function waitForMessage(client: Pick<TempMailHushClient, "listMessages">, mailboxId: string, options: WaitOptions): Promise<WaitResult> {
  const started = Date.now();
  const deadline = started + options.timeoutSeconds * 1000;

  while (Date.now() <= deadline) {
    const messages = await client.listMessages(mailboxId);
    if (messages.length > 0) {
      return {
        status: "received",
        mailboxId,
        message: messages[0],
        elapsedSeconds: elapsedSeconds(started)
      };
    }
    await sleep(options.intervalSeconds * 1000);
  }

  return {
    status: "timeout",
    mailboxId,
    timeoutSeconds: options.timeoutSeconds,
    elapsedSeconds: elapsedSeconds(started)
  };
}

export function createAndWaitResult(mailbox: Mailbox, waitResult: WaitResult): CreateAndWaitResult {
  if (waitResult.status === "received") {
    return {
      status: "received",
      mailbox,
      message: waitResult.message,
      elapsedSeconds: waitResult.elapsedSeconds
    };
  }

  return {
    status: "timeout",
    mailbox,
    timeoutSeconds: waitResult.timeoutSeconds,
    elapsedSeconds: waitResult.elapsedSeconds
  };
}

export function firstMessage(messages: MessageSummary[]): MessageSummary | undefined {
  return messages[0];
}

function elapsedSeconds(started: number): number {
  return Math.round((Date.now() - started) / 1000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
