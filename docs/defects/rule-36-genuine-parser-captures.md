# Parsers without genuinely captured bytes (Rule 36 deferred holds)

**Status:** OPEN. Two shipped parsers of real-world text are tested only on hand-written bytes. Each carries a deferred Rule 36 hold that the register turns into an owned loop with a deadline.

**Owner:** Echo (agent), as owner of the preview trial and its channel adapters.

| Parser | Declaration | Committed bytes today | Register loop |
| --- | --- | --- | --- |
| Telegram update reader | `src/conversation/telegram.parser.json` | hand-written fixture, recorded `synthetic` | `deferred:telegram-intake-v1:36`, due 2026-11-08 after the overdue disposition below |
| Slack envelope reader | `src/conversation/slack.parser.json` | hand-written fixture, recorded `synthetic` | `deferred:slack-intake-v1:36`, due 2026-11-08 after the overdue disposition below |

**2026-11-01 overdue disposition (Slack only):** The October 31 ceiling passed without a genuine Slack envelope capture. The parser remains dark and its bytes remain synthetic; this defect stays OPEN. Echo owns a bounded new ceiling of **2026-11-08 00:00 UTC**. The extension is necessary because the Slack intake has no active live trial from which to capture a genuine envelope, while the expired date blocks the register build for unrelated Telegram repair. Echo will arrange a real Slack trial, capture its envelope bytes, redact personal content, commit the capture and provenance, and add a parser test that reads those bytes before the new ceiling. If a genuine trial cannot be arranged by November 6, Echo will raise that blocker before the ceiling rather than extend it silently. The October 31 miss remains recorded here. Independent review on November 1 found this bounded extension honest only while Part Four is unlanded, the parser stays dark, and the missed ceiling raises operator attention; it is not Rule 36 closure or Slack support evidence.

**2026-11-01 overdue disposition (Telegram):** The live Telegram parser also missed its October 31 genuine-update capture ceiling; the desk found this second overdue loop when checking the Slack register failure. Its existing fixture remains synthetic, so live operation is not Rule 36 conformance. Echo owns the same bounded new ceiling of **2026-11-08 00:00 UTC**, or Part Four landing if earlier, while retaining the deferred hold and this OPEN defect. By November 6 Echo will capture a genuinely received Telegram update, redact personal content, record its provenance and manifest hash, and commit a test importing the parser and reading those bytes. Echo will escalate a capture blocker by November 6 instead of rolling the date again. The October 31 miss and November 1 discovery remain visible here. Independent review found this extension structurally possible but required exact operator approval for landing the live-without-capture posture; a draft candidate is not approval or proof.

**Coverage while open:** each parser's tests prove its shape handling on the synthetic bytes only. They do not prove the parser accepts what the real service actually sends. The model-output and provider-result readers are not in this record: both are tested on the genuine 2026-09-24 Claude limit capture. The Jev response reader left this record on 2026-09-29: it is tested on a genuine TypeSafe response (`tests/fixtures/captures/jev-response.json`, test `tests/preview/jev-response-capture.test.ts`) and its Rule 36 hold is `held`.

**Telegram capture step:** a genuine update needs a message from a person's account, so the desk sends one probe message to the live-test bot; that update, with names, usernames and user/chat ids redacted, becomes `tests/fixtures/captures/telegram-update.json`, read by a committed test of `src/conversation/telegram.ts`, and the `telegram-intake-v1` hold flips to `held` exactly as the Jev reader's did.

**Closure:** capture genuine bytes from each live service with personal content redacted, commit them as `captured` rows in the owner manifest, and point each parser's Rule 36 hold at a committed test that imports the parser and reads those bytes (`scripts/register-shipped.mjs`, R36). Then remove the deferred hold. Past the deadline, the register's loop check fails the build and its overdue action raises an operator attention item.

**Multi-machine posture:** the captures and this record travel with the repository; the parsers run machine-local.
