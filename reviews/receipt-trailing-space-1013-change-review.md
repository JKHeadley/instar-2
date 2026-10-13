# Change review — Telegram receipt mismatch diagnostics

Subject base: ac3bd4d8874495f8b66b571837a1380995113d7a
Review state: open
Reviewed content: none
Outcome: Record which receipt fields mismatch with bounded content-masked text shape; preserve train-19 receipt classification exactly.
Affected rules: 1, 4, 26, 34, 36, 37, 39, 42, 49, 70, 71, 74, 89, 95, 101, 102, 108, 111, 112, 113, 116.
Affected floors: secrets — closed field names and masked whitespace excerpts only; spend cap — unchanged; stop — unchanged; no duplicate sends — UNKNOWN remains fenced; durable intake — unchanged signed intent and encrypted journal.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Diagnostic-only repair in the existing receipt classifier, with exact comparison restored; no new authority, transport, state or model-facing path.
Side effects: UNKNOWN mismatch reasons distinguish chat/thread/message_id/text and include lengths, offset and masked text excerpts within the existing 200-character bound. Reason aggregates can have more keys. No acceptance criterion changes from train-19, including exact empty-string equality. No raw receipt is stored by these diagnostics.
Undo and recovery: Revert the diagnostic helper and reason construction to train-19's generic reason. Existing outcomes remain recorded and UNKNOWN sends remain fenced; rollback never redispatches them.
Multi-machine posture: Pure classifier on every machine; diagnostics use the existing journal and its replication. No new machine-local state, owner admission or recovery protocol.
Layer below: Compared train-19 classifier predicates and read the journal-agent send seam, outbound settlement, encrypted journal replay and sendOutcomeCounts. The prior independent unit review found missing real provider evidence for normalization and accepted the bounded diagnostic mechanism.
Bug class: integration
Bug evidence: reproducer=tests/preview/receipt-trailing-space.test.ts
Hook bypass: none
Convergence: none
Prompt review: No prompt, model-output parser or judgment gate changes. Tests use explicit offline diagnostic shapes, not purported provider captures.

Decision: receipt-space-redaction | Keep closed mismatch field names and bounded UTF-16 lengths, first offset and whitespace-only escaped excerpts in the existing reason; mask other content before escaping. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/receipt-trailing-space-1013-repair2-PROGRESS.md
Decision: receipt-space-defer-comparator | Restore train-19 exact equality and remove the synthetic normalization fixture and dependent tests. Preserve the original comparator unchanged on receipt-trailing-space-comparator-1013; do not merge it without an authentic paired intent/provider receipt fixture. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/receipt-trailing-space-1013-repair2-PROGRESS.md

## Evidence and tracked comparator work

Owner: receipt desk. Parked branch: receipt-trailing-space-comparator-1013 at 4aa6255b2fce3d663deeff9f03552830080cd1f1. Re-surface at the next receipt-mismatch UNKNOWN and at the desk's next landing review. Exit condition: a real paired intent and provider-returned text for the same authorized send is in repository fixtures, replayed through classifier and journal, and independently reviewed. This branch must not merge before that condition. The original incident's cause remains unknown.

The new reason is `receipt differs from intent: <fields>` with fields in chat,thread,message_id,text order. Text differences append `len=<expected>/<actual> at=<offset> excerpt=<expected>/<actual>` for strings, or `type=<actual typeof>` otherwise. Lengths and offset use UTF-16 code units; excerpts cover at most two preceding and eight following units, retain only space/LF/CR/tab, mask everything else with dots and JSON-escape the result. The whole reason is capped at 200 characters.

Read the durable `send-outcome` frame's target/outcome/reason, or the reopened journal's `view.sendOutcomes`. The existing status projection exposes `sendOutcomes.lastUnknown` and `sendOutcomes.unknownReasons`. Resolve `reply:<turn id>` to the turn's intent and update id. These diagnostics identify mismatch shape, not full provider bytes; masking is irreversible, and a paired fixture cannot be reconstructed from it. The desk must retain an authorized paired response capture before promoting the parked comparator. No live send or runner change was made by this unit.

Tests cover exact matching and non-exact whitespace neighbors, identity fields, multiple simultaneous mismatches, non-string text, masking and the journal/status projection after encrypted reopen with no redispatch. The existing journal-send-outcome tests retain transport, refusal and crash coverage. Rule 36's unproved normalization branch is removed, not certified by synthetic tests.

Subject (9 paths): tests/preview/telegram-send-outcome.mjs, tests/preview/receipt-trailing-space.test.ts, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

The generated register pins bind the committed diagnostics-only classifier; generated changes are source-commit and generation metadata only.

## Closing block

simplestRobustRoute: Use the existing reason field to diagnose UNKNOWN while retaining train-19's exact comparator. No new capture store, retry, normalization or gate. Start guards are signed intent and owner admission; end guards remain exact receipt predicates; limit guards are the existing 200-character reason and transport/journal bounds. No live-provider completion claim is made.
80/20: The missing normalization evidence is handled by the desk's explicit split. Diagnostic verification and unchanged classification are the scope; independent convergence belongs to the desk.
VERDICT: author submission; no independent verdict asserted
