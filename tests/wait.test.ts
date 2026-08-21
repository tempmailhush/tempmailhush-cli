import assert from "node:assert/strict";
import test from "node:test";
import { createAndWaitResult, waitForMessage } from "../src/wait.js";
import type { Mailbox, MessageSummary } from "../src/types.js";

const message: MessageSummary = {
  id: "msg",
  sender: "noreply@example.com",
  subject: "Code",
  textPreview: "123456",
  receivedAt: "2026-08-21T00:00:00.000Z",
  attachmentCount: 0,
  sizeBytes: 6
};

test("waitForMessage returns first message", async () => {
  const result = await waitForMessage({ listMessages: async () => [message] }, "mbx", {
    timeoutSeconds: 1,
    intervalSeconds: 1
  });

  assert.equal(result.status, "received");
  assert.equal(result.message.id, "msg");
});

test("createAndWaitResult preserves created mailbox on timeout", () => {
  const mailbox: Mailbox = {
    id: "mbx",
    address: "a@example.com",
    expiresAt: "2026-08-22T00:00:00.000Z"
  };

  const result = createAndWaitResult(mailbox, {
    status: "timeout",
    mailboxId: "mbx",
    timeoutSeconds: 120,
    elapsedSeconds: 120
  });

  assert.equal(result.status, "timeout");
  assert.equal(result.mailbox.id, "mbx");
});
