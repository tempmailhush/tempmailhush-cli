# tempmailhush-cli

Free, open-source, AI Agent-friendly temporary email CLI for TempMailHush. Learn more at https://tempmailhush.com.

Use it for automated email testing, verification code receiving, registration flow testing, CI/CD checks, one-time inboxes for crawlers or data collection, and privacy protection. The CLI is automation-first: stdout is JSON by default, errors are JSON on stderr, and exit codes are meaningful for agents, CI, and shell scripts.

## Quick Start

### Persistent Install

```bash
npm install -g tempmailhush
export TEMPMAILHUSH_API_KEY=sk-xxx
tmh mailbox create
```

Install directly from GitHub if you need the latest source from `main`:

```bash
npm install -g github:tempmailhush/tempmailhush-cli
```

### Agentic One-Shot

Use this when an agent runner should not keep a global install:

```bash
TEMPMAILHUSH_API_KEY=sk-xxx \
npm exec --yes github:tempmailhush/tempmailhush-cli -- tmh mailbox create
```

## Output Contract

All successful command output is JSON by default unless `--pretty` or `--raw` is used.

```bash
tmh mailbox create
```

```json
{
  "id": "mbx_xxx",
  "address": "abc@example.com",
  "expiresAt": "2026-08-22T10:00:00.000Z",
  "pollAfter": 5000
}
```

Human-readable output is opt-in:

```bash
tmh mailbox create --pretty
```

Raw output is opt-in for body-style commands:

```bash
tmh --raw message html <mailbox_id> <message_id>
tmh --raw message source <mailbox_id> <message_id>
tmh message source <mailbox_id> <message_id> --output -
```

Errors are JSON on stderr:

```json
{
  "error": "missing_api_key",
  "message": "API key is missing. Run: tmh auth set <api_key>"
}
```

## Common Workflows

| Goal | Command |
| --- | --- |
| Create an inbox | `tmh mailbox create` |
| Create an inbox with follow-up commands | `tmh mailbox new` |
| Create an inbox and wait for email | `tmh mailbox create-and-wait --timeout 120 --interval 5` |
| Wait for a message in an existing inbox | `tmh mailbox wait <mailbox_id> --timeout 120 --interval 5` |
| List received messages | `tmh mailbox messages <mailbox_id>` |
| Read a message | `tmh message get <mailbox_id> <message_id>` |
| Extract a verification code | `tmh message code <mailbox_id> <message_id>` |
| Download raw email source | `tmh message source <mailbox_id> <message_id> --output message.eml` |
| Download an attachment | `tmh attachment get <mailbox_id> <message_id> <attachment_id> --output ./file` |
| Check quota | `tmh usage` |

## Auth and Config

Save an API key:

```bash
tmh auth set sk-xxx
```

Or use environment variables:

```bash
export TEMPMAILHUSH_API_KEY=sk-xxx
export TEMPMAILHUSH_BASE_URL=https://tempmailhush.com
```

Local config is stored at:

```text
~/.config/tempmailhush/config.json
```

Config priority:

```text
CLI flags > environment variables > config file > defaults
```

## Commands

### Global

| Command | Purpose |
| --- | --- |
| `tmh --version` | Print the CLI version. |
| `tmh --help` | Show top-level help and available commands. |
| `tmh <command> --help` | Show help for a specific command group or command. |

### Auth and Config

| Command | Purpose |
| --- | --- |
| `tmh auth set <api_key>` | Save an API key to local config. |
| `tmh auth show` | Show the active API key prefix and base URL. |
| `tmh auth clear` | Remove the local config file. |
| `tmh config show` | Show stored and resolved CLI configuration. |
| `tmh config set api-key <api_key>` | Save an API key to local config. |
| `tmh config set base-url <url>` | Save the API base URL to local config. |
| `tmh config clear` | Remove the local config file. |

### API Status

| Command | Purpose |
| --- | --- |
| `tmh domains` | List available mailbox domains. |
| `tmh usage` | Show monthly API usage and remaining quota. |
| `tmh rate-limit` | Show the per-minute API rate limit. |

### Mailbox

| Command | Purpose |
| --- | --- |
| `tmh mailbox create` | Create a mailbox. |
| `tmh mailbox new` | Create a mailbox and return useful follow-up commands. |
| `tmh mailbox create-and-wait --timeout 120 --interval 5` | Create a mailbox and wait for the first message. |
| `tmh mailbox get <mailbox_id>` | Get mailbox details. |
| `tmh mailbox extend <mailbox_id>` | Extend mailbox lifetime. |
| `tmh mailbox switch <mailbox_id>` | Create a replacement mailbox and delete the old one. |
| `tmh mailbox delete <mailbox_id>` | Delete a mailbox. |
| `tmh mailbox messages <mailbox_id>` | List messages in a mailbox. |
| `tmh mailbox wait <mailbox_id> --timeout 120 --interval 5` | Poll until a message arrives or timeout is reached. |

### Message

| Command | Purpose |
| --- | --- |
| `tmh message get <mailbox_id> <message_id>` | Get message detail and text body. |
| `tmh message code <mailbox_id> <message_id>` | Extract a verification code from a message. |
| `tmh message html <mailbox_id> <message_id>` | Get sanitized HTML as JSON. |
| `tmh --raw message html <mailbox_id> <message_id>` | Print sanitized HTML directly. |
| `tmh message html <mailbox_id> <message_id> --output message.html` | Write sanitized HTML to a file. |
| `tmh message source <mailbox_id> <message_id>` | Get raw RFC822 source as JSON. |
| `tmh --raw message source <mailbox_id> <message_id>` | Print raw RFC822 source directly. |
| `tmh message source <mailbox_id> <message_id> --output message.eml` | Write raw RFC822 source to a file. |
| `tmh message delete <mailbox_id> <message_id>` | Delete a message. |

### Attachment

| Command | Purpose |
| --- | --- |
| `tmh attachment list <mailbox_id> <message_id>` | List message attachments. |
| `tmh attachment get <mailbox_id> <message_id> <attachment_id>` | Get attachment bytes as base64 JSON. |
| `tmh attachment get <mailbox_id> <message_id> <attachment_id> --output ./file` | Write attachment bytes to a file. |

## Agent Workflow

Create an inbox and wait for the first message:

```bash
tmh mailbox create-and-wait --timeout 120 --interval 5
```

Successful wait result:

```json
{
  "status": "received",
  "mailbox": {
    "id": "mbx_xxx",
    "address": "abc@example.com",
    "expiresAt": "2026-08-22T10:00:00.000Z",
    "pollAfter": 5000
  },
  "message": {
    "id": "msg_xxx",
    "sender": "noreply@example.com",
    "subject": "Verify your account",
    "textPreview": "Your code is 123456",
    "receivedAt": "2026-08-21T12:00:00.000Z"
  },
  "elapsedSeconds": 10
}
```

Extract a verification code from a known message:

```bash
tmh message code "$MAILBOX_ID" "$MESSAGE_ID"
```

```json
{
  "mailboxId": "mbx_xxx",
  "messageId": "msg_xxx",
  "code": "123456",
  "candidates": ["123456"]
}
```

Timeout result uses exit code `3`:

```json
{
  "status": "timeout",
  "mailbox": {
    "id": "mbx_xxx",
    "address": "abc@example.com",
    "expiresAt": "2026-08-22T10:00:00.000Z",
    "pollAfter": 5000
  },
  "timeoutSeconds": 120,
  "elapsedSeconds": 120
}
```

## Exit Codes

| Code | Meaning |
| ---: | --- |
| `0` | Success. |
| `1` | Command or API failure. |
| `2` | Missing or invalid API key. |
| `3` | Wait timeout. |
| `4` | Verification code not found. |
