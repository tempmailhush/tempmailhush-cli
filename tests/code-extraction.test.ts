import assert from "node:assert/strict";
import test from "node:test";
import { extractCode } from "../src/code-extraction.js";

test("extractCode prefers explicit verification code", () => {
  const result = extractCode("mbx", "msg", {
    subject: "Verify your account",
    textPreview: "Your verification code is 493821.",
    textBody: "Use verification code 493821 to continue. Ignore 2026."
  });

  assert.equal(result.code, "493821");
  assert.deepEqual(result.candidates.slice(0, 1), ["493821"]);
});

test("extractCode supports alphanumeric codes", () => {
  const result = extractCode("mbx", "msg", {
    subject: "Login PIN",
    textPreview: "OTP: AB12CD",
    textBody: "Your OTP: AB12CD"
  });

  assert.equal(result.code, "AB12CD");
});

test("extractCode returns null when no candidate exists", () => {
  const result = extractCode("mbx", "msg", {
    subject: "Hello",
    textPreview: "No code here",
    textBody: "Welcome to the service."
  });

  assert.equal(result.code, null);
  assert.deepEqual(result.candidates, []);
});
