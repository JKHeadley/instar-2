# Run an installed agent

`instar2 run <root>` starts the existing journal runner using the installation's records.
It runs one bounded runner lifetime, returns its exit status, and receives signals directly.
The installation's existing service supervisor owns restarting it. This command does not
install accounts, grant authority, change the selected model, or clear a stop.
`journal-agent.mjs run` remains available with its existing arguments.

The root must already have its journal and admitted login inventory. The installation owner
records `run-config.json` in this format (example identities are placeholders):

```json
{
  "version": 1,
  "options": {
    "bot-id": "12345678",
    "bot-username": "@example_bot",
    "operator-sender-id": "12345",
    "chat-id": "-1001234567890",
    "forum": true,
    "grant-reference": "preview-trial:example",
    "configuration-digest": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "expires-at": "2026-11-12T21:40:00Z",
    "operator-records": "/installation/operator-records",
    "explicit-yes-installation": "/installation/explicit-yes-installation.json",
    "review-repository": "owner/repository",
    "harness-user": "_instarharness",
    "conversation-session": "on"
  }
}
```

All fields shown are required; unknown options and versions refuse. Values are configuration,
not authority: the existing runner checks them against the journal and sealed approvals.
Record paths are absolute, matching the installed login inventory's existing format. They
may point to the separately held custody records; this command does not copy or rewrite them.
No secret belongs in these records. The runner consumes the existing SecretRef environment
through its existing custody path. Diagnostics never print record values or caught exceptions.

| Runner argument | Source |
|---|---|
| `--root` | Command argument, resolved to an absolute path |
| `--bot-id`, `--bot-username`, `--operator-sender-id`, `--chat-id`, `--forum` | Same-named `run-config.json` options |
| `--grant-reference`, `--configuration-digest`, `--expires-at` | Same-named configuration options; runner checks journal and authority |
| `--operator-records`, `--explicit-yes-installation`, `--review-repository`, `--harness-user` | Same-named configuration options |
| `--model` | Only `<root>/model-setting.json`, exactly `{"model":"<model-id>"}`; the existing model-setting reader's model-id grammar |
| `--activation-record`, `--authority-record` | First installed login's `activation`, `authority` in `harness-logins.json` |
| `--tools-activation` | First login's optional `toolsActivation`; absent retains the runner's existing grant derivation |
| `--conversation-session` | Configuration option `on` or `off` |
| `--session-work-activation` | First login's `sessionActivation`; required when conversation sessions are on |
| `--max-calls`, `--max-replies`, `--max-turns`, `--max-context-bytes` | Optional positive integer configuration options; defaults 16, 16, 20, 32768, matching the captured launcher |
| Login pool | Existing runner reads the whole `harness-logins.json`, prepares members and performs its existing admission; no explicit pool flag bypasses that path |

The Node loader and runner entry come from this installed package, independent of the shell's
working directory. The process uses the package directory as its working directory, as the
existing launcher does. The command does not reproduce the desk's model re-pairing scripts:
a changed setting still needs valid admitted records for that model, or the runner refuses.

Missing, unreadable or malformed required records refuse before dispatch, preserving the root.
Downstream admission continues to enforce custody, spend, stop, durable intake and ownership.
This launcher is machine-local; replication and conversation ownership stay with the runner.
It does not establish ordinary-install readiness or a successful first exchange by itself.

Existing installations keep their current launch command until their installation owner records
this configuration and proves the new command on a copy. Ordered installation-record migration
is update-path unit C (UPDATE-PATH-PLAN-1021); live cutover is unit E, owned by the desk.
No existing root, service, launcher or installed record is changed by installing this command.
