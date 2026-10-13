# Change review — merge the reviewed deferral confirmation repair

Subject base: 0de16e3cdaea380ac746793123a51382aeb9830b
Review state: open
Reviewed content: none
Outcome: Merge reviewed unit a9a7a0d2a75dec910a9ae0dc58286400aa846945 onto the exact live train-18 base. The ordinary merge fast-forwarded without conflicts. Independent answers reserve without waiting for speculative memory judgments; rejected mutations retain their durable correction dependency. The unit source and its review record are carried unchanged. One test-only startup deadline repair is described below.
Affected rules: Purpose 2/3; Rules 4/8/10/14/26/34/36/42/46/57/63/66/69/70/74/77/83/86/87/90/95/101/102/111/113/116, as detailed in the carried reviews/deferral-confirm-delay-1013-change-review.md.
Affected floors: secrets — existing outbound check unchanged; spend cap — existing reservation and summary limits unchanged, no new model call; stop — existing reservation and dispatch gates unchanged; no duplicate sends — durable intents and receipts unchanged; durable intake — existing journal records retained, rejected-answer replay reconstructs its hold. The fixed prompt guard remains 22,959 bytes.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Carries the unit's critical tier for operator-visible answer admission and memory correction timing.
Side effects: The unit changes scheduling order between independent answers and background summaries. Admitted mutations remain authoritative across races; rejected mutations and edits retain their dependency. This build adds generated register publication metadata, this review, and a bounded startup allowance repair in the memory-correction test. Its status child took 10.398 seconds and returned null at the ten-second spawn timeout on the first run. Allow sixty seconds for that child and ninety for the test; retain every semantic assertion and include the spawn error in failures.
Undo and recovery: Revert the unit's worker changes and regenerate register publications. No journal schema or new store was introduced. Existing durable send receipts remain authoritative; never resend uncertain effects.
Multi-machine posture: Existing replicated journal and owner-gated worker unchanged. Test fixtures and fake clocks are machine-local deliberately. No new peer dependency or authority.
Layer below: Read the worker diff and the unit's review/report, including its pipeline repair. Answer-frame projection reconstructs rejection before the later hold append; pendingMemory distinguishes actual answer dependencies from speculative candidates; appliedMemory prevents a second mutation after an answer wins. Existing background summary scheduling, mutation validation, durable send receipts and intake remain the underlying mechanisms.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains only sample files. Ordinary merge and plain commits.
Convergence: none
Decision: sb-deferral-unit-merge | Merge the exact reviewed unit a9a7a0d2 onto live 0de16e3c; fast-forward with no conflict. Unit evidence is lanes/deferral-confirm-delay-1013-PROGRESS.md, including its copied repair report. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-deferral-confirm-delay-1013-PROGRESS.md
Decision: sb-deferral-desk-replay | Use the cint-L37 desk chain: inventory repin, TypeScript build, owner-manifest rehash, register replay at a9a7a0d2. Initial replay changed zero pins. After the bounded test-startup repair, rehash refreshes the one memory-correction artifact pin and the register is replayed at the repair commit; no owner reference is hand-edited. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-deferral-confirm-delay-1013-PROGRESS.md
Decision: sb-deferral-cold-status-bound | The first memory-correction test hit its ten-second status-child deadline; increase only that startup bound to sixty seconds and its enclosing test to ninety, retaining assertions and reporting spawn errors. Refresh the affected owner pin through the desk tool. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-deferral-confirm-delay-1013-PROGRESS.md
Prompt review: No new prompt wording, parser, classifier or model route. Carry the unit's summary candidate selection and admission changes, verified against its committed captured-output fixtures. No fresh provider or deployed latency result is claimed.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged fixed memory inventory response, not an intent classifier.
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged source-label provenance guidance, not a fixture-specific decision.

Publication evidence: The final register replay binds repair source 78a61795bb8ea60c123d658b4e74b27a9ab43d78 with generation sha256:0d9d31101066d1a1fcc768d51cb52363f0b530e45026de5e4206b7aaf0f057c1. Default-context-floor passed 6/6; measured text-only answer 22,518 bytes against unchanged 22,959 guard. Memory-correction passed 28/28 after the bounded startup repair. The initial register run overlapped that test edit and correctly refused the temporarily stale artifact pin; final register validation runs on the committed stable tree.

## Closing block

simplestRobustRoute: This is the simplest route: ordinary merge of the reviewed unit unchanged, followed by the established desk generation and checks. No new runtime mechanism. Authenticated durable intake, existing mutation validation and durable reply receipts hold the start and end conditions; existing secrets, spend and stop checks hold the limits. Recorded-output replay is builder evidence; deployment and fresh unattended live acceptance remain desk-owned.
80/20: Targeted changed tests, recorded-shape replay, default-context floor, register test and required readiness checks; no full suite or alternative-base worktree.
VERDICT: author submission; independent acceptance is not asserted here
