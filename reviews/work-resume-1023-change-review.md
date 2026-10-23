# Change review — bounded worker-loss restoration

Subject base: b61926b0d8867d2b4e8ca01beb34b4ca0dc64f03
Review state: open
Reviewed content: none
Outcome: restore one tool-free accepted turn after its worker exits, using the existing pending-turn adapter path and retaining exact intake, original deadline and remaining allowance.
Affected rules: 1, 4, 26, 29, 30, 34, 36, 42, 46, 49, 55, 60, 61, 63, 68, 70, 74, 96, 101, 102, 107, 111, 113, 114, 116
Affected floors: secrets — no credential or outward-field changes; spend cap — replacements draw on the same parent reservation and retain its deadline; stop — guard rechecks before replacement and after asynchronous admission; no duplicate sends — no new send and no restore after any tool preparation, unknown effect or unknown send; durable intake — exact accepted delivery remains in custody, with a durable one-attempt marker before replacement.
Operator questions: none
Suggested tier: significant
Declared tier: critical
Tier rationale: autonomous recovery changes when a tool-bearing session may restart; all safety neighbors must remain held.
Side effects: a confirmed exit during an eligible single turn now replaces its worker once instead of immediately returning uncertainty. Failed physical process probes now throw instead of masquerading as absence. Adapters must advertise pendingRestore; native resume alone is not equivalent. Batched work, host-crash uncertainty, completed tool actions and adapters without exact pending restoration retain their existing uncertain outcome.
Undo and recovery: revert this change; old readers ignore the optional workerRecovery field. Retain durable input, call accounting and attempt evidence. Do not manually resubmit an uncertain operation. No queue, watcher, grant, limit or store-version migration is introduced.
Multi-machine posture: the existing conversation ownership fence remains the sole writer and actuator authority. Recovery changes only that owner's local worker; the same durable parent edge, input and cumulative accounting remain. No remote spawn, lease transfer or replica-policy change.
Layer below: read Instar 1.x main d5b30b1d7c059da68483caf15d7584aec0d7a325 ResumeQueueDrainer drain-time validation, AutonomousLivenessReconciler guards, PendingInjectStore and SessionManager recovery, and the server reap-notify enqueue path. Reused their bounded recovery, exact custody and current-world validation through the existing 2.0 host and public adapter. Checked the real driver's exact accepted-delivery restore, one-submission journal, original deadline, authenticated turn receipt, and resource release. Fixed the physical probe's null-status-to-absence conversion because an indeterminate probe cannot authorize revival.
Bug class: integration
Bug evidence: reproducer=tests/assembly/production-conversation-session.test.ts
Hook bypass: none
Convergence: none
Decision: resume-existing-pending-turn | reuse the existing pending restore once on confirmed worker exit with zero post-dispatch tools; do not create a second recovery queue or replay uncertain effects | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/work-resume-1023-PROGRESS.md
Decision: resume-adapter-capability | require affirmative pendingRestore support rather than treating native resume as exact accepted-turn restoration | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/work-resume-1023-PROGRESS.md
Decision: resume-probe-uncertainty | preserve failed or signalled physical probes and unexpected exit statuses as indeterminate instead of declaring the worker dead | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/work-resume-1023-PROGRESS.md
Prompt review: no prompt bytes or semantic parser changed. Restored input is byte-identical. Recorded work output obligation:commitment:0:1792042495116 and recorded summary 715672480, summary-uncertain 715672483, Jev undecided 715672482, Jev unsure 969389570, reply-review 969389923, delivered reply 715672479 and empty candidate 715672550 traverse the new recovery boundary. Empty output stays uncertain; a returned verdict is preserved verbatim, never reinterpreted as approval. Fixture provenance is retained in work-recovery-2026-10-15.json and retrospective-duty-followup-train-1-2026-10-08.json. The replay is not a new live model or Telegram proof. The existing cross-adapter descriptor assertion is updated to include the explicit pendingRestore capability; all 14 tests in that importer pass.
Prompt finding: 0725f0150c56 | protocol-literal | unchanged application response contract, asserted as protocol wording rather than a semantic decision rule
Prompt finding: 27d7720e7977 | protocol-literal | unchanged grounding heading; no added model keyword gate

simplestRobustRoute: this is the existing conversation owner's pending-turn restoration, with one durable attempt marker and no new scheduler or store. A live child, stop, withdrawn grant, unknown effect/send, post-dispatch tool or exhausted budget excludes recovery. Exact accepted input and original deadline enter the existing adapter. Explicit adapter support prevents a silent launch without pending input; preserving probe uncertainty prevents duplicate revival after a probe failure. The end state is a correlated bounded reply and turn end, or retained uncertainty. Recorded-output tests and simulated physical loss demonstrate wiring; no unattended live outcome is claimed.
80/20: implement and verify the tool-free single-turn loss slice; do not broaden to uncertain effects, batched interrupted turns, or host loss during restoration.
VERDICT: author submission; no independent convergence or live-completion claim
