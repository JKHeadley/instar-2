# Parsers without genuinely captured bytes (Rule 36 deferred holds)

**Status:** OPEN. Two shipped parsers of real-world text are tested only on hand-written bytes. Each carries a deferred Rule 36 hold that the register turns into an owned loop with a deadline.

**Owner:** Echo (agent), as owner of the preview trial and its channel adapters.

| Parser | Declaration | Committed bytes today | Register loop |
| --- | --- | --- | --- |
| Telegram update reader | `src/conversation/telegram.parser.json` | hand-written fixture, recorded `synthetic` | `deferred:telegram-intake-v1:36`, due 2026-10-31 |
| Slack envelope reader | `src/conversation/slack.parser.json` | hand-written fixture, recorded `synthetic` | `deferred:slack-intake-v1:36`, due 2026-10-31 |

**Coverage while open:** each parser's tests prove its shape handling on the synthetic bytes only. They do not prove the parser accepts what the real service actually sends. The model-output and provider-result readers are not in this record: both are tested on the genuine 2026-09-24 Claude limit capture. The Jev response reader left this record on 2026-09-29: it is tested on a genuine TypeSafe response (`tests/fixtures/captures/jev-response.json`, test `tests/preview/jev-response-capture.test.ts`) and its Rule 36 hold is `held`.

**Telegram capture step:** a genuine update needs a message from a person's account, so the desk sends one probe message to the live-test bot; that update, with names, usernames and user/chat ids redacted, becomes `tests/fixtures/captures/telegram-update.json`, read by a committed test of `src/conversation/telegram.ts`, and the `telegram-intake-v1` hold flips to `held` exactly as the Jev reader's did.

**Closure:** capture genuine bytes from each live service with personal content redacted, commit them as `captured` rows in the owner manifest, and point each parser's Rule 36 hold at a committed test that imports the parser and reads those bytes (`scripts/register-shipped.mjs`, R36). Then remove the deferred hold. Past the deadline, the register's loop check fails the build and its overdue action raises an operator attention item.

**Multi-machine posture:** the captures and this record travel with the repository; the parsers run machine-local.
