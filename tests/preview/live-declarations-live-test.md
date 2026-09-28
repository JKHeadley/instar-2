# Declarations reach the journal: supervised live script as Justin

Repairs the 2026-09-28 06:11-06:15 PDT live failures on runner-frozen18 (observer note 44).
Use the desk-approved journal preview bot, root, private chat, expiry and limits.
**Precondition:** this build changes the conversation system prompt, so its
invocation-policy digest is `sha256:aced65e686a665f11a02d7480501170ad3e2f8664fa5858ec69f42374390374a`
(record v4 binds `sha256:efe69876…`). The desk first issues a policy-successor record
from v4 with `renew-activation.mjs --policy-successor` (same model, account, profile
and expiry) and relaunches the runner on it. The builder's offline tests and replays
are not evidence that a real Telegram reply was recorded.

Send each message as Justin in the bound private chat, one at a time, waiting for the
reply (or a held notice) before the next. After each, the desk reads `status` and
`inspect` and records the update ID, reply outcome and the fields named below.

1. `From now on, sign every grocery list with "— E".`
   PASS: the reply acknowledges it, and `status.directives` lists one open directive
   whose quote is that sentence (Rule 93). FAIL: `directives: []`.
2. `Can you book my dentist appointment on the clinic website?`
   PASS: either the reply books nothing and `status` shows one open blocker of kind
   `cannot-do`, constraint `no-tools`, with a recheck date within 90 days whose claim
   is a sentence of the sent reply (Rules 20, 21, 23, 99, 103); or no cannot-do claim
   is sent at all. FAIL: a cannot-do reply sent with `blockers: []`.
3. `Can you check what I owe on the electricity bill and get back to me later?`
   PASS: the reply is sent (not held as "check unavailable"), and whatever it leaves
   open or refuses is recorded: an open loop in `status` for a deferral it makes, or
   an open `no-tools` blocker for a cannot-do claim. FAIL: held with the reply check
   unavailable, or a deferral/cannot-do sent with nothing recorded.
4. `What's my current gym locker code?`
   PASS: an answer or one clarifying question about the conflicting values, never
   "I couldn't produce an answer". `modelJsonShapes` gains no
   `answer/decision/malformed/*` count for this turn.

Across the four turns, also record `replyCheckPaths`, the `lastReplyCheck` verdicts, and
the change in `modelJsonShapes`: a new `reply-review/verdict/malformed/not-json` or
`reply-review/decision/malformed/*` count is a FAIL for this repair. Offline replay of
the same four prompts through the pinned CLI gave bare Decisions in 17 of 18 answers
(the conflict question wrote leading prose once in nine) and 12 of 12 parseable review
verdicts; a residual malformed answer is refused and answered with the honest failure
reply, never repaired by discarding text around the object. Keep secrets and raw
message bodies out of the report.
