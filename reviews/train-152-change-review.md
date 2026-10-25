# Change review — train-152 independent meaning-index recovery

Subject base: 779c15ea26aa634ee1b02159cef2bbaf1671d0f0
Review state: open
Reviewed content: none
Outcome: Integrate the exact reviewed independent meaning-index recovery onto the live train-151 base, retaining failed summary rejection and bounded recovery of searchable original messages.
Affected rules: 1, 7, 10, 11, 32, 34, 35, 36, 37, 42, 49, 55, 60, 70, 74, 75, 90, 95, 96, 101, 102, 111, 113, 116
Affected floors: Secrets retain existing input redaction and custody; spend retains shared reservations, eight pass slots and two attempts per source; stop gates remain before indexing; no duplicate sends retains unchanged intent and UNKNOWN fences; durable intake and original messages remain in the encrypted journal.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integration of a default-on shared journal-worker repair; no new authority, parser or protocol.
Side effects: Recovery uses one existing index-only batch of up to eight sources per idle pass after a rejected summary, leaving remaining slots for compaction. Indexing can cover unsummarized messages without accepting the failed summary. No added call allowance or state format. Healthy short history is unchanged.
Undo and recovery: Keep the live build until the desk accepts this candidate. Revert through the existing release process and regenerate publication; existing meaning-index rows remain valid, with no migration or send replay.
Multi-machine posture: Existing conversation ownership controls execution; meaning terms retain journal replay and replication. No new store, lease or coordination. Offline fixtures and test outputs are deliberately local evidence.
Layer below: Read both governing documents in full, the exact reviewed member diff and SHA-verified report, the cint-L37 desk-chain report, runSummary selectors and existing recorded-fixture tests. Review rejection concerns invented delivery certainty, so summary acceptance remains closed while independent original-message indexing advances.
Bug class: integration
Bug evidence: reproducer=tests/preview/faithfulness-stall.test.ts; live=tests/preview/fixtures/faithfulness-stall-2026-10-25.json
Hook bypass: none
Convergence: none
Prompt review: No additional prompt or parser change. Reuse the member's recorded proof-room fixture for updates 6236249..6236334, rejected writer/review 6236276 and Jev rejection; historical uncertain/undecided/reply/empty shapes remain offline evidence, not a new live claim. Desk owns group S live acceptance.
Decision: train-152-merge | Ordinary merge of exact reviewed 3508d549bb2935e32cb7dc1c1130429671fff8c9, fast-forward without conflicts. Member report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/s-faithfulness-stall-1025-PROGRESS.md read from the supplied hash-verified snapshot. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-152-PROGRESS.md
Decision: train-152-A | Preserve member and accepted base behavior byte for byte; no manual product or changelog resolution was needed. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-152-PROGRESS.md
Decision: train-152-B | Create the branch directly at live 779c15ea26aa634ee1b02159cef2bbaf1671d0f0; retain its ancestry without moving the branch or merging main. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-152-PROGRESS.md
Decision: train-152-C | No product conflict and no omitted member; verify exact member ancestry at handoff. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-152-PROGRESS.md
Decision: train-152-D | Run targeted WSL checks and disclose unchanged host-dependent checks for the Studio gate; preserve all assertions and declarations. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-152-PROGRESS.md
Decision: train-152-desk | Use the supplied repin/build/rehash/replay chain with the authorized Linux sed adaptation; regenerate publication instead of hand-editing generated output and retain the fixed-prompt guard. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-152-PROGRESS.md
Prompt finding: 4106b49fff07 | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 849db3a6296a | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: e8708c7fea24 | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Validation: Targeted changed tests, direct journal consumers and journal regressions, default-context floor, provider subscription, pinned-text tests and compile/architecture/register/review checks; exact results and host limitations are recorded in the builder report.

## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary integration of the reviewed selector repair and existing desk regeneration. No new mechanism is added. Start guards retain ownership, stop and allowance; end guards retain source-bound index terms and summary-review acceptance. The member prevents rejected compaction from withholding retrieval hints without weakening review. This submits a candidate for the desk gate and does not claim unattended live success.
80/20: Preserve reviewed behavior, replay real recorded shapes, test direct consumers and submit the pushed candidate with honest residue; no full-suite duplication on WSL.
VERDICT: author submission; no independent verdict asserted
