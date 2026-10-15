# Change review — exact grounding reuse in continuing native turns

Subject base: 3b52905f79eba23fcb5826843e9dc1de1fe5aea6
Review state: open
Reviewed content: none
Outcome: A continuing native worker receives repeated packets and instructions by original-operation reference, with full current grounding restored on native compaction and the next turn.
Affected rules: Rules 29, 32, 36, 46, 47, 49, 58, 60, 70, 74, 75, 96, 101, 110, 111, 113, 116; purpose constraint 2.
Affected floors: secrets — existing scrub/custody unchanged; spend cap — existing cumulative reservation unchanged; stop — existing admission and retirement unchanged; no duplicate sends — original operation and result mapping unchanged; durable intake — original requests and dispatch custody unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: The critical suggestion comes from launcher wiring and generated publication; declared significant because only model-facing input formatting and native compaction recovery change, and generated files publish that committed source. No authority or policy change.
Side effects: The transient per-worker map stores hashes and original operation IDs, bounded by the existing worker turn limit and delivery byte bound. It advances only on accepted delivery. Distinct packets and unknown/plain envelopes remain complete; current envelope bindings and result mapping remain exact. References never cross retirement, restart or a changed compaction receipt. Full snapshot failure prevents dispatch while retaining the request. Adapters without the snapshot contract retain full input. Full-input sizing still decides batching, so this change does not enlarge a batch or its resource bound.
Undo and recovery: Revert this change to send full input every turn. The snapshot is disposable; original durable requests and accepted delivery bytes are unchanged, so no state migration or replay is needed.
Multi-machine posture: Deliberately worker-local, transient deduplication; new owners and resumed/rebuilt workers start full from existing durable custody. Snapshot paths are topic-local within the existing lifecycle inbox, with existing harness access inheritance.
Layer below: Inspected the native Stop/SessionStart hook, physical lifecycle inbox, host queue and worker retirement. In-place compaction differs from worker replacement: the existing hook receives the full current input immediately, and its receipt resets the next turn. Physical hook tests exercise a real child process and UTF-8 snapshot beyond 64KB, exact worker revision, per-topic isolation, replacement and oversize refusal. No live runner or account is accessed.
Bug class: live-path
Bug evidence: reproducer=tests/assembly/production-conversation-session.test.ts; live=tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample files only.
Convergence: none
Prompt review: All 34 rewalk6 requests, including the format repair, replayed with recorded replies through 26 native delivery groups. Snapshot prompts equal the recorded full prompts byte-for-byte after restoring their clock and result path. Median bytes 62195.5 -> 57908.5; maximum 183953 -> 183953; total 1750319 -> 1659876. All 34 complete packets differ, so none was suppressed in this walk. Recorded summary/uncertain, Jev undecided/unsure, reply-review, delivered reply and empty-reply shapes separately prove exact packet reuse and preservation of changed packets. This is offline formatting evidence, not live model quality or latency acceptance.
Decision: exact-packets | Reuse only exact canonical packet bytes and exact instruction text; never infer that overlapping history makes distinct packets redundant. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/delta-turns-1015-PROGRESS.md
Decision: compaction-snapshot | Use the existing native grounding hook and receipt; full snapshot before dispatch, first turn full after revision changes. Unknown recovery support retains full inputs. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/delta-turns-1015-PROGRESS.md

Decision: inherited-policy-pin | Current repair head already includes a7b53389, making tools policy 1ffbc3f59b696744b9e6fbb2510a7604421053d10a12d2ecacaa336e201b4245 rather than the brief's older 5fed4bcf prefix. Conversation policy stays 3598cc75. This unit changes neither policy; the existing stale length assertion now pins the current difference and digest. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/delta-turns-1015-PROGRESS.md

Decision: register-publication | Regenerated the existing shape-only register from source commit b4ba0fdf60265d0a4856495e06fa97e618156ab5. The native Darwin certificate remains unchanged for desk-owned renewal. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/delta-turns-1015-PROGRESS.md

simplestRobustRoute: This is the simplest robust route for exact reuse: a worker-local hash map within the existing queue, plus the existing SessionStart snapshot/receipt mechanism. The snapshot prevents the credible failure of in-place native compaction dropping instructions or packets omitted from a delta; clearing only on process replacement would not address it. Existing start, stop, grant, allowance, dispatch and result guards stay in place. The desk owns live model and latency acceptance; this submission claims only verified offline behavior.
80/20: Targeted source and direct-consumer tests, recorded replay, physical hook test, typecheck, architecture/register checks and the charter's pinned READY tests. No full suite or live room work.
VERDICT: author submission; no independent convergence or live acceptance claim
