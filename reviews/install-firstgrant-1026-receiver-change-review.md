# Change review — setup owner receiving boundary

Subject base: 47deb6dce0e70389b0865bfa6618cb3e7222dda2
Review state: open
Reviewed content: none
Outcome: Implement the receiving protocol for the existing setup owner bridge. Authenticate complete current owner records and serialize dispatch without inventing custody or enrollment authority.
Affected rules: 1, 4, 5, 26, 28, 29, 34, 38, 42, 49, 55, 57, 60, 74, 95, 98, 100, 101, 102, 111, 113, 116
Affected floors: The receiver grants no secret access or spend. The installed owner retains authority, stop, durable intent and completion enforcement. No duplicate sends and durable intake remain enforced by their unchanged owners. Uncertain effects are not retried.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: A closed protocol component behind existing owners; no production activation, cryptographic key provisioning, enrollment, new model route or authority store.
Side effects: Only a fully installed owner can supply the read/reconcile/execute methods. Signed distribution must bind the receiver when mounted. Overlapping calls refuse instead of queueing. Complete current evidence is compared structurally; a failed but authentic record is not permission to execute. This component does not by itself satisfy any fresh-install milestone.
Undo and recovery: Remove the receiver composition or revert this module. It writes no records, grants or secrets. Existing owner intents and supervisor checkpoints remain authoritative; uncertain owner operations still require reconciliation, never blind retry.
Multi-machine posture: Machine-local receiving boundary. Shared authority remains with One/Two. No peer policy, replication requirement or independent-recovery obligation changes.
Layer below: Read setupPreparationOwners, the fixed protocol, supervisor dispatch checkpoints, the bounded custody socket and distribution verification. The existing broker supplies no installed key/recovery/enrollment implementation; the receiver expressly requires these owner methods and creates no substitutes. The One/Two genesis chain remains separate from preparation.
Bug class: integration
Bug evidence: reproducer=tests/platform/setup-owner-receiver.test.ts
Hook bypass: none
Convergence: none
Decision: firstgrant-1026-receiver-D1 | Receive closed bounded requests and authenticate each full record by a fresh owner read, never caller booleans, UID or model output. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-firstgrant-1025-PROGRESS.md
Decision: firstgrant-1026-receiver-D2 | Serialize dispatch and pass the observed frontier into the owner's atomic operation; uncertain completion never triggers a retry. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-firstgrant-1025-PROGRESS.md
Decision: firstgrant-1026-receiver-D3 | Keep protocol evidence distinct from unimplemented custody/enrollment and installed-owner qualification. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-firstgrant-1025-PROGRESS.md
Validation: Targeted real socket and retained signed receipt tests cover success and altered/missing/stale/corrupt evidence, ownership, bounds, concurrent mutation and uncertainty. Final command results and macOS evidence are in the progress record. No connected-login completion is claimed.

## ELI16

Setup sends its checks back to their owner to confirm they are real. The receiver reads the owner's current evidence and compares the complete result. It will not use a changed check, a stale receipt or a previous uncertain action as permission to do something again.

## UX Impact

No installer flow is enabled. Refused requests give one plain repair step without exposing private diagnostics. The existing supervisor keeps its saved progress. Independent custody, recovery, protected pairing and first subscription admission remain explicit integration work.

## Closing block

simplestRobustRoute: Implement the missing receiving half of the existing protocol, with no new database, approval service or model. Closed input is the start guard; fresh owner evidence and atomic frontier validation are the effect guards; durable reconciliation is the completion guard. The installed service still supplies resource and lifetime limits. No unattended fresh-install success is claimed.
80/20: The protocol seam is tested independently; the documented owner implementation and qualification obligations remain open. No duplicate authority machinery is introduced to manufacture a complete installation.
VERDICT: receiving component implemented; ordinary-install acceptance incomplete
