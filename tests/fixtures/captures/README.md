# Genuine parser captures (Rule 36)

Bytes here were received from a live service and are committed unchanged, except where a redaction is named below. Each file is a `captured` row in an owner manifest under `register-source/owner-references/`, and a committed test reads it through the parser that consumes it.

| File | Service | Captured | Redaction | Parser test |
| --- | --- | --- | --- | --- |
| `jev-response.json` | TypeSafe System One (`jev-1.13.0`), one reply-check request built by `jevRequestBody` for the agent-authored text "Done: the summary is saved and the reminder for Friday is set." | 2026-09-29, HTTP 200, 513 bytes | none: the response carries only model, scores and token usage | `tests/preview/jev-response-capture.test.ts` |

The Telegram update and Slack envelope readers have no genuine capture yet; see `docs/defects/rule-36-genuine-parser-captures.md`.
