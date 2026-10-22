# Change review — train-119 reviewed self-host and first-call composition

Subject base: 588332d9d0839cd504bee2819e297cd6222a2ef9
Review state: open
Reviewed content: none
Outcome: Integrate exactly reviewed selfhost-codex-1021 0df34ec02a6cd5b0554efc2a158db3b1f6ee8615 and codex-firstcall-1021 a27d72dd26c35dfa24f8524af2709d8d3343e19a onto live train-113, preserving adapter-owned self-host evidence and bounded consistent authority reads.
Affected rules: 1, 4, 26, 30, 34, 35, 36, 37, 42, 49, 56, 69, 74, 90, 101, 102, 105, 111, 112, 113, 115, 116
Affected floors: secrets — no login use or credential change; spend cap — unchanged model reservations and no live calls here; stop — unchanged admission and latch; no duplicate sends — unchanged dispatch and no probes here; durable intake — unchanged journal and preservation of uncertain outcomes.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Composition includes provider response evidence and the live authority reader; both positive and refusal neighbors are required.
Side effects: Self-host selects the registered adapter terminal reader; authority reads can make one complete reread when concurrent appends invalidate the first snapshot. No model retry. Register replay updates derived pins.
Undo and recovery: Revert the merge and member through review and regenerate pins. Preserve uncertain calls and unknown sends; do not automatically resend. No live root was touched.
Multi-machine posture: Self-host profile and snapshot checks remain host-local. Ownership, replication and send uniqueness are unchanged; each host validates its own profile and authority.
Layer below: Full constitution, both exact member diffs and complete Studio reports, captured terminal and historical model fixtures, sealed authority and revocation checks, standard desk repin/build/rehash/replay tooling.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and inspected common hooks directory contains only samples. Ordinary merge and commits only.
Convergence: none
Prompt review: No new model wording. Carry the member adapter terminal-reader change and replay its captured transport with historical summary, uncertain, undecided, reply-review and empty-delivery bodies. Preserve every member prompt finding disposition.
Prompt finding: 0d4664ea9de7 | protocol-literal | Existing standing-trust instruction is quoted in self-description provenance tests; no wording or semantic trigger is changed.
Prompt finding: 14d7eeccc218 | protocol-literal | Existing workspace and public-read authority instruction is quoted by the self-description tests; this change only exposes the adapter-owned system text.
Prompt finding: 9781075d458e | protocol-literal | Existing refusal-reporting instruction is asserted by self-description tests, with no fixture-derived answer gate.
Prompt finding: 45e37ea2e9e9 | protocol-literal | Historical capability instruction is quoted for provenance comparisons; no prompt wording is derived from the fixture.
Prompt finding: b1bb3946362d | protocol-literal | Existing Claude agent identity instruction is asserted by act-first tests; identity wording is unchanged.
Prompt finding: 42faf877ba82 | protocol-literal | Existing Codex agent identity instruction is asserted by act-first tests; identity wording is unchanged.
Prompt finding: 450c79237a95 | protocol-literal | Existing conflicting-memory guidance is asserted by journal-people tests; the instruction and its interpretation are unchanged.
Decision: train-119-merge-selfhost | Ordinary merge of exact 0df34ec02a6cd5b0554efc2a158db3b1f6ee8615 fast-forwarded; member report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/selfhost-codex-1021-PROGRESS.md. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-119-p2-PROGRESS.md
Decision: train-119-merge-firstcall | Ordinary merge of exact a27d72dd26c35dfa24f8524af2709d8d3343e19a preserves both sources; member report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/codex-firstcall-1021-PROGRESS.md. Only generated outputs conflicted; temporary prior outputs permit the source merge, then all seven regenerate from committed composition. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-119-p2-PROGRESS.md
Decision: train-119-A | Preserve both reviewed member behaviors; no product conflicts or handwritten generated resolution. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-119-p2-PROGRESS.md
Decision: train-119-B | Use requested remote-builder branch train-119-p2 directly at exact live base; origin/train-119 already exists. No branch move or main merge. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-119-p2-PROGRESS.md
Decision: train-119-D | Run isolated offline Laptop checks; serving credentials and Studio writes are forbidden. Report host-dependent checks separately and retain member live evidence. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-119-p2-PROGRESS.md
Decision: train-119-desk | Apply downloaded desk chain: repin provider-invocation inventory and its checker digest, build, rehash owner manifests, replay register from committed source. Context guard and conformance declaration unchanged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-119-p2-PROGRESS.md
Decision: train-119-review | Move the first-call member validation line above its closing three-line block to satisfy Rule 116 without altering any claim; refresh this record after register generation so Rule 74 covers the replay commit. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-119-p2-PROGRESS.md
Decision: train-119-replay-timeout | Remove four special 30-second replay-group overrides and inherit the existing 90-second suite bound. The same recorded plan passed in 9 seconds and completed after 58 seconds under host contention; these tests assert evidence and refusal semantics, not latency. Assertions, fixtures, runtime provider deadlines and safety limits are unchanged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-119-p2-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=Existing declarations regenerated by the replay tool; no postponed work.
Verification: Changed tests, direct importers, every journal test and required pinned gate tests; exact outcomes in progress report.
simplestRobustRoute: This is the simplest robust route: two ordinary reviewed merges and the existing regeneration chain, no new machinery. Exact activation and stable authority are start guards, admitted terminal evidence and delivered replies are end guards, with existing secrets, spend, stop, durable intake and duplicate-send floors. Member reports carry real unattended self-host and first-answer proof; this Laptop run claims offline composition verification only.
80/20: Targeted tests and explicitly required journal/pinned selections, foreground one-worker chunks; no full suite or live probes.
VERDICT: author submission for desk gate; no independent convergence or live acceptance
