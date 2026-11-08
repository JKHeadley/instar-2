# Genuine parser captures (Rule 36)

Bytes here were received from a live service and are committed unchanged, except where a redaction is named below. Each file is a `captured` row in an owner manifest under `register-source/owner-references/`, and a committed test reads it through the parser that consumes it.

| File | Service | Captured | Redaction | Parser test |
| --- | --- | --- | --- | --- |
| `jev-response.json` | TypeSafe System One (`jev-1.13.0`), one reply-check request built by `jevRequestBody` for the agent-authored text "Done: the summary is saved and the reminder for Friday is set." | 2026-09-29, HTTP 200, 513 bytes | none: the response carries only model, scores and token usage | `tests/preview/jev-response-capture.test.ts` |
| `telegram-update.json` | Telegram Bot API, update 715672737: one ordinary text message ("Build check 72fb5a82: reply with the word ok") from a person's account to proof-room bot 8994258214, read back read-only from that room's encrypted journal (root `proofroom-2026-09-30`), which stores each received update as `JSON.stringify` of the element the runner parsed from the `getUpdates` response (same keys, order and values) | 2026-10-01T02:09:52Z (message date), 316 bytes as stored, before redaction | the person's first and last name in `from` and `chat` replaced by `REDACTED`; the user id and private-chat id (the same number) replaced by `1000000001`; nothing else changed | `tests/conversation/telegram-update-capture.test.ts` |

The Slack envelope reader has no genuine capture yet; see `docs/defects/rule-36-genuine-parser-captures.md`.
