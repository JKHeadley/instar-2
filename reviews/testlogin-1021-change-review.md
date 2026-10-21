# Change review — Reserve operator logins before test launch

Subject base: 52ead9423d978a2061f7fc32e8d53e0befc32960
Review state: open
Reviewed content: none
Outcome: A reusable test-launch preflight refuses an operator-reserved account before starting a copy, proof room or answer check. It checks real account metadata and every configured fallback, including retained admission metadata. The Studio desk installs the same bytes in its existing launch paths, keeps answer checks on the separate proof-room profile, and reads the existing 1.x quota route in its driver pass to warn at 80% before the 95% cutoff.
Affected rules: Rules 1, 4, 15, 26, 30, 35, 42, 49, 52, 55, 74, 101, 103, 111, 113 and 116; purpose coherence, granted scope and least revelation.
Affected floors: secrets — only non-secret profile metadata is read and raw parser errors are withheld; spend cap — no model call or cap change; stop — existing runner stop behavior unchanged; no duplicate sends — no sends or retries added; durable intake — preflight precedes runner startup and existing journals are not changed by the guard.
Operator questions: none
Suggested tier: standard
Declared tier: standard
Tier rationale: Exact enforcement of the operator's explicit test-account restriction in a physical launch preflight; no model prompt, model parser, application authority or delivery path changes.
Side effects: A copy whose selected pool includes a reserved member refuses even if that member is currently held. Missing metadata also refuses rather than assuming capacity is safe. A separate test login can pass this restriction while still exhausted; this check grants no capacity. Desk launchers and their supervisor configs receive a preload that performs the same check before the runner body. No live runner is restarted or modified by this unit.
Undo and recovery: Restore each edited desk file from its named pre-edit backup, recorded under the absolute lanes/testlogin-1021/backups.json path, and revert this commit if the reusable checker is withdrawn. Keep captured quota and refusal evidence. No journal rollback, credential replacement, resend or account mutation is needed.
Multi-machine posture: Guard source ships in the repository; policy, test launchers and alarm deduplication state are deliberately local to the Studio desk that owns these tests. The existing 1.x pool remains quota authority. No new cross-machine account pool, collector or background service is introduced.
Layer below: Read the constitution in full, inspected actual profile metadata and installed-vs-explicit login precedence, answer-check inventory copying, hostwatch command generation, 1.x SubscriptionPool/ProactiveSwapMonitor/QuotaTracker and its quota route. Actual route bytes were replayed with injected thresholds and time. Actual Codex CLI is 0.156.1 while the preview answer doorway requires 0.149.1; pure activation validation proves the mismatch. No compatibility or usable-test-capacity claim is inferred from the presence of a registered doorway.
Bug class: integration
Bug evidence: reproducer=tests/preview/check-test-login.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains only sample files.
Convergence: none
Decision: reserved-login-preflight | Enforce the explicit operator restriction by account identity and pool account ID, not filenames or current holds; preserve plain nonzero refusals. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/testlogin-1021-PROGRESS.md
Decision: separate-test-login | Remove live-inventory inheritance from the forum answer check; use the proof room's separate profile and exact per-build records. Codex deployment is unavailable on today's reviewed pin; report its smallest repair as the task permits. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/testlogin-1021-PROGRESS.md
Decision: existing-quota-route | Reuse the existing driver signal pass and GET /subscription-pool/adriana/quota, with finite timeout, freshness checks and one warning per quota window/reset; no new collector or polling daemon. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/testlogin-1021-PROGRESS.md
Prompt review: No model prompt, model-output parser, judgment selection or accept/escalate/refuse policy for model output changes. Observer 106 model-output replay does not apply; real non-secret profiles and actual quota response bytes are the relevant recorded shapes.

simplestRobustRoute: This is the simplest robust route: one account preflight reused by existing desk launchers and one quota read in the existing driver pass. The guard prevents the observed live inventory from spending Justin's last usable login in a test. A start-only filename check misses renamed profiles and held fallbacks, so identity and complete inventory are checked. The desk preload checks the actual command before the runner loads. Existing authority, budget, stop, intake and send boundaries remain in charge. Verification uses real metadata without invoking a model or sending test traffic; no unattended model-completion claim is made.
80/20: Targeted checker tests, actual profile refusal/admission, real quota replay with injected thresholds/clock, exact desk wiring and syntax checks, and required final READY gates. Independent review belongs to the desk.
VERDICT: author submission; no independent convergence claim
