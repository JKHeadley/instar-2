# Change review — actual elapsed continuity and unsupported boundaries

Subject base: 462052e38d84286a8243c7b143e5a6b0ba59e46b
Review state: open
Reviewed content: none
Outcome: Require elapsed stage spacing from durable actual intent timestamps; capture evidenced unsupported boundaries as metered outcomes without dispatching prompts, allowing other setups to continue.
Affected rules: Purpose constraint 3; Rules 1, 26, 35, 37, 39, 42, 49, 70, 74, 75, 95, 101, 102, 113, 116.
Affected floors: secrets — host custody unchanged; spend cap — preparation/boundary costs still metered and accumulated; stop — existing pre-dispatch and host stop remain; no duplicate sends — unresolved intents still refuse replay; durable intake — intent and capture ordering unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Two deterministic measurement defects in the staged runner and injected adapter, with real adapter plumbing exercised under injected hosts; no deployed model prompt or parser changes.
Side effects: A late campaign must wait its actual stage-day gap. Unsupported boundary rows now reach capture and independent grading, cannot pass correctness, and retain preparation costs. No serving runtime or live account changes.
Undo and recovery: Revert this repair commit to restore prior code; retain experiment evidence. Reconcile unresolved intents against host receipts without resending. A spacing refusal writes no new intent and is retryable when actually due.
Multi-machine posture: Deliberately machine-local measurement ledger with one writer. Actual placement verification remains unchanged; moving the runner requires its complete ledger. No shared runtime state added.
Layer below: Read the complete purpose and rule book, identical to origin/main; existing intent/capture/grading path, actual-boundary checks, README host contract and 1.x .dev/instar/src/core/LiveTestHarness.ts DriverCapabilityError/blocked-outcome distinction. Port the small explicit capability-outcome contract, not the large module or live configuration.
Bug class: integration
Bug evidence: reproducer=tests/harness-tax/runner.test.ts
Hook bypass: none; core.hooksPath unset and shared hooks directory contains sample hooks only, inspected before commit.
Convergence: none
Prompt review: No model prompt, reply parser or semantic grading rule changed. Existing archival replay test remains exercised; these repairs change deterministic timing and host-capability evidence admission only.
Decision: harness-tax-repair-elapsed | Require the catalog day gap from the preceding actual durable intent for each task/setup, retaining calendar admission and compressed stub mode. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/harness-tax-1021s-repair-152736-PROGRESS.md
Decision: harness-tax-repair-unsupported | Accept only explicit unsupported state with actual:false, receipt and reason; skip prompt dispatch/collection but preserve metering, capture and grading. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/harness-tax-1021s-repair-152736-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: use existing durable intent timestamps for elapsed spacing and the existing unsupported result pipeline for evidenced capability limitations. The former prevents compressed catch-up masquerading as days; the latter prevents a known pre-dispatch limitation becoming ambiguous intake. No service, scheduler, authority or ability restriction is added. Isolation, floor checks, finite limits and unresolved-intent refusal remain; targeted injected-host results establish plumbing behavior only, not live model performance.
80/20: Repair both measurement failures at source, test both neighboring outcomes, run portable targeted and required static checks, and leave independent review and live campaign evidence to the desk.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
