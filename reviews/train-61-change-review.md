# Change review — train-61 deferred answer completion integration

Subject base: d169b80bf8f7a7cb20675ea6396168c1313b29c0
Review state: open
Reviewed content: none
Outcome: Integrate the exact reviewed deferred-answer preparation instruction and captured provider replay evidence.
Affected rules: 8, 10, 12, 22, 36, 37, 41, 46, 49, 58, 64, 69, 74, 83, 90, 92, 101, 102, 111, 112, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake remain unchanged; no new model call, state, scheduler, parser or delivery permission added.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Inherited model-facing scheduled-work instruction; no new source edit beyond the reviewed member.
Side effects: Completed answers are prepared before delivery is due. Existing report storage, delivery permission and receipt settlement remain unchanged. Generated publication pins the merged source.
Undo and recovery: Revert the prompt clause and replay the existing register from the reverted source; no runtime state migration.
Multi-machine posture: Unchanged existing journal ownership and replication; no new state or writer. Verification runs locally on WSL; Studio owns native and live acceptance.
Layer below: Read constitution in full, member report and cint-L37 desk-chain report. Member captured real outputs for updates 46040200/46040201 and replayed complete work envelopes; the existing durable report path separates preparation from authorized delivery.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/deferral-finish.test.ts; live=tests/preview/fixtures/deferral-finish-2026-10-17.json
Hook bypass: none; core.hooksPath unset, common hooks directory contains sample files only.
Convergence: none
Decision: train-61-merge | Ordinary merge of exact reviewed c3f04c64682174dbf9fa67eb9a65a83a470771fd; source report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/deferral-finish-1017s-PROGRESS.md read through Studio API. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-61-PROGRESS.md
Decision: train-61-A | Preserve reviewed member bytes without product edits; source and fixture merged cleanly; only generated publication conflicts, regenerated after source merge. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-61-PROGRESS.md
Decision: train-61-B | Create branch directly at exact live d169b80bf8f7a7cb20675ea6396168c1313b29c0; no main merge or later branch move. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-61-PROGRESS.md
Decision: train-61-C | No conflict requires omission; sole requested member remains an ancestor. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-61-PROGRESS.md
Decision: train-61-D | Apply explicit WSL exceptions to unchanged launcher and native checks; disclose results and leave Studio acceptance to desk. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-61-PROGRESS.md
Decision: train-61-desk | Use downloaded repin/build/rehash/replay chain; retain live generated publication only as merge staging baseline, then replay from committed merged source so source and artifact hashes agree. No generated hand edits or guard change. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-61-PROGRESS.md

Prompt review: clarify the existing work prompt by meaning: returning report stores a finished answer and does not itself send. No fixed user phrase, classifier heuristic or coerced outcome. Two fresh claude-sonnet-5 calls replayed the complete recorded train-55 envelopes with only the task question replaced, tools disabled and a $1 cap each; both returned substantive reports. Fixtures preserve exact provider result bytes and complete supplied envelopes. Worker replay is isolated, not a claim of whole-root or live Telegram acceptance.
Prompt finding: 4106b49fff07 | protocol-literal | Unchanged existing protocol guidance; not a semantic classifier copied from a fixture.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged existing protocol guidance; not a semantic classifier copied from a fixture.
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged existing protocol guidance; not a semantic classifier copied from a fixture.
Deferral: tests/preview/deferral-finish.test.ts:94 | not-a-deferral=Recorded deferred-work evidence or instructions under test; no unfinished builder work.
Deferral: tests/preview/fixtures/deferral-finish-2026-10-17.json:18 | not-a-deferral=Recorded deferred-work evidence or instructions under test; no unfinished builder work.
Deferral: tests/preview/fixtures/deferral-finish-2026-10-17.json:23 | not-a-deferral=Recorded deferred-work evidence or instructions under test; no unfinished builder work.
Deferral: tests/preview/fixtures/deferral-finish-2026-10-17.json:29 | not-a-deferral=Recorded deferred-work evidence or instructions under test; no unfinished builder work.
Deferral: tests/preview/fixtures/deferral-finish-2026-10-17.json:31 | not-a-deferral=Recorded deferred-work evidence or instructions under test; no unfinished builder work.
Deferral: tests/preview/fixtures/deferral-finish-2026-10-17.json:33 | not-a-deferral=Recorded deferred-work evidence or instructions under test; no unfinished builder work.
Deferral: tests/preview/fixtures/deferral-finish-2026-10-17.json:48 | not-a-deferral=Recorded deferred-work evidence or instructions under test; no unfinished builder work.
Deferral: tests/preview/fixtures/deferral-finish-2026-10-17.json:54 | not-a-deferral=Recorded deferred-work evidence or instructions under test; no unfinished builder work.
Deferral: tests/preview/fixtures/deferral-finish-2026-10-17.json:56 | not-a-deferral=Recorded deferred-work evidence or instructions under test; no unfinished builder work.
Deferral: tests/preview/fixtures/deferral-finish-2026-10-17.json:58 | not-a-deferral=Recorded deferred-work evidence or instructions under test; no unfinished builder work.
Deferral: tests/preview/fixtures/deferral-finish-2026-10-17.json:82 | not-a-deferral=Recorded deferred-work evidence or instructions under test; no unfinished builder work.
Deferral: tests/preview/journal.ts:2589 | not-a-deferral=Recorded deferred-work evidence or instructions under test; no unfinished builder work.

## Closing block

simplestRobustRoute: Ordinary merge and existing generation chain are the simplest robust route. No added machinery. Start at exact live base, preserve all five safety floors, test existing consumers and defer deployment to the authorized desk. No autonomous product-completion claim.
80/20: Run specified targeted tests, journal checks and pinned gates in foreground chunks, without full-suite or duplicate-base comparison.
VERDICT: author submission; independent desk review pending
