# Change review — native memory probe readiness

Subject base: 5f9862156140c029ca87f5eaf32c27d1f249ad09
Review state: open
Reviewed content: none
Outcome: Replace the feasibility probe's guessed exec delay with payload readiness over its existing worker channel; run all attribution controls even after a failure.
Affected rules: 26, 37, 49, 55, 60, 70, 74, 101, 102, 111, 112, 113, 116
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake retain their existing enforcement. Production guard deadlines, heartbeat lapse, memory installation/readback and memory verdict remain unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: ordinary
Tier rationale: Observation-only feasibility orchestration and a portable compiled-C regression. No production guard, policy, model or authority change; native verification still belongs to macOS.
Side effects: The outside-kill feasibility case now supplies an existing worker channel and waits for its final payload to report readiness. It keeps heartbeating and retains the immutable guard deadline. Later attribution controls execute even when an earlier one fails, so diagnostics never read skipped uninitialized controls.
Undo and recovery: Revert this repair commit; no durable data, signatures or installation migration changed. Any release packaging change still requires normal reviewed installation.
Multi-machine posture: Machine-local native observation, deliberately: process trace and exit facts belong to the host running the probe. Shared source and tests create no new replicated state or ownership path.
Layer below: Guard S report before gate release; bootstrap descriptor 3 and sandbox exec chain; guard SIGTRAP continuation; kernel exit-detail observation; exact unchanged memory_attributed predicate; existing strict native assertion.
Bug class: unit
Bug evidence: reproducer=tests/assembly/fixed-worker-feasibility-handshake.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory inspected, samples only.
Convergence: none
Prompt review: No model-facing input, parser or judgment change. Recorded model shapes are not involved in this native probe repair.
Decision: train-107-repair-052128-readiness | Use the existing channel for payload readiness, not a guessed delay or a larger deadline; keep all native verdict assertions and production guard behavior. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-107-repair-052128-PROGRESS.md
Decision: train-107-repair-052128-controls | Execute every attribution neighbor independently and initialize observations, preventing a failing first control from leaving later reports uninitialized. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-107-repair-052128-PROGRESS.md
Decision: train-107-repair-052128-evidence | Compile and exercise the actual feasibility driver on Linux with delayed, missing and invalid readiness plus a first-control failure; retain macOS kernel attribution as an explicit unrun check for the Studio. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-107-repair-052128-PROGRESS.md
Verification: Portable test executes the source C driver, demonstrates continued heartbeats across injected slow readiness, refuses to inject without readiness, and runs deadline/lapse controls after a failed outside-kill control. This does not certify Darwin ptrace, sandbox or memorystatus behavior.
simplestRobustRoute: This is the simplest robust route: one readiness byte over the existing worker channel removes the named race between a guessed sleep and the traced exec chain; independent control calls remove undefined diagnostics. No runtime guard rewrite, timeout increase, quarantine or removal of accepted formatting work. Existing guard lifetime bounds the waiting probe; no live autonomous-completion claim.
80/20: Repair only feasibility orchestration, retain strict native checks, execute portable regression and cheap gates, and hand the native check to its supported host.
VERDICT: author submission for desk gate; no independent convergence or native acceptance claimed
