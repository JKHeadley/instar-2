# Change review — Accept authenticated forum history in active-memory audit

Subject base: 85a9c76bd9468e661b6b84ee935677bba686c1fd
Review state: open
Reviewed content: none
Outcome: Repair MUST-FIX 1: active-memory provenance accepts the configured authenticated forum envelope and continues rejecting forged sender/chat neighbors, preserving private behavior.
Affected rules: 26, 28, 34, 36, 37, 45, 49, 70, 74, 101, 111, 112, 113, 116
Affected floors: secrets — no bodies or keys emitted by evidence; spend cap — no model call changes; stop — admission unchanged; no duplicate sends — no sends during replay or audit; durable intake — read-only consumer repair, no journal writes
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Repairs the shipped audit command and memory provenance diagnostics; exact source predicate only, no model prompt or authority change.
Side effects: The auditor now uses the existing intake matchesBoundChat helper, including bound id, supergroup type and is_forum for configured forums. Sender, accepted turn, update and exact text checks remain. Generated register source pins are refreshed through build-register; delegated desk rehash/repin produced no owner-manifest or inventory changes.
Undo and recovery: Revert the audit predicate and test changes and regenerate the register. No durable data migration or state mutation; reverting reintroduces the false forum diagnostic.
Multi-machine posture: Read-only journal-derived diagnostics on each machine, with identical configured binding checks. No state, ownership, replication or effect behavior added.
Layer below: Inspected matchesBoundChat in forum-routing.ts and admittedUpdate in journal.ts: exact configured chat and transport shape plus authenticated operator admission. Inspected strict read-only replay and the shipped audit CLI exit-code path.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-audit.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains only sample files, checked locally
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: No prompt/parser/model decision changed. The audit module is classified as a prompt source by the scanner but this diff only changes the exact envelope provenance predicate.

Subject (2 paths): tests/preview/journal-audit.mjs, tests/preview/journal-audit.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse the existing intake chat-binding helper in the missed audit consumer. No new gate, service or restriction. Start guards retain accepted turn/update/operator identity; end state requires exact text and bound chat; forum/private type limits remain exact. Actual shipped audit ran unattended on the captured four-turn forum copy, exit 0, with forged sender/chat failures and unchanged bytes.
80/20: 16/16 focused audit tests pass with one nice worker; typecheck/build/architecture pass. The captured journal SHA-256 matches the reviewer capture and updates 969390330, 969390331, 969390332, 969390337 now audit cleanly. All eleven unchanged contract checker scripts pass at the saved full-gate evidence root; root-bound receipts correctly reject a relocated report. No fresh full-suite run claimed. Final post-commit checks recorded in the external repair PROGRESS.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
