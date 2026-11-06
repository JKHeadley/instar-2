# Change review — Cartographer public composition and gate regression repair

Subject base: c59fe270365717d918206d91ac92acbc1fbfdbb0
Review state: open
Reviewed content: none
Outcome: Compose Cartographer through public module exports and align regression tests with durable recovery and expiry, while keeping register CLI child work responsive.
Affected rules: 26, 34, 37, 42, 55, 70, 74, 95, 101, 102, 107, 111, 112, 113, 115, 116
Affected floors: secrets — existing path and content checks retained; spend cap — no model routing change; stop — expiry boundary asserted; no duplicate sends — UNKNOWN never retried; durable intake — original journal and recovery records retained.
Operator questions: none
Suggested tier: significant
Declared tier: ordinary
Tier rationale: Export-only production boundary repair and test corrections; no new authority, feature, prompt, storage or routing policy.
Side effects: Cartographer publicly exposes its existing path and credential predicates. Assembly imports those exact implementations. Tests recognize durable delayed recovery, preserve UNKNOWN and terminal-refusal controls, and distinguish a valid-grant restart from expiry. One register matrix uses its existing async child helper with bounded children and the adjacent matrices' 120-second deadline.
Undo and recovery: Revert this repair and its generated register together. No live installation, state migration or external send occurred.
Multi-machine posture: Public composition is portable; runtime shared ownership and journal behavior are unchanged. WSL supplies targeted evidence; Studio owns the full gate and native macOS byte-bound certificate.
Layer below: Checked Cartographer public index, Awareness public index, inspectAssemblyCore, journal dispatch/recoveryDelay/needsDeliveryNotice and expiry gate, plus the existing async-child helper and register committed-source checks. The original gate records 74.197 seconds in a 60-second blocking CLI matrix; async subprocesses remove that matrix's worker-IPC starvation hazard, without claiming that the unattributed RPC error is conclusively traced to it.
Bug class: unit
Bug evidence: reproducer=tests/preview/phase-timing.test.ts
Hook bypass: none
Convergence: none
Prompt review: No model prompt, output parser or admission policy changes. Reminder tests retain their recorded update 840342823 and existing summary/Jev/review/empty-output replay controls.
Decision: C95R081429-public | Re-export the existing Cartographer predicates and use public indexes; do not whitelist private edges or weaken the architecture checker. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-95-cartographer-1105-repair-081429-PROGRESS.md
Decision: C95R081429-recovery | Assert the current delayed recovery queue and retain separate UNKNOWN and terminal-refusal notice controls. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-95-cartographer-1105-repair-081429-PROGRESS.md
Decision: C95R081429-expiry | Verify restart deduplication immediately before grant expiry, then assert UNKNOWN reconciliation stops at expiry without another send. Do not extend the grant. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-95-cartographer-1105-repair-081429-PROGRESS.md
Decision: C95R081429-children | Reuse async-child for the six CLI calls and match adjacent 120-second matrix deadlines; each child remains bounded at 60 seconds and every assertion remains. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-95-cartographer-1105-repair-081429-PROGRESS.md
Decision: C95R081429-pins | Use the desk's supplied rehash/repin tools and committed register replay for derived hashes; native macOS conformance remains a Studio contract obligation. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-95-cartographer-1105-repair-081429-PROGRESS.md

1.x comparison: Inherit the Cartographer research in reviews/carryover-95-cartographer-1105-change-review.md and its repair-1601 record: JKHeadley/instar assigned revision 4f88880a45f0a119aae3cfd2ccaf9ace26d405b9, inspected main 154a09ffd, history 2aaac4288, src/core/CartographerTree.ts, CartographerSweepEngine.ts, cartographerSummary.ts, docs/specs/CARTOGRAPHER-DOC-FRESHNESS.md and CARTOGRAPHER-SUBTREE-NAV.md, and ONEX-LESSONS memory/coherence. Preserve the existing adapted algorithms and source/custody/Awareness composition. The public-export boundary is 2.x-specific; no new product transplant is needed. Recovery inherits a8af8bff7ffd78dcdb2e032b216d22274141c44e src/monitoring/delivery-failure-sentinel/recovery-policy.ts via tests/preview/delivery-recovery.ts. Infrastructure comparison inherits repair-2257's main 028483097cb0a835a7d1264680a44dc4c2acb063 search of src/core/hostTestRunnerSemaphore.ts and docs/specs/test-runner-concurrency-bound.md (histories 618560b3e, c91b8780e); the 2.x existing async-child helper addresses this worker IPC hazard directly.

Verification: Build and typecheck passed. Targeted consumer checks passed: 12 phase-timing, 26 reminder-truth, 12 Cartographer production-source and 22 public-boundary tests; the selected register committed-bridge matrix passed in 96.443 seconds with no runner errors. The prior two-test preview reproduction is retained as red evidence. Desk rehash/repin tools found no changed manifest or inventory hashes; generated register replay binds commit 98e0a828491c8b5d3b380a5086ec492e08634e66. Native macOS R105 conformance is reported separately, never rewritten as a pass.

simplestRobustRoute: Use existing public indexes, current journal semantics and the existing asynchronous child helper. No runtime retry, expiry or authority change, no new scheduler and no test quarantine.
80/20: Repair the reported causes with targeted positive and negative controls; retain the native and full-suite obligations for the owning Studio gate without manufacturing evidence.
VERDICT: author submission; no independent convergence claimed
