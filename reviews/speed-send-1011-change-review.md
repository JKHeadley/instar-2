# Change review — overlap send-time audience reads

Subject base: 208a222111a384b04db9bff4ab7f02ba7d452703
Review state: open
Reviewed content: none
Outcome: Reduce the carried-memory worker's measured send stage from 6100 to 3100 injected milliseconds without removing any audience observation or dispatch guard.
Affected rules: Purpose least revelation and irreversible-act durable cause; Rules 1, 4, 13, 26, 28, 34, 36, 49, 55, 60, 63, 70, 74, 77, 95, 101, 102, 111, 113, 116.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake remain at their existing doorways. Fresh audience verification still precedes every disclosure, with both count checks and the same exact identity and public-chat predicates.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Bounded scheduling change to an existing read-only probe; no authority, schema, prompt, model routing or acceptance predicate change.
Side effects: The shared verifier benefits all existing checkpoints, not only send. Four independent requests can be active instead of one, bounded at four inside the existing physical limits. The first count now brackets chat and bot identity observations too. Unsuccessful reads settle all siblings before returning. No cache, reuse of earlier standing, retry or bypass is added.
Undo and recovery: Revert this change and regenerate source publications; journals and grants need no migration. The prior serial verifier remains behaviorally compatible.
Multi-machine posture: Machine-local scheduling only, no new store. Every conversation owner retains its own fresh dispatch verification, ownership admission and durable signed intent. No authority is transferred between machines.
Layer below: Inspected journal.ts dispatch and sendStarted timing, the immutable signed intent and unknown-outcome handling, groupMembershipReader and its real HTTP bridge test. The 6100 ms controlled baseline is six membership reads plus a 100 ms captured send, not measured local origin recording, capacity work or a retry. Existing speed-hold-1011 implementation is ported byte-for-byte; no competing verifier is introduced.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset; shared hooks directory contains only sample files.
Convergence: none
Decision: port-existing-probe-overlap | Port speed-hold's four independent read overlap between two count reads, preserving fresh dispatch and exact standing semantics. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/speed-send-1011-PROGRESS.md
Decision: fixture-send-measurement | Replay repository-captured question, answer, review and memory through the actual worker with injected read/send time; do not claim live latency or access Studio journals. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/speed-send-1011-PROGRESS.md
Decision: retain-dispatch-floors | Keep origin recording, capacity checks, reviews and unknown-outcome no-retry behavior; the measured waste is serial independent membership I/O. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/speed-send-1011-PROGRESS.md
Verification: Local baseline reproduced 6100 ms before the verifier edit; after it, 3100 ms with the same six probes, 36 reads, two reviews, zero revisions and one accepted send. The new worker replay covers a join before send, stop during the probe, and accepted/unknown outcomes across reopen without another send. Unit tests cover the exact authority predicates, observed joins and sibling settlement on throw/rejection/unknown. Real HTTP bridge and captured model-shape recovery tests exercise the new verifier. Targeted run: 76 passed, three unchanged relocation launcher cases refused startup on WSL; named for the desk per the remote-builder charter, without investigation. Typecheck and final gates are recorded in the builder report.

Subject (12 paths): tests/preview/group-disclosure.ts, tests/preview/group-disclosure.test.ts, tests/preview/group-membership-io.test.ts, tests/preview/group-carry.test.ts, tests/preview/send-stage-replay.test.ts, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse the already-proven bounded overlap from speed-hold, with no extra dispatch mechanism. Both count reads and every identity/chat test remain; all asynchronous reads settle before any result escapes. The remaining three I/O rounds preserve the before/after count bracket. The controlled worker replay proves the shipped worker path locally; live deployment and the real Studio replay remain the desk's gate, not an author completion claim.
80/20: The requested stage has an isolated cause and before/after fixture measurement. No unrelated stages, review routes or live runner are changed. Independent landing judgment belongs to the desk.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
