# Change review — Rule 36: genuine Telegram update capture

Subject base: 3ad4ec04e38b820c2e715c02fe73df9c1028abf3
Review state: open
Reviewed content: none
Outcome: the live Telegram update reader (telegram-intake-v1) is tested on a genuine Bot API update instead of hand-written bytes, and its expired deferred Rule 36 hold (ceiling 2026-11-07 16:00 PST) is replaced by a held hold on that test. Update 715672737, an ordinary text message a person's account sent to proof-room bot 8994258214 on 2026-10-01, was read back read-only from a copy of that room's encrypted journal; the person's first and last name are replaced by REDACTED and the user/private-chat id by the same-length 1000000001. The Slack envelope reader's hold is unchanged and still past its ceiling: no genuine envelope could be obtained without a person's Slack account sending one message (see Residue).
Affected rules: 36, 6, 46, 90, 101, 116
Affected floors: secrets — the capture holds no credential; the storage key used to read the journal copy was read in a child environment and never printed or committed, and personal names and ids are redacted; spend cap — no model call; stop — unchanged; no duplicate sends — no message was sent to any service, and the new test proves a second delivery of the genuine bytes is recorded as a duplicate receipt, not a second admission; durable intake — the test drives the genuine bytes through the existing ingress and intake port unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it changes a live parser's Rule 36 hold and owner-manifest rows that feed the published register.
Side effects: one new captured row (P12-TELEGRAM-UPDATE-CAPTURE) and one new build fixture (P12-TELEGRAM-UPDATE-ON-CAPTURE) in the Part Twelve owner manifest, admitted by the Part Twelve contract in scripts/register-owner-references.mjs at exactly those paths; telegram.parser.json now names the captured row as its fixture. The synthetic P12-TELEGRAM-REPLY-CAPTURE row and its file stay for the shape tests that use them. No runtime source changes.
Undo and recovery: revert the commit; the parser then returns to a deferred hold whose ceiling has passed, so the register check fails again exactly as before this change.
Multi-machine posture: the capture, its test and the manifest rows travel with the repository; the parser runs machine-local and its behaviour is unchanged.
Layer below: extractTelegramUpdate (src/conversation/telegram.ts), createTelegramIngress and the intake port, the owner-reference loader and the R36 check in scripts/register-shipped.mjs.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: r36-tg-source | read the genuine update from a copy of a stopped proof-room journal (proofroom-2026-09-30) rather than sending a new probe, because the brief forbids sending Telegram messages and the journal already holds updates from a person's account; the journal stores JSON.stringify of each parsed getUpdates element (same keys, order and values), recorded in the provenance | reported=rule36-captures-1107-PROGRESS.md
Decision: r36-tg-redaction | follow the 1.x captured-fixture convention (JKHeadley/instar main 8d81ecb2, tests/fixtures/captured/scope-accretion-telegram-receive/*.meta.json: ids masked same-length) for ids, and replace the person's names by REDACTED; message text is a desk build-check probe that identifies no one, so it is kept | reported=rule36-captures-1107-PROGRESS.md
Decision: r36-new-row | add a new captured row instead of relabelling P12-TELEGRAM-REPLY-CAPTURE, because that synthetic forum-reply fixture is still used by the shape tests and the Part Twelve replay, and relabelling it would claim genuine origin for hand-written bytes | reported=rule36-captures-1107-PROGRESS.md
Deferral: docs/defects/rule-36-genuine-parser-captures.md:3 | commitment=docs/defects/rule-36-genuine-parser-captures.md
Deferral: docs/defects/rule-36-genuine-parser-captures.md:14 | not-a-deferral=records the completed Telegram closure and that the hand-written fixture stays recorded synthetic; it defers nothing

Verification: tests/conversation/telegram-update-capture.test.ts passes 3/3 on the genuine bytes (extraction as a person message routed by update_id; one admission then a duplicate receipt through the live ingress; refusal once is_bot is removed or the bytes pass the bound). tests/register/owner-references.test.ts passes 7/7, including a new mutation proving the genuine capture id cannot be repointed at the hand-written fixture. node scripts/build-register.mjs --check on the real clock no longer reports any Telegram finding; its only remaining finding is the Slack deadline. With --now before the ceiling it reports only the desk-owned source-pin message.
Residue: slack-capture | high | deferred:slack-intake-v1:36 is past its 2026-11-07 ceiling and still fails the register check: the reader accepts only a message event with user and no bot_id or subtype, the 1.x agent stores no raw envelopes, and its bot's own posts carry bot_id, so a genuine envelope needs a person's Slack account to send one message to the app while a capture-only Socket Mode connection is open.

## Closing block

simplestRobustRoute: reuse bytes Telegram already delivered and the runner already journaled, and the Jev reader's closure pattern (captured row, committed test importing the parser, held hold); no runtime change.
80/20: the parser's own test now runs on genuine bytes through extraction and the live ingress, which is the evidence Rule 36 asks for; the remaining Slack capture needs a human sender.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
