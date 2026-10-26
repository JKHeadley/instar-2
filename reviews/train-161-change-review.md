# Change review — train-161 journal growth repair

Subject base: fcc49ab27f44ff45831a7797e4849a277b7d48c3
Review state: open
Reviewed content: none
Outcome: Include exactly the reviewed journal-growth-1026 head while preserving the accepted live base and regenerate its register projections.
Affected rules: Rules 7, 13, 26, 32, 33, 41, 49, 58, 60, 61, 70, 74, 75, 90, 101, 102, 113 and 116.
Affected floors: secrets — encrypted journal and custody unchanged; spend cap — accounting retained; stop — projection retained; no duplicate sends — pending effect evidence retained; durable intake — authenticated frames and atomic verified replacement retained.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Carries a reviewed journal durability repair; no new product behavior beyond that member.
Side effects: Repeated diagnostic observations are summarized while transitions, events and model records stay whole. Full history still consumes memory. Existing snapshots keep version 1; snapshots larger than the old string ceiling require the new bounded reader.
Undo and recovery: Revert diagnostic sampling if needed, retaining the bounded reader for large snapshots. Never replace current accepted intake/effect evidence with a stale backup. No live root is changed by this train.
Multi-machine posture: Preserve portable replicated journal format and projection digest; timing caches remain process-local diagnostic state, not admission authority.
Layer below: Read constitution in full, exact base/member ancestry, the member review and its supplied report, streaming serializer/parser and digest verification, diagnostic retention and timing callsites. The merge fast-forwarded without conflicts.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory contains only samples.
Convergence: none
Prompt review: No prompt, model interpretation or acceptance-policy changes; the member's recorded model-shape codec replay is retained.
Decision: train-161-merge | Ordinary merge of exactly 56c939951ef1baf9bc8e985b4eac872226e4329f; source report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/journal-growth-1026-PROGRESS.md (downloaded snapshot SHA256 e6f7d8a0d8b127b97f4cdf31d25b9d73162bfb6b3f03957578f863bf3edcde20). Fast-forward preserves reviewed bytes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-161-PROGRESS.md
Decision: train-161-A | Preserve all member behavior without product edits; no overlapping conflict exists in this one-member fast-forward. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-161-PROGRESS.md
Decision: train-161-B | Start directly at the exact live fcc49ab27f44ff45831a7797e4849a277b7d48c3 and retain its ancestry; no main merge or branch move. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-161-PROGRESS.md
Decision: train-161-D | Run direct-import and journal tests on WSL; report unchanged host-dependent checks separately for the Studio gate, as directed. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-161-PROGRESS.md
Decision: train-161-desk | Run the supplied repin/build/rehash/register-replay chain; only adapt macOS sed syntax in the downloaded temporary script for Linux. Regenerate generated files, never hand-edit them. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-161-PROGRESS.md

Prompt finding: 4106b49fff07 | protocol-literal | Existing source-bound action-claim instruction, unchanged from the supplied base. The test asserts the protocol and does not supply a desired verdict.
Prompt finding: 85544c20941f | protocol-literal | Existing fixed queued-message notice, unchanged from the supplied base; its test checks the actual notice, not a semantic trigger.
Prompt finding: e8708c7fea24 | protocol-literal | Existing sourceLabel attribution instruction, unchanged from the supplied base; no prompt or fixture was copied or changed.
Prompt finding: 849db3a6296a | protocol-literal | Existing fixed empty-memory display literal, unchanged from the supplied base; no semantic classifier is introduced.

Decision: train-161-fixture | The commitments live-script fixture still constructed the old full selfState source while the shipped inspect/turnSources uses selfStateBrief plus disciplineSource. Match those existing runtime sources so the 32768-byte probe and actual turn test the same packet; retain all commitment and continuity assertions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-161-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest route: one ordinary exact-head merge and the existing desk regeneration/checks. No new mechanism, policy or authority is introduced. Existing atomic snapshot verification, pending-evidence retention and diagnostic boundaries remain the guards. No unattended deployment or live completion is claimed.
80/20: Verify the changed tests and direct consumers, then submit pushed evidence to the independent desk; do not run the full suite or change unrelated host-dependent tests.
VERDICT: author submission; independent desk acceptance pending
