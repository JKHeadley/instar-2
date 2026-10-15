# Change review — train-44 continuing-turn grounding integration

Subject base: 51d31871f1d6ac8611b5ae61a43b32b70119c63d
Review state: open
Reviewed content: none
Outcome: Integrate the exact reviewed delta-turns head and its reviewed ancestry onto the live build, preserving full grounding after worker replacement and compaction and the live runner exit visibility.
Affected rules: Purpose 2/3; Rules 29, 32, 34, 36, 37, 46, 47, 49, 58, 60, 69, 70, 74, 75, 90, 96, 101, 102, 105, 110, 111, 112, 113, 116.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain their existing enforcement. Full original requests remain durable; only exact redundant delivery bytes are omitted.
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: Reviewed model-facing formatting and recovery integration, without new authority or lifecycle policy; publications are regenerated from committed source.
Side effects: Carries reviewed train-41 packet deduplication, summary acknowledgement and tool-verification guidance ancestry. Exact grounding reuse is worker-local, accepted-delivery-only and reset on compaction receipt changes. Current bindings, clocks, operation IDs and results remain whole. Existing train-42 exit-reason output remains present.
Undo and recovery: Reject this candidate or restore the preceding live build through the desk deployment process. Preserve journals, original requests and receipts; never resend UNKNOWN intents. No new migration or authority.
Multi-machine posture: Grounding reuse is deliberately worker-local transient state. New workers and owners start full from durable original requests. WSL builds and replays; Studio owns native certification and deployment.
Layer below: Inspected merged conversation-session dispatch, accepted-delivery update and compaction snapshot/receipt plumbing; clean journal-agent merge preserves both native snapshot wiring and live exit handling. Checked exact base/member ancestry. Native certificate is composition-bound, not assumed portable to this merged tree.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory contains sample hooks only.
Convergence: none
Prompt review: No new wording beyond reviewed member ancestry. Re-run committed real summary/uncertain, Jev undecided/unsure, reply-review, delivered and empty-reply fixtures through the merged continuing-turn path; packet-once, summary-ack and tool-verification recordings cover inherited changes. External rewalk6 capture replay is supplementary and reported separately from committed fixtures. No live latency or conversational acceptance claim.
Decision: train-44-merge | Ordinary merge of exact reviewed 714349be4aa046e3966ab880ea206d591a3cca7a; scope and evidence: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/delta-turns-1015-PROGRESS.md and reviews/delta-turns-1015-change-review.md. Generated conflicts were restored to the live publication only to finish the merge, then regenerated from combined committed source; no generated content hand-merge. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-44-PROGRESS.md
Decision: train-44-desk-A | Preserve member ancestry and accepted live behavior. The only conflict is derived register output; the journal-agent source merges cleanly with exit handling retained. No product conflict and no omitted head. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-44-PROGRESS.md
Decision: train-44-desk-B | Create branch directly at exact live 51d31871f1d6ac8611b5ae61a43b32b70119c63d; no main merge, branch move or unreviewed tip. Account for inherited train-41 changes in direct-consumer tests. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-44-PROGRESS.md
Decision: train-44-desk-D | Run targeted tests and prescribed journals on WSL. List host-dependent failures and missing Studio report paths; leave any byte-bound native Darwin certificate mismatch for the desk without editing its declaration. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-44-PROGRESS.md
Decision: train-44-publication | Use downloaded desk repin/build/rehash tools and replay the register from combined committed source. Refresh changed contracts inventory pin and its checker digest; no hand-edited publication or certificate. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-44-PROGRESS.md

Decision: train-44-floor-pin | Direct-consumer check found the old 2767-byte tool-policy growth pin; reviewed train-41 verification guidance adds exactly 508 bytes. Pin 3275, retaining PREVIEW_FIXED_PROMPT_BYTES and every floor inequality unchanged. No new prompt text or cap change. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-44-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: one exact-head merge, existing publication tools and direct consumer checks. No new runtime machinery. Existing secret, ownership, spend and stop admission guards remain; durable requests, exact result mapping, accepted-delivery fencing and bounded worker lifetime hold the exit and resource floors. Independent convergence and unattended live acceptance remain desk work, not claims of this integration.
80/20: Changed tests, direct consumers, prescribed journal tests and pinned checks only; no full suite, transitive import closure, comparison worktree, live login or load generation.
VERDICT: author submission for desk gate; no independent convergence or deployment claim
