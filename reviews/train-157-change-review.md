# Change review — train-157 bounded summary revision integration

Subject base: 73bae9446b4197f8460d749019861d415892f60a
Review state: open
Reviewed content: none
Outcome: Integrate the exact reviewed bounded summary revision and overflow-cache repair onto the accepted live build, preserving its setup design and all runtime floors.
Affected rules: 7, 11, 32, 34, 35, 36, 37, 42, 49, 55, 60, 69, 70, 74, 75, 90, 95, 96, 101, 102, 113, 116
Affected floors: secrets retain existing redaction; spend cap retains reservations and two-attempt limits; stop retains admission and commit checks; no duplicate sends retains the unchanged send path; durable intake retains originals and failed verdicts.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integrates reviewed default-on memory compaction recovery without new product edits.
Side effects: One remaining summary attempt can run sooner with bounded reviewer feedback. Feedback overflow does not poison ordinary preflight caching. Both attempts still pass the same review; UNKNOWN and unsure remain unchanged. Generated register provenance is refreshed.
Undo and recovery: Retain the current live build until desk acceptance. Revert this integration if required; journal formats and original history are unchanged and no effects are replayed.
Multi-machine posture: Revision feedback and preflight cache remain owner-worker-local; durable failures, reservations and original intake retain existing replay and replication. No new shared state or ownership path.
Layer below: Read both constitutional documents in full, reviewed member source diff and both review records, verified provided report snapshot hashes, and followed cint-L37 desk-chain instructions. Live-base setup design is preserved. Conflicts affect generated publication only.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/summary-retry.test.ts; live=tests/preview/fixtures/summary-retry-timing-2026-10-25.json
Evidence boundary: Recorded fixtures replay offline; synthetic passing and capacity neighbors are not live success. Desk owns combined full-suite and live group S acceptance.
Hook bypass: none
Convergence: none
Prompt review: Preserve the reviewed revision instruction and bounded projected feedback byte for byte. It supplies evidence, not authority; the original full-context acceptance cascade remains. Replay writer, uncertain, Jev undecided/unsure, reply-review and empty delivered-reply shapes from the member fixtures.
Prompt finding: 4106b49fff07 | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 849db3a6296a | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: e8708c7fea24 | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Decision: train-157-merge | Merge exactly 75284286432ec700e2fd3f75b35ed11bc9c6cc60, reviewed s-summary-retry-1025. Scope and evidence: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/s-summary-retry-1025-PROGRESS.md; verified remote snapshot retained locally. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-157-PROGRESS.md
Decision: train-157-A | Preserve reviewed member source bytes and all accepted live-base behavior; no source conflict or product rewrite. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-157-PROGRESS.md
Decision: train-157-B | Create a separate branch directly at exact live base 73bae9446b4197f8460d749019861d415892f60a; no branch move or additional main merge. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-157-PROGRESS.md
Decision: train-157-C | Only generated register outputs conflicted. Restore the base publication as a temporary seed, commit the ordinary merge, then regenerate against that merge. No product conflict and no head left out. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-157-PROGRESS.md
Decision: train-157-D | Run portable direct-import and explicitly required regressions in foreground chunks. Leave unchanged macOS/Studio-dependent checks to the desk and report their actual outcomes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-157-PROGRESS.md
Decision: train-157-desk | Use the existing repin/build/rehash/replay chain. Inventory and owner manifests need zero pin changes; seven generated files are rebuilt. Keep the fixed-prompt guard unchanged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-157-PROGRESS.md
Validation: Focused recorded-shape and boundary tests, direct-import regressions, journal tests, provider subscription, default-context floor, portable pinned tests and static checks; outcomes and host exclusions recorded in the desk handoff report.

## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary merge of the reviewed fix plus existing generated publication replay, with no new machinery. Existing ownership, stop, reservation and prompt-size guards admit bounded work; only a passing review commits and the two-attempt bound remains. Offline tests support a gate submission, not an unattended live success claim.
80/20: Preserve reviewed behavior, test its consumer boundaries and required regressions, and push the candidate for desk-owned full-suite and live acceptance.
VERDICT: author submission; no independent verdict asserted
