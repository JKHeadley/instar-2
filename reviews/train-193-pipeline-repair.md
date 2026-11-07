# Change review — finalize shared refusals and separate assessment tests from transport expiry

Subject base: 65d2ab651aaf68b3f0122fb57f96646799187c32
Review state: open
Reviewed content: none
Outcome: Record a definite refusal for every successfully admitted send claim that is stopped or cancelled before physical dispatch. Make the assessment identity matrix reach its intended assessment boundary despite a response slower than the old 100ms transport budget.
Affected rules: 26, 31, 32, 34, 37, 42, 49, 60, 61, 63, 70, 74, 101, 102, 111, 112, 113, 116
Affected floors: secrets — existing custody unchanged; spend cap — reservations and exposure unchanged; stop — still prevents dispatch and now records its refused outcome; no duplicate sends — original claim stays consumed; durable intake — existing replication and cursors unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: critical
Tier rationale: The shipped journal launcher finalizes shared authority claims, although its source is under tests/preview.
Side effects: Post-claim refusals now enter the existing bounded outcome call and its retained flush queue. An exception after admission remains unknown. No claim is refunded or replayed. The assessment matrix declares a 2000ms fixture budget using the existing admission option; this changes no product limit or test timeout. Complete captured receipt is required before mutating evidence. Injected 150ms responses expose the old short-budget mismatch without CPU load. Existing 90ms/100ms timeout controls remain unchanged.
Undo and recovery: Revert the four source/test paths and regenerate source pins/register. No migration or history rewrite is required. Already unresolved claims remain unresolved and cannot be resent by this change.
Multi-machine posture: The original shared authority receives exactly one refused outcome for a successful claim even when cancellation, stop or ownership loss arrives in flight. The real two-runner test checks authority records, local refusal evidence and physical sends; original delayed-transport takeover variants are retained. The HTTP assessment fixture remains local test-only evidence.
Layer below: Read shared admit/outcome/flush semantics and journal-agent post-claim send guards, the authority log and existing cancellation regression from e6c6885e5. Read providerFixture route.invoke, admittedTimeout propagation, AbortSignal.timeout and localProvider request recording. A transport timeout before server receipt is not evidence that the assessment matcher failed.
Bug class: integration
Bug evidence: reproducer=tests/preview/two-machine-runner.test.ts; tests/integration/model-provider-refusals.test.ts
Hook bypass: none; core.hooksPath unset and shared hooks directory contains sample files only.
Convergence: none
Prompt review: No model prompt, output parser, judgment acceptance/escalation/refusal policy or provider choice changes. The imported bounded model barrier only controls timing and returns the existing bytes. This repair changes transport outcome recording; no model-shape replay is claimed or required.
Decision: train193-finalizer | Reuse e6c6885e57a50fc53c0c3df5b37716946d316aae finalizer, barrier and regression/accounting hunks while retaining train-193 delayed-transport takeover coverage; no broader train merge. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-193-repair-PROGRESS.md
Decision: train193-provider-budget | Give the assessment matrix its already-supported 2000ms admitted fixture budget and prove a complete receipt under a 150ms injected slow response before mutation, preserving strict timeout controls. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-193-repair-PROGRESS.md
Decision: train193-verification | Run only touched test files with nice 10 and one worker, tsc and required cheap checks; pipeline owns the full suite and independent repair judgment. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-193-repair-PROGRESS.md

Decision: train193-repin | Run the delegated desk tools (no owner/inventory changes required), then regenerate the register from committed source to refresh the launcher wiring pin. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-193-repair-PROGRESS.md

## 1.X FIRST

Inspected JKHeadley/instar origin/main 91b5bca55c7b182bd51e5d7faf9f200ba34aeb75: src/messaging/FencedOutbox.ts (lease/epoch checks and explicit suppressed outcomes), src/threadline/honestDeliveryWiring.ts (records relay verdicts; timeout remains unconfirmed), docs/specs/a2a-honest-delivery-outcomes.md, docs/specs/delivery-reliability-recovery-hardening.md and docs/specs/outbound-timeout-408-ambiguous.md. Searched src/ and docs/specs/ for timeout/refusal/abort patterns, and history 2de153810 and ab26b7ca3. Read ONEX-LESSONS.md section 3, Telegram delivery. Fit: retain known refusals and never infer non-send from timeout. Mismatch: these inspected owners do not implement this 2.0 shared-claim protocol or HTTP assessment fixture. Reuse the existing 2.0 e6c6885e5 finalizer and 9ba065757 admittedTimeout option; no 1.x code import or new protocol is needed.

## Verification

Controlled pre-repair failures: injected 150ms HTTP response with old 100ms budget yields uncertain instead of complete; real two-runner cancellation leaves held-notice:telegram:12345678:update:1 unresolved with two claims and one physical answer. Both red controls are retained in the desk progress record. Provider refusal file passes all 18 cases after repair, including all nine identity mutations and unchanged timeout, exposure, no-retry and final-zero controls. Exact-source callback replay also passes cancellation, stop and lost ownership, each with exactly one refused outcome and zero sends. Typecheck and architecture pass. The real two-runner file passes 9/9 (235.68s), including the retained 0/4500ms takeover and 0/1500ms stale-owner variants and the cancellation regression. All six post-claim callback refusal controls pass. Cheap-check results are recorded in the desk progress.

simplestRobustRoute: This is the simplest robust route: extend the existing finally over post-claim exits and use the existing admitted fixture budget to test the intended assessment boundary. No added runtime mechanism, guard weakening, ability reduction, retry, quarantine or test timeout increase. Independent and full-suite qualification remain with the pipeline; no installed/live acceptance is claimed.
80/20: Repair the one demonstrated outcome omission and the one timing-dependent fixture setup at their existing seams. Preserve browser/volume work, all five floors and inherited CB6-MF-A, CB7-R90 and CB1-MF5 obligations.
VERDICT: author submission; no independent verdict or deployment acceptance claim
