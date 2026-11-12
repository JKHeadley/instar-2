# Change review — session-close-tolerant-1112

Subject base: e3cb0f08d3a74d70c9e059edbd64fc457492bfff
Review state: open
Reviewed content: none
Outcome: Keep the runner serving when session maintenance refuses a close, preserve that refusal in custody, and record redacted causes for maintenance failures and fatal exits.
Affected rules: purpose 2; 7, 15, 26, 33, 39, 42, 46, 49, 55, 60, 68, 70, 74, 75, 77, 101, 102, 105, 111, 113, 115, 116, 123
Affected floors: secrets — full-message credential and held-secret scrubbing precedes first-line truncation; spend cap — no new reservation, refund or charge; stop — existing stop/ownership/admission checks hold; no duplicate sends — no send path changed or close re-appended; durable intake — custody retained and the ordinary drain continues.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Repairs the live runner's recurring death at a durability/lifecycle boundary; exact native conformance and publication accompany it.
Side effects: Only the exact shared missing-open-edge refusal is tolerated at close; the local close remains uncertain with its refusal detail. Other journal refusals still throw from the port, and are reported at runner maintenance. Identical maintenance failures log once per continuous episode. Run-log exits gain an optional cause; maintenance rows remain preserved on rollback, where the old reader conservatively reports them unreadable rather than misclassifying them as an exit. Cleanup does not reset any allowance or repeat an effect.
Undo and recovery: Revert to the matched prior source/declaration/publication; preserve journal and host custody. The old code may resume its known repeated-close crash, so keep the desk's exact hotfix available. Never edit live records or synthesize missing reservations.
Multi-machine posture: The journal's existing owner and replication remain authoritative. Host custody and runs.jsonl are deliberately machine-local process records under that owner's lease. No new cross-machine owner, grant or store.
Team posture: Diagnostics remain in the existing operator/host run-log and stderr surfaces; no teammate messages or private input are added. Existing ownership, access and sharing remain unchanged; credential scrubbing applies before recording.
Layer below: Actual journal snapshot/restore and compaction verifier, retained live SessionWorkEdge/Close history, port retirement/replacement persistence, ordinary-lane eight-failure latch, encrypted custody and durable appendRun/readRuns. The real launcher fault injection tests the exit row and stderr, not only a helper.
Bug class: integration
Bug evidence: reproducer=tests/assembly/production-conversation-session.test.ts
Hook bypass: none
Convergence: none
Prompt review: No model prompt, output parser, semantic acceptance or delivered reply changed. Existing prompt-text findings below are unchanged protocol/notice contract assertions. Recorded model-shape replay is inapplicable to this lifecycle and diagnostic repair.
Decision: session-close-tolerant-1112-A | Writer evidence rejects snapshot loss; retain exact refusal tolerance as uncertain custody, contain errors at the existing runner boundary, and preserve the journal's strict duplicate-close refusal. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/session-close-tolerant-1112-PROGRESS.md

1.x comparison: Actual JKHeadley/instar main 72dfe3a52b8cfe7a2ebed131b7acfc332f4c02f0 verified with ls-remote. Searched src/, docs/specs/ and history; read src/core/ReplicatedJournalCompactor.ts, src/core/StateManager.ts, src/commands/server.ts cleanup paths and docs/specs/unified-session-lifecycle-robustness.md; inspected history ab26b7ca3 and SessionManager commits 05b50438e/c825f2075. ONEX-LESSONS.md lines 37–60 covers recovery and diagnostic lessons. Reuse whole-projection compaction verification and observable nonfatal cleanup design. Its HLC/JSONL compactor and tmux lifecycle do not fit 2.0's typed liability ledger, so no code transplant fits. The existing 2.0 snapshot already checks the entire restored projection, proven through actual threshold compaction and reopening.

Root cause: retire() clears claim (production-conversation-session.ts:271–279); close() then falls back to state.edge.id (635). replace() resets close but retains reserved/edge (380–395). A later retirement/lifetime close can therefore submit an already-closed parent. The real journal reproducer fails on unchanged e3cb0f08 and passes with the repair. A persisted journal close followed by interrupted host persistence is also tolerated. Live retained history includes multiple closes of parent conversation-564f873579e900b5a1e665bc92cdaee0-242:edge, while the snapshot still holds 17 open edges. Exact refused ids from the nine suppressed failures are unavailable after the live hotfix renewed custody; the report distinguishes this limit from the reproduced cause. train-240/243 have identical session-port code. Strict new-close validation arrived in bad8f544baf17e26935b8608b7868faa4adad779; replay retains prior accepted rows.

Snapshot result: snapshotOf at journal.ts:2037 and restoreSnapshot:2066 already preserve activeSessionWork; actual 8 MiB compaction/reopen/close passes unchanged product, and a second close is still refused. No snapshot schema or migration change.

Publication: Native contract passed 10/10 after mechanical renewal to sha256:07561228d25df881bfc62134aeef0ad9a04538e5a42226e7f59ca7fbe2b8472e. Rebuild confirmed the same bytes; register replay uses source commit 25ecc6c8c051e2c923d94bd09d363e910a42c1c7. Product diff is 70 executable lines (55 additions, 15 deletions), plus 2 declaration lines; tests, review and generated publication are measured separately.

Validation: Foreground, nice -n 10, one file and --maxWorkers 1 per Vitest run. Exact commands, final results, measured product lines and pushed custody are in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/session-close-tolerant-1112-build-report.md. The native certificate is renewed only by the Studio's passing contract tool, followed by existing register regeneration.
Prompt finding: 0725f0150c56 | protocol-literal | Unchanged delivered instruction or notice text asserted by existing fixtures; no phrase-based semantic gate added or modified.
Prompt finding: 105c1569b6bb | protocol-literal | Unchanged delivered instruction or notice text asserted by existing fixtures; no phrase-based semantic gate added or modified.
Prompt finding: 27d7720e7977 | protocol-literal | Unchanged delivered instruction or notice text asserted by existing fixtures; no phrase-based semantic gate added or modified.
Prompt finding: 4106b49fff07 | protocol-literal | Unchanged delivered instruction or notice text asserted by existing fixtures; no phrase-based semantic gate added or modified.
Prompt finding: 7ef11b68103f | protocol-literal | Unchanged delivered instruction or notice text asserted by existing fixtures; no phrase-based semantic gate added or modified.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged delivered instruction or notice text asserted by existing fixtures; no phrase-based semantic gate added or modified.
Prompt finding: 85544c20941f | protocol-literal | Unchanged delivered instruction or notice text asserted by existing fixtures; no phrase-based semantic gate added or modified.
Prompt finding: 9f0106c66027 | protocol-literal | Unchanged delivered instruction or notice text asserted by existing fixtures; no phrase-based semantic gate added or modified.
Prompt finding: bac6ce7485d9 | protocol-literal | Unchanged delivered instruction or notice text asserted by existing fixtures; no phrase-based semantic gate added or modified.
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged delivered instruction or notice text asserted by existing fixtures; no phrase-based semantic gate added or modified.

simplestRobustRoute: Existing journal, custody, ordinary-lane and run-log owners suffice. One shared exact refusal constant preserves strict journal admission while reconciling host cleanup; one maintenance catch prevents the eight-failure lane latch from killing reachability. Redacted diagnostics explain future faults. Start guards are unchanged ownership, stop and reservation; end guard is one durable journal settlement with uncertain local refusal preserved; limits remain unchanged. This is the simplest robust route; no new timer, reservation, store or model call. No autonomous completion claim beyond the recorded reproducer and launcher test.
80/20: Real-writer compaction and lifecycle evidence first, exact-refusal neighbors, repeated maintenance faults through the real ordinary lane, actual launcher exit recording, direct consumers, native contract and mandatory final READY checks. The pipeline owns the full suite and independent review.
VERDICT: author submission; independent desk owns landing approval
