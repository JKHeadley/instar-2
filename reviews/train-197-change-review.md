# Change review — train-197

Subject base: 8258974660cadac50e9a4988c050cf14764e8dc3
Review state: open
Reviewed content: none
Outcome: combine the accepted train-176 live base with exactly the reviewed duplicate-promise-1106 repair cdfa315fe76dc5577609f4053168c435b269b84c, so an explicitly fulfilled reply promise closes with its delivered answer regardless of whether a summary or open loop captured it.
Affected rules: 4, 8, 10, 26, 34, 36, 37, 70, 74, 83, 90, 101, 102, 111, 112, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake are unchanged. The exact offered identity, exact delivered excerpt, complete receipt and no-open-subtasks checks remain in force.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: integration of a production journal fulfillment predicate and its generated register publication.
Side effects: summary- and loop-captured agent-owned reply commitments become eligible for explicit fulfillment. Unrelated promises, operator-message obligations, UNKNOWN sends and unfinished work retain their prior behavior. No new prompt, state format, provider call or send path is authored by this train.
Undo and recovery: before any newly supported fulfillment intent exists, the predicate can be reverted. After such an intent exists, use compatible forward repair retaining replay support; the old validator rejects those existing intents. Preserve journals, intent and receipt history without rewriting or deleting it. The desk retains the live base until acceptance; this build touches no live root or runner.
Multi-machine posture: the existing shared journal and owner-gated delivery are unchanged. Every reader must retain compatibility with supported fulfillment intents. Build artifacts travel by git; builder evidence is machine-local deliberately and is copied by the desk for the Studio gate.
Layer below: read the complete constitution and both authenticated evidence snapshots. Independently searched actual JKHeadley/instar origin/main 149377310f9b586641a05eddf196df4543dc031a: src/monitoring/CommitmentTracker.ts record()/externalKey and deliver(), docs/specs/COMMITMENTS-COHERENCE-SPEC.md section 3.3a, and history 11d127b5e, 1b4350998, e8576a096, 28527b241, d2fec4424. Read ONEX-LESSONS.md commitment and outbound-timeout duplication entries. Reuse explicit semantic judgment and identity-bound delivery closure. externalKey dedup does not fit separately extracted quotes; automatic semantic merging would lose the reviewed identity boundaries. The member's earlier c55d2a998429cbb2a7f2d0748d015fc45415a2df comparison and 4018bf338/5ff755994 history remain in its record. Inspected the shared validator, journal consumers and recorded-shape regression; no second tracker is needed.
Bug class: integration
Bug evidence: reproducer=tests/preview/duplicate-promise.test.ts
Hook bypass: none
Convergence: none
Prompt review: no prompt wording changes. Preserve the member's D1 recorded-shape fixture (updates 46040849/46040850) with explicitly synthetic model declarations; this is not an original-journal replay or fresh D1c live proof. Run existing real recorded summary/uncertain summary, Jev undecided/unsure, reply-review and delivered/empty-reply fixtures on the combined tree.
Decision: train-197-merge | Ordinary merge of exactly cdfa315fe76dc5577609f4053168c435b269b84c fast-forwarded from exact live base; report snapshot reviews/train-197-duplicate-promise-evidence.txt preserves /Users/dabombstudio/.instar/agents/echo/.instar/lanes/duplicate-promise-1106-r2-PROGRESS.md byte for byte. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-197-PROGRESS.md
Decision: train-197-A | Preserve all reviewed member and live-base behavior; no conflicts occurred, no generated file was hand-merged, and no changelog version was removed. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-197-PROGRESS.md
Decision: train-197-B | Create a separate train-197 checkout directly at 8258974660cadac50e9a4988c050cf14764e8dc3 and preserve ancestry; leave other trains and live roots untouched. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-197-PROGRESS.md
Decision: train-197-desk | Run the existing repin, build, owner rehash and register replay chain at cdfa315fe76dc5577609f4053168c435b269b84c; reviews/train-197-cint-L37-evidence.txt preserves the supplied chain reference. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-197-PROGRESS.md

## Closing block

simplestRobustRoute: this is the simplest robust route: one ordinary merge of reviewed bytes and the existing desk publication tools, followed by focused consumer, lifecycle, recorded-output and required gate checks. No added mechanism, authority or model call. Live acceptance and independent Studio review remain separate gates; no unattended live outcome is claimed here.
80/20: preserve the reviewed repair without redesign and test its exact integration boundary; do not sweep unrelated import closures.
VERDICT: author submission; independent combined-build gate pending
