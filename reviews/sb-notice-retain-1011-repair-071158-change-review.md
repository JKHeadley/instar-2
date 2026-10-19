# Change review — capacity refusal result contract

Subject base: 6cce224130af9b6439ae833dd09272568b9edc94
Review state: open
Reviewed content: none
Outcome: The capacity refusal regression assertion includes the signal and cancellationReason fields introduced by termination diagnostics, retaining exact equality and the no-launch and later-admission checks.
Affected rules: Rules 26/37/42/49/60/70/74/101/102/111/113/116; purpose evidence constraint.
Affected floors: secrets — no runtime changes; spend cap — no runtime changes; stop — cancellation remains distinct from capacity refusal; no duplicate sends — no dispatch changes; durable intake — no storage changes.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Only an existing expected result object changes; no production behavior, prompt, parser, gate or capability changes.
Side effects: Exact equality now also rejects an unexpected signal or cancellation reason on capacity refusal. The marker absence, subsequent admitted marker write and refusal count assertions are preserved.
Undo and recovery: Revert this test-only commit. No state migration or runtime recovery is needed.
Multi-machine posture: Test-only, deliberately machine-local subprocess evidence; production ownership, replication and resource allocation are unchanged.
Layer below: Read resource-owner.mjs execute admission refusal and the neighboring termination diagnostic test; a refused lease returns null signal and null cancellationReason unless the stop callback fires. The bounded Studio excerpt contains precisely these added null fields.
Bug class: integration
Bug evidence: reproducer=tests/integration/resource-owner.test.ts
Hook bypass: none; core.hooksPath unset and the common hooks directory contains sample files only; plain commit used.
Convergence: none
Decision: notice-retain-capacity-contract | Keep exact result equality and add the two diagnostic null fields, preserving no-launch and subsequent-admission evidence rather than weakening the matcher or changing the production result. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-notice-retain-1011-repair-071158-PROGRESS.md
Verification: The supplied Studio failure isolates the two added fields. A local targeted attempt reaches the documented host limitation instead: WSL /bin/sh rejects ulimit -u and the holding launch exits with code 125. Studio must run the repaired physical-host assertion; no local green claim is made for it. Portable checks and exact commands are recorded in the builder report.
Prompt review: No model-facing change; recorded model-output replay is not applicable to this expected subprocess result object.

## Closing block

simplestRobustRoute: This is the simplest robust route: align the exact expected object with the existing result contract. No new machinery. Admission, no-launch end state, later admission and resource bounds remain checked; no autonomous completion or live acceptance is claimed.
80/20: Repair the evidenced assertion mismatch, preserve both decision neighbors and run the required portable checks; leave physical-host verification to the Studio gate without porting the host launcher in this repair.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
