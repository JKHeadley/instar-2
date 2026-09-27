# Justin's supervised live failure catalog check

Run this only on the already authorized private preview, while it is active.
This script is an operator-channel check of the offline catalog. It does not
renew activation, raise caps, change provider policy, or restart the runner.
Use the live root known to the desk; never copy or edit its encrypted journal.

1. Read the active root's `status` using the existing storage-key host binding:
   `node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs status --root /ABSOLUTE/LIVE_ROOT`.
   Record expiry, stop state, remaining call/reply/turn slots, `lastReplyReview`,
   `modelJsonShapes`, `tooLong`, `openQuestions`, and `unknownSends`. Stop this
   procedure if the activation is expired, stop is set, or the next exchange
   would exceed a cap. Do not print the storage key or journal text into the report.
2. As Justin in the bound private Telegram chat, send one short ordinary question:
   “For this preview check, reply in one short sentence: what can you do here?”
   Confirm one complete `PREVIEW —` reply. Read `status` again: one accepted turn
   is durable, no extra send appeared, and the new review outcome, when one ran,
   has a bounded output-token count or an honest `null`. `thinkingPresent` must
   say `unobservable`; it cannot establish what the model thought internally.
3. If at least two call and reply slots remain, ask for an answer longer than one
   Telegram message: “Write a continuous 4,200-character explanation of this
   preview in one reply.” If the answer exceeds Telegram's limit, confirm the
   single fixed too-long notice, no answer prefix, and one `tooLong` entry with
   API-accepted or UNKNOWN delivery. If the model gives a short answer, record
   this branch as unexercised. Never resend an UNKNOWN result.
4. Read `status` and `inspect` through their existing commands. If there are
   open held items, ask one natural follow-up about an older held item and check
   whether the packet offered it under `openQuestions`, with at most ten listed.
   If there are no such items, record F05 live crowding as unexercised; do not
   create artificial holds on the live runner.
5. Compare `modelJsonShapes` before and after. A complete whole-response fence
   may be counted as tolerated. Any prose-wrapped or multiple-object shape must
   remain malformed and must not authorize a send. If none occur, mark F02/F03
   live branches unexercised. Do not ask the model to reveal a real secret to
   manufacture a rejection. A held over-cap review, if one occurs naturally,
   must retain its call reservation and show no send intent; otherwise mark the
   F01 over-cap live branch unexercised.

Report each F01–F05 as observed, failed, or unexercised, with the before/after
content-free counts and relevant update IDs. Telegram API acceptance is not
human receipt. The offline catalog supplies deterministic failure-boundary
evidence; this script supplies only the live branches actually observed.
