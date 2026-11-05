# Change review — preserve a carried promise's recorded work account

Subject base: b5806d1e015dc650cdc1dee2e0accab05a849d4b
Review state: open
Reviewed content: none
Outcome: Partial work for carryover row 40 in lanes/carryover-1028.md. A private-to-group snapshot retains the recorded work account of an open promise, including its finished result and delivery state. This is not the complete One Memory or RelationshipManager port, and does not close row 40.
Affected rules: purpose constraint 2 and least revelation; 7, 26, 28, 32, 34, 36, 42, 49, 60, 74, 83, 85, 96, 101, 102, 111, 113, 116, 117.
Affected floors: secrets — existing source authorization, raw-field redaction before JSON quoting, correction projection and serving audience checks apply to the added context; spend cap — no new model call or enlarged packet/snapshot limit; stop — existing admission checks unchanged; no duplicate sends — no executable commitment, result binding or send authority enters the destination; durable intake — existing encrypted carry frame, digest, replay and compaction retain the account.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Private historical work results enter model context across a disclosure boundary; execution and send ownership must remain distinct from knowledge.
Side effects: An open promise's serialized context can be larger. The existing whole-snapshot limit may refuse an oversized carry before writing either journal; the existing packet selector may omit more entries with its omission count. Recorded work timestamps and delivery state describe the snapshot, not subsequent source activity. A model can use the historical result in an authorized reply; it is not a second scheduler. No transfer or refresh of promise execution is implemented.
Undo and recovery: Revert this change to omit work accounts from newly built snapshots. Existing snapshots remain valid under the same promise-entry wire shape; their digest-protected historical text is retained. Do not erase or rebuild a carried journal to undo its history. Source execution and UNKNOWN delivery bindings remain untouched.
Multi-machine posture: The new text rides the existing sealed carry frame and journal replication. It adds no machine-local store, peer authority or ownership path. A snapshot does not become a live relationship union; the broader 1.x conflict, tombstone and reconciliation behavior remains unported in this unit.
Layer below: Traced 1.x commit 4f88880a45f0a119aae3cfd2ccaf9ace26d405b9 RelationshipManager persistence/context methods, RelationshipsReplicatedStore disclosure projection, union and foreign rendering, server relationship routes and server peer-read injection. In 2.0 inspected buildCarriedMemory, appendGroupCarry, groupCarryPacket, journal replay, obligation result/withholding transitions, pendingReports and owedResultAuthority. A report is produced work, boundTo is a durable delivery intent, and delivered requires its receipt. Rejected report bytes are moved to withheld and are not exported as finished results.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains only sample hooks.
Convergence: none
Decision: carry40-account | Add the existing work account only to historical promise text; do not copy scheduler state or authority and do not create a second store. This repairs a demonstrated context loss but is not a full source-code port. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-40-cross-topic-memory-1104-PROGRESS.md
Decision: carry40-scope | Keep row 40 open: the immutable carry has no live foreign relationship union, conflict-resolution path or deletion propagation comparable to the named 1.x feature. Do not treat this narrower repair as a demonstrated replacement for those behaviors. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-40-cross-topic-memory-1104-PROGRESS.md
Decision: carry40-redact | Redact the raw result and progress strings before JSON quoting; a failing multiline Bearer fixture proves that serialization can otherwise hide the credential shape from the existing redactor. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-40-cross-topic-memory-1104-PROGRESS.md
Deferral: tests/preview/group-carry.test.ts:425 | not-a-deferral=Historical fixture provenance for recorded update 6232091; this comment names an existing deferred-answer capture, not a commitment to future implementation.
Prompt review: The added context is JSON data inside the existing source-labelled historical promise entry, with snapshot time, explicit predecessor execution ownership, and pending/unknown/delivered status. Existing disclosure guidance and checks are unchanged. The focused test first admits a full-clause correction, then opens its promise in a separate delivered reply (a correction receipt carries no unrelated promise). It replays the real completed work output obligation:commitment:3:1791099958095 from update 6232091 through the worker and into a restarted carried root. The existing group-carry tests replay the recorded summary, Jev, reply-review, held-answer and empty-answer shapes; no fresh live proof is claimed.

Subject (3 paths): tests/preview/group-carry.ts, tests/preview/group-carry.test.ts, tests/preview/README.md

## Closing block

simplestRobustRoute: The required narrow outcome is that an authorized successor knows a promise's already-recorded result. The simplest robust route is the existing bounded, encrypted snapshot and source-labelled promise context. No new store, service, model call or ownership record is needed for that narrow outcome. Start guards are the exact disclosure scope, current audience, stop and writer posture; limits remain the existing snapshot and model packet ceilings. End-state tests check the consumer packet after restart and the absence of a second executable obligation. This narrow route is insufficient for the complete row 40 live relationship feature; no unattended shipped-path completion is claimed.
80/20: Preserve the tested context repair as partial work. The desk report records check outcomes and names remaining whole-feature behavior rather than silently omitting it.
VERDICT: author submission of partial work; no independent approval or READY claim
