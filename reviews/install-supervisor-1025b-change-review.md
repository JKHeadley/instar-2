# Change review — bounded setup supervisor

Subject base: b741dc259045a983f8eaef36e728428099a8ddb1
Review state: open
Reviewed content: none
Outcome: Build the gated four-step setup supervisor with current owner checks, decision-only model validation, durable resume and Linux bounds. Ordinary installation remains unqualified and cannot call the new route.
Affected rules: 1, 4, 5, 13, 26, 28, 32, 34, 36, 38, 41, 42, 49, 55, 57, 58, 60, 65, 67, 70, 74, 75, 95, 100, 101, 102, 108, 111, 113, 116
Affected floors: Secrets never enter the supervisor; spend cap remains zero with no paid model or provider fallback; durable stop checked before and during validation; stable operation identity plus durable dispatch intent prevents duplicate effects; existing durable setup publication and Seven capture reservations preserve intake and evidence.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: New critical preparation orchestration and model-output consumption, held behind release qualification.
Side effects: Adds installation-local setup-supervision checkpoints and bounded model audit captures. Merges the named prepare-login prerequisite without reimplementing it. Ports the existing Linux runner and restricts its writes and network. An old broker lacking the setup-owner protocol refuses; no key custody, GE/A0 or operator authority is manufactured.
Undo and recovery: Revert this additive component while retaining its checkpoint and Seven evidence files. No ordinary installer consumer is enabled. A resumed attempt reconciles current owners, pins and stop; dispatched uncertainty never creates another operation. A dead writer requires a proved-gone PID; ambiguous ownership holds.
Multi-machine posture: Deliberately installation-local preparation and inference. Shared authority stays with current owners; no peer demand is lowered. Captured evidence travels through the existing evidence/review path.
Layer below: Read the 1.x setup-wizard state-machine validate/action/next shape, 2.0 onboarding-state fsync/no-replace publication, prepare-login, custody-platform interface, One/Two custody and fact ownership, Six transport and Seven ModelAdapter/capture contracts, and the Linux qualification runner. Primitive replay evidence is not installed-owner qualification. The read-only broker needs the declared setup-owner operations from its owning implementation before distribution.
Bug class: none
Bug evidence: none; new gated capability, with failing behavioral tests before implementation
Hook bypass: none
Convergence: none
Decision: supervisor-1025b-D1 | Reuse the finite wizard shape and existing owners; checkpoint dispatch separately from model validation and reconcile rather than repeat uncertain work. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-supervisor-1025b-PROGRESS.md
Decision: supervisor-1025b-D2 | Consume a closed decision-only JSON contract, show fixed owner-check text, and retain raw responses through Seven; the changed contract inherits no release qualification. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-supervisor-1025b-PROGRESS.md
Decision: supervisor-1025b-D3 | Port the existing Linux cgroup runner, enforce a read-only filesystem with one writable root and no network, and recheck signed artifact and actual loader-library pins. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-supervisor-1025b-PROGRESS.md
Decision: supervisor-1025b-D4 | Use host-visible temporary roots for physical systemd proofs; the test framework's private RAM namespace is not a valid systemd working directory. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-supervisor-1025b-PROGRESS.md
Skip: tests/assembly/setup-supervisor-linux.test.ts:36 | scope=Physical Linux cgroup proof requires explicit host opt-in; run with INSTAR_SETUP_LINUX_PHYSICAL=1 and passed in this unit.
Prompt review: The new prompt asks whether all required typed owner checks establish the step, without expected verdicts, case labels, arbitrary observations or free-text authority. The output schema permits accept and hold; only the closed field drives consumption. Recorded summaries, uncertain/undecided Jev verdicts, reply reviews, delivered replies and an empty candidate replay through the new decoder and hold. Historical setup outputs retain their old shape and are refused by the new contract; no changed-contract model adequacy is claimed.
Validation: Initial behavioral tests: 10 failed and 3 passed before implementation. Targeted tests cover all four steps, resumable model holds/unavailability/deadlines, stop, changed bindings/frontiers/pins, malformed receipts, credential fields, path escapes, unknown effects, broker wiring, and actual Seven/Six dispatch/captures. Physical Linux tests exercise success, hard cgroup bounds, timeout, memory refusal, unavailable executable, stop and inside/outside-root writes. Exact final check outcomes and host-specific limitations are in the handoff report.

## ELI16

Setup checks each piece of work twice: before doing it, and after checking what really happened. The small local model can say to pause, but it cannot grant access or overrule a failed owner check. If setup pauses after doing something, it remembers that and checks the same work again instead of doing it twice. Real installation remains off until the complete route earns qualification.

## UX Impact

One fixed plain status explains that setup paused and kept its progress. Named checks say passed, failed or not observed; model-written explanations never become instructions to the person. No new credential prompt, model-selection screen, approval action or automatic retry is introduced. The owning installer repairs the cause; the person does not interpret model output.

## Closing block

simplestRobustRoute: The required outcome is bounded supervised preparation with owner authority intact. This is the simplest route: a four-step validate/action/validate loop over existing owner and Seven ports, using existing durable publication and the proven Linux runner. Distinguishing dispatched from validated prevents a real duplicate-append failure after a post-step hold. Closed projection and decision parsing prevent untrusted prose becoming authority. The filesystem namespace prevents a model child writing outside its declared root. Start guards are prepared login, current owners, stop and qualified pins; end guards are current owner results plus model acceptance for all four steps; limits are eight validations, twenty minutes, 120 seconds per call and the 3-GiB cgroup profile. The temporary-root path runs unattended with a stub qualified route; no unattended installed release is claimed.
80/20: Submit the gated component and explicit qualification boundary for independent desk review. This is author evidence, not self-convergence or permission to distribute the unqualified route.
VERDICT: author implementation submission; independent gate and installed-route qualification required
