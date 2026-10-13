# Change review — capability rendering on train-16

Subject base: 0ed77d1682e55fb894fdc1f13b26cabd62972e00
Review state: open
Reviewed content: none
Outcome: Ordinary merge of reviewed unit 5831032778c0a29a37e93135ae74dffc534111b4 onto its exact live base. The merge fast-forwarded without conflicts. Only the explicit capability marker renders the entire verified capability note; literal sentences preserve adjacent answers. Register publications are replayed at the merged unit head.
Affected rules: 1, 3, 4, 10, 36, 49, 70, 74, 78, 84, 90, 101, 102, 111, 112, 113, 116
Affected floors: secrets — unchanged; spend cap — no added calls and unchanged context guard; stop — unchanged; no duplicate sends — repeated drain sends once in recorded replay; durable intake — no new state or schema
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Carries the unit's presentation and model-facing change; this build adds only generated provenance and this review.
Side effects: An explicit whole-answer reference removes surrounding prose as instructed. Unmarked grant claims remain visible to contextual review; literal and exact legacy sentences preserve adjacent answers. The note supplies public grants and limits, excluding internal feature bullets. Invalid note evidence remains unchanged for review.
Undo and recovery: Revert the unit commits and this publication refresh through an ordinary reviewed revert. No schema migration or durable state change.
Multi-machine posture: Stateless rendering of the persisted turn note; revisions use the original persisted prompt. Ownership, intake and send deduplication remain unchanged across machines.
Layer below: Read both unit review records, renderer and briefing diff, recorded fixtures and journal replay tests. Verified source-note hash checks, explicit marker boundary, legacy sentence-local substitution, review-before-send and repeated-drain behavior. Unit history is preserved intact.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory contains only sample hooks
Convergence: none
Prompt review: Carries the reviewed briefing instruction to use the explicit marker only for a whole capability answer. No new prompt text in this build. Recorded 715675677 and 715675709 replies replay alongside summary, uncertain, Jev undecided/unsure, reply-review and empty reply shapes. Harness-supplied review/revision results prove wiring, not live model judgment.

Decision: sb-capability-lines-render-1013-merge | Ordinary merge fast-forwarded from exact live base to 5831032778c0a29a37e93135ae74dffc534111b4 without conflicts; retain the unit and its repair byte-for-byte. Unit evidence is in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/capability-lines-render-1013-PROGRESS.md. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-capability-lines-render-1013-PROGRESS.md
Decision: sb-capability-lines-render-1013-replay | Follow cint-L37 desk chain: inventory repin, compiled build, owner rehash, register replay at merged head. Zero inventory and owner pins changed; generated provenance refreshed. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-capability-lines-render-1013-PROGRESS.md

Evidence: Initial focused run passes 49/49 tests: capsentence-render 20, journal-boundaries 23, default-context-floor 6. Always-sent plain answer is 22,172 bytes against unchanged 22,959 guard (787 spare). Tools answer is 25,146 bytes against the same guard plus existing 2,767 system-prompt growth (580 spare). Summary envelopes are 22,398 / 25,409 bytes; review envelopes are 28,729 / 28,936 bytes. Measurement used a temporary copy of the existing firstTurn helper, removed afterward; no guard or tracked test changed.

## Closing block

simplestRobustRoute: This is the simplest robust route: merge the already reviewed unit unchanged and replay existing desk tooling. No new machinery. Start: exact live base and verified note. End: reviewed canonical answer or preserved adjacent prose before one send. Existing floors and bounds remain held. Offline replay is not an unattended live-use acceptance claim.
80/20: Targeted changed tests, direct importers, byte floor and required checks; the Studio owns full-suite acceptance and host-dependent evidence.
VERDICT: author submission; independent review belongs to the desk
