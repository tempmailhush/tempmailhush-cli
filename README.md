# tempmailhush-cli

Free, open-source, AI Agent-friendly temporary email CLI for TempMailHush. Learn more at https://tempmailhush.com.

It can be used for automated email testing, verification code receiving, registration flow testing, CI/CD testing, one-time inboxes for crawlers or data collection, and privacy protection. The CLI is designed for automation first: stdout is JSON by default, errors are JSON on stderr, and exit codes are meaningful for agents, CI, and shell scripts.

## Install

```bash
npm install -g github:tempmailhush/tempmailhush-cli
```

Agentic one-shot usage without a global install:

```bash
TEMPMAILHUSH_API_KEY=sk-xxx \
npm exec --yes github:tempmailhush/tempmailhush-cli -- tmh usage
```

Agentic setup for persistent runners:

```bash
npm install -g github:tempmailhush/tempmailhush-cli
export TEMPMAILHUSH_API_KEY=sk-xxx
export TEMPMAILHUSH_BASE_URL=https://tempmailhush.com
tmh mailbox create
```

## Auth

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

Manage config directly:

```bash
tmh config show
tmh config set api-key sk-xxx
tmh config set base-url https://tempmailhush.com
tmh config clear
```

Config priority:

```text
CLI flags > environment variables > config file > defaults
```

## Output Contract

JSON is the default:

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

## Commands

### Global

| Command | Purpose |
| --- | --- |
| `tmh --version` | Print the CLI version. |
| `tmh --help` | Show top-level help and available commands. |
| `tmh <command> --help` | Show help for a specific command group or command. |

### Auth

| Command | Purpose |
| --- | --- |
| `tmh auth set <api_key>` | Save an API key to local config. |
| `tmh auth show` | Show the active API key prefix and base URL. |
| `tmh auth clear` | Remove the local config file. |

### Config

| Command | Purpose |
| --- | --- |
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

### Mailboxes

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

### Messages

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

### Attachments

| Command | Purpose |
| --- | --- |
| `tmh attachment list <mailbox_id> <message_id>` | List message attachments. |
| `tmh attachment get <mailbox_id> <message_id> <attachment_id>` | Get attachment bytes as base64 JSON. |
| `tmh attachment get <mailbox_id> <message_id> <attachment_id> --output ./file` | Write attachment bytes to a file. |

## Agent Workflow

Create a mailbox:

```bash
MAILBOX_JSON=$(tmh mailbox create)
MAILBOX_ID=$(node -e 'process.stdin.on("data", d => console.log(JSON.parse(d).id))' <<< "$MAILBOX_JSON")
```

Wait for a message:

```bash
tmh mailbox wait "$MAILBOX_ID" --timeout 120 --interval 5
```

Successful wait result:

```json
{
  "status": "received",
  "mailboxId": "mbx_xxx",
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

Timeout result uses exit code `3`:

```json
{
  "status": "timeout",
  "mailboxId": "mbx_xxx",
  "timeoutSeconds": 120,
  "elapsedSeconds": 120
}
```

Extract a verification code:

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

Exit codes:

```text
0 success
1 command/API failure
2 missing or invalid API key
3 wait timeout
4 verification code not found
```

## Development

```bash
npm test
npm run typecheck
npm run build
```

Use a local Worker during development:

```bash
tmh --base-url http://localhost:8787 --api-key sk-xxx usage
```
