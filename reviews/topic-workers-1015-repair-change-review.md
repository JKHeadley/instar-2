# Change review — topic worker admission repair

Subject base: 2471e307292aa5bbba0fb3e6b86f7e108a85d082
Review state: open
Reviewed content: none
Outcome: An exited worker or a topic waiting for a slot cannot launch without current measured headroom; refusal keeps its input queued until capacity returns. Renew native conformance on the repaired composition.
Affected rules: 1, 4, 26, 29, 34, 36, 37, 42, 46, 49, 60, 61, 63, 68, 70, 74, 75, 96, 101, 102, 105, 111, 113, 114, 115, 116; architecture R105.
Affected floors: secrets — existing custody/filtering remains; spend cap — existing shared liability and charging checkpoints remain; stop — existing guards before and after admission remain; no duplicate sends — refused work is never dispatched and completed input is not replayed; durable intake — refusal preserves queued input and original identities.
Operator questions: none
Suggested tier: significant
Declared tier: critical
Tier rationale: Repair a physical resource checkpoint and renew exact native harness conformance; retain existing authority and shutdown behavior.
Side effects: Capacity sampling moves from predictive prepareTurn to serialized resource admission after slot waits. Healthy resident turns still run without new capacity admission. A null resource lease now keeps queued work and existing liability instead of terminal uncertainty, clearing the unlaunched claim. Other prepareTurn users retain their quota handoff. Native declaration and replayed generated publication bind actual measured bytes; no ceiling, ability, prompt, or grant is narrowed.
Undo and recovery: Revert the repair together with its matching conformance declaration and regenerate publication; preserve durable queues, reservation and charges. Stop remains effective while waiting and no uncertain dispatched input is automatically replayed.
Multi-machine posture: Deliberately machine-local resource observations and worker leases under the existing conversation ownership fence. Durable parent edges, cancellation, result routing and replication remain unchanged.
Layer below: Inspected host observed-exit replacement, serialized topic admission and idle reclamation, physical lease refusal and release, shared allowance reservation, claim authority guards, stop during admission, durable dispatch/settlement and collection. Native contract exercises public ports, confined real tool execution, provider accounting and stop.
Bug class: unit
Bug evidence: reproducer=tests/assembly/conversation-topics.test.ts
Hook bypass: none; core.hooksPath unset, common hooks directory inspected and contains only sample hooks.
Convergence: none
Prompt review: No model prompt, parser or semantic verdict changes. Both targeted files replay actual recorded summary/uncertain, Jev undecided/unsure, reply-review, delivered and empty-reply shapes; capacity denial then dispatch preserves bytes. Review regressions independently fail on original code and pass with restoration neighbors after repair.
Decision: topic-workers-1015-repair-admission | Move measured capacity into serialized new-worker admission; retain the existing queue on null lease without dispatch, preserving claim preparation and its authority/stop guards. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/topic-workers-1015-repair-PROGRESS.md
Decision: topic-workers-1015-repair-certificate | Use the existing native renewal helper with real before/after contract evidence on this Darwin host, never a bare digest replacement. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/topic-workers-1015-repair-PROGRESS.md

Deferral: generated/register.json:1 | not-a-deferral=mechanically replayed register descriptions introduce no deferred work

simplestRobustRoute: This is the simplest robust route: relocate the existing capacity check to the existing serialized admission and propagate refusal via the existing durable queue. No new scheduler or restriction. Start guards are current capacity, ownership, authority and shared reservation; completion requires correlated turn evidence; stop, calls, process ceiling and parent lifetime remain enforced. The native contract passes 10/10 after renewal; this submission does not claim live four-topic acceptance.
80/20: Both reported races reproduced and repaired; 103 targeted tests, tsc/build and the native contract verify the change. Cheap publication/review gates precede push; the Studio pipeline owns full-suite and live acceptance.
VERDICT: author submission; no independent convergence asserted
