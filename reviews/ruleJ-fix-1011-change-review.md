# Change review — self-host CLI durable stop and idle lifetime proof

Subject base: ba91e2bd0f959f401c71b0bbfcad37f3cd6c5068
Review state: open
Reviewed content: none
Outcome: A durably stopped self-host CLI reports stopped: true before reading provider inputs or constructing its doorway, retains exit 1, and records its stopped phase. The launcher-death fixture waits on a bounded timer instead of spinning.
Affected rules: 2, 4, 26, 34, 35, 42, 55, 60, 70, 74, 101, 104, 107, 108, 113, 115, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake remain enforced. The early stopped path creates no provider attempt, release or recovery launch.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: CLI ordering fix at the existing exact durable stop boundary; no prompt, parser, model judgment or authority change.
Side effects: stopped runs append a stopped phase and emit JSON even when provider files are unavailable. Clear runs keep the existing activation and provider validation. Composition certification and generated source pins must reflect the changed CLI bytes.
Undo and recovery: revert the CLI and test changes and refresh the composition/register pins. No journal schema migration. Desk J.sh and its activation have retained backups/predecessors under absolute lanes.
Multi-machine posture: machine-local deliberately; the CLI reads its own root's existing durable stop latch. No ownership, replication or transport change.
Layer below: stoppedAt and appendDurable, provider construction and owned dispatch, confined child wall clock independent of its launcher, composition certification and active package resolution.
Bug class: integration
Bug evidence: reproducer=tests/preview/self-host-cli-profile.test.ts
Hook bypass: none
Convergence: none
Verification: All five CLI/profile tests pass, including repeated latched runs with absent activation/profile files and no owner/release creation. All seven recorded real self-host answer-shape tests pass. The native contract initially identified the stale composition declaration; certification is refreshed and all ten contract tests now pass. Architecture and lint pass with no issues. Complete targeted and isolated live evidence is in the absolute lanes/ruleJ-fix-1011-PROGRESS.md record; no full suite is run on the Studio.
Live evidence: J's 19 targeted negatives pass, including the idle child deadline. The isolated November activation reaches owned dispatch and preserves the complete provider cause, but the provider rejects with failureClass=limit and resetAt=1791986400000. J5a/c pass; J5b/d fail; Rules 2/115 remain FAIL for complete live proof. No package was produced, so manual version-update and interrupted-activation checks remain blocked. A separate actual Node 24.14.0 runtime is unproven under the original declaration and passes all ten native contract tests after candidate re-certification in a scratch worktree. This is not a completed unattended capability-build claim.

simplestRobustRoute: check the existing durable latch before provider construction and reuse the existing report output, then prove clear and latched CLI states. Use the existing confinement wall deadline over an idle timer. No added service or decision mechanism. Start guards remain the activation, grant and durable stop; end guards are installed/probed packages and no provider attempt after stop. Isolated unattended shipped-path results are recorded in PROGRESS.
VERDICT: author submission; independent review pending
