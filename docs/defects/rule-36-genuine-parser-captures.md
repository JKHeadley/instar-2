# Parsers without genuinely captured bytes (Rule 36 deferred holds)

**Status:** OPEN for the Slack envelope reader; CLOSED for the Telegram update reader on 2026-11-07. The Slack parser is still tested only on hand-written bytes and carries a deferred Rule 36 hold that the register turns into an owned loop with a deadline.

**Owner:** Echo (agent), as owner of the preview trial and its channel adapters.

| Parser | Declaration | Committed bytes today | Register loop |
| --- | --- | --- | --- |
| Telegram update reader | `src/conversation/telegram.parser.json` | genuine redacted update, recorded `captured` (`P12-TELEGRAM-UPDATE-CAPTURE`) | closed 2026-11-07: hold is `held` on `P12-TELEGRAM-UPDATE-ON-CAPTURE` |
| Slack envelope reader | `src/conversation/slack.parser.json` | hand-written fixture, recorded `synthetic` | `deferred:slack-intake-v1:36`, due 2026-10-31 |

**Coverage while open:** each parser's tests prove its shape handling on the synthetic bytes only. They do not prove the parser accepts what the real service actually sends. The model-output and provider-result readers are not in this record: both are tested on the genuine 2026-09-24 Claude limit capture. The Jev response reader left this record on 2026-09-29: it is tested on a genuine TypeSafe response (`tests/fixtures/captures/jev-response.json`, test `tests/preview/jev-response-capture.test.ts`) and its Rule 36 hold is `held`.

**Telegram closed (2026-11-07):** update 715672737, an ordinary text message a person's account sent to proof-room bot 8994258214 on 2026-10-01, was read back read-only from that room's journal. With the person's names and user/chat id redacted it is `tests/fixtures/captures/telegram-update.json` (provenance in `tests/fixtures/captures/README.md`), read by `tests/conversation/telegram-update-capture.test.ts` through `extractTelegramUpdate` and the live ingress. The `telegram-intake-v1` hold is `held` on that test and its deferred hold is removed. The hand-written `P12-TELEGRAM-REPLY-CAPTURE` fixture stays, recorded `synthetic`, for the shape tests that use it.

**Slack capture step (still open):** the reader accepts only a `message` event that carries `user` and no `bot_id` or `subtype`, so a genuine envelope needs a person's Slack account to send one message to the app while a capture-only Socket Mode connection is open. The 1.x agent stores no raw envelopes, and its own bot posts carry `bot_id`, so they cannot stand in.

**Closure:** capture genuine bytes from each live service with personal content redacted, commit them as `captured` rows in the owner manifest, and point each parser's Rule 36 hold at a committed test that imports the parser and reads those bytes (`scripts/register-shipped.mjs`, R36). Then remove the deferred hold. Past the deadline, the register's loop check fails the build and its overdue action raises an operator attention item.

**Multi-machine posture:** the captures and this record travel with the repository; the parsers run machine-local.
