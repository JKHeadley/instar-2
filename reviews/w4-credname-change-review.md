# Change review — plain credential display names

Subject base: 01279df4399297466caa0f72400cdfe1b1269a48
Review state: open
Reviewed content: none
Outcome: Credential reminders, credential status fields and reply-review facts use plain display labels. Activation names and profile references remain internal registry and journal keys. Older records without a label derive one from their kind, with the subscription account retained in its sign-in label.
Affected rules: 1, 4, 13, 34, 36, 44, 45, 49, 70, 74, 80, 84, 86, 100, 101, 102, 113, 116
Affected floors: secrets — raw metadata and the display label still pass the existing public-label check before model facts; spend cap — no model call added; stop — unchanged; no duplicate sends — notice keys and old journal lines unchanged; durable intake — no journal rewrite or key rename
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The source metadata supplied to reply review changes, while verdict parsing and hold decisions are untouched.
Side effects: Credential status name/identity fields become display text; internal custody records keep their original keys. Unknown credential kinds receive a generic label instead of exposing their internal names. Already recorded replies remain historical evidence and are not rewritten.
Undo and recovery: Revert this change; optional displayLabel fields are ignored by older readers. Original names, identities and notice keys remain usable in both versions, so no journal or vault migration is needed.
Multi-machine posture: The display projection is identical on each machine at this revision; existing machine-local custody and journal ownership remain unchanged. No new state store or replication mechanism.
Layer below: Custody registration matches original names and preserves recordedAt for the same expiry. Reminder deduplication consumes original notice keys, including sent and uncertain intents. The public-label secret checks still inspect raw metadata as well as the displayed label.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/credential-display.test.ts; live=tests/preview/fixtures/credlabel-proofroom-T-2026-10-03.json
Hook bypass: none
Convergence: none
Decision: w4-credname-display-projection | add an optional display label and one shared fallback for older records, using it at reminder, status and review consumers; retain original registry names, identity references and notice keys to preserve custody and deduplication without rewriting old journals | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-credname-PROGRESS.md
Prompt review: Only credential metadata wording changes; no question, system prompt, parser, acceptance or escalation rule changes. The recorded proof-room cases 715673352 and 6232017 replay through the worker with their original answer bodies, Jev scores and review findings; their newly composed reminders and review facts use plain activation labels. Credential violations still hold; passing review still sends.

## Closing block

simplestRobustRoute: This is the simplest robust route: a shared display function and an optional field reuse existing record registration, reminder composition and public facts. Old-record fallback prevents a migration dependency; unchanged keys prevent duplicate reminders. No new model call or judgment layer. Start guard: existing credential custody; end-state: reminder and review consumer assertions; limits: existing notice bounds, secret checks and spend/stop gates. No live autonomous-completion claim.
80/20: Targeted tests and captured proof-room replay verify the wording and old-journal behavior. The desk owns register source repinning, independent review and the live gate.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
