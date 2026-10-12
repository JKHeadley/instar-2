# Change review — Measure the context floor from the largest fixed envelope

Subject base: 4b68689b91a4eefec63f7a77f33487abfadea312
Review state: open
Reviewed content: none
Outcome: Admit a minimum context that fits the measured summary and preserves the complete tool packet within the existing default cap.
Affected rules: 13, 37, 49, 60, 70, 74, 78, 84, 95, 101, 111, 113, 116; purpose Rule 2 and ability preservation.
Affected floors: secrets — custody and outbound checkpoint unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — durable claims unchanged; durable intake — journal unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: One numeric context-admission correction touches the model envelope budget; validate the actual worker, byte boundaries and recorded output shapes.
Side effects: The minimum admitted limit rises from 29595 to 29709 bytes. Default remains 32768, review reserve remains 6636, and 3059 conversation bytes remain above the 3000 floor. Existing smaller roots retain their existing packet-fitting behavior; new or re-declared below-floor limits are refused with the required value. Prompt text, tools, parsers and output judgments are unchanged.
Undo and recovery: Revert this constant and its boundary assertion, then regenerate register publications. No durable data migration or live state writes.
Multi-machine posture: Stateless shared constants and tests behave identically on every host; offline replay journals and logs are machine-local evidence only. No ownership, replication or transport change.
Layer below: Read both constitutional documents. Checked floor derivation, reply-review reserve, packet ladder, real envelope serialization, launcher admission and immutable captured outputs. Largest measured fixed envelope is the 23073-byte summary; tool-equivalent fixed bytes are 23018.
Bug class: integration
Bug evidence: reproducer=tests/preview/default-context-floor.test.ts; Baseline repeats both reported failures; corrected minimum passes all six tests. Boundary assertion proves the summary fits at admission and fails one byte below. Recorded output replays reach complete model packets on both routes.
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: No prompt prose or model-output decision changes. Recorded summary-writer/uncertain, Jev undecided/unsure, review, delivered and empty shapes replay at the corrected minimum on text and tool routes with complete guidance; outcomes match the unchanged default.
Prompt finding: 849db3a6296a | quoted-evidence | Existing unchanged recall protocol text is quoted by its regression fixture; no semantic outcome is hardcoded — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: e8708c7fea24 | quoted-evidence | Existing unchanged recall protocol text is quoted by its regression fixture; no semantic outcome is hardcoded — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."

Subject (9 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/default-context-floor.test.ts, tests/preview/journal.ts

Replay evidence: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-11-measured-floor-replay.json (14 minimum/default comparisons using seven captured shapes; immutable fixture and per-output hashes recorded).

Verification: 21/21 targeted tests pass across default-context-floor, default-root-conversation and canary-review-replay. TypeScript/build pass. Desk owner-manifest rehash and chain repin found zero changed pins. Regenerated seven publications from source commit 3876d8feab2fe6a7a7013891ded6f5269fd4c472, retaining 289 entries, 116 rules and 34 terms.

## Closing block

simplestRobustRoute: This is the simplest robust route: correct one measured constant to the largest existing envelope and use its existing admission formula. Prior prompt-shortening cycles are not repeated. No new machinery, enlarged default cap, reduced tools or quarantine; existing cap, stop, intake, custody and effect checkpoints remain. No new autonomous-completion claim.
80/20: Both reported failures are fixed by one numeric change. The targeted and cheap-check evidence accompanies this submission; full suite and independent convergence belong to the pipeline and review desk.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
