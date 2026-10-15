# Change review — reaction acknowledgement pipeline repair

Subject base: 027ad1d136eaa1801ce8eff16c3389a4806cb6ea
Review state: open
Reviewed content: none
Outcome: Integrate the existing train-35 graduation repair and regenerate register evidence for the acknowledgement branch.
Affected rules: Rules 1, 8, 37, 49, 72, 73, 74, 90, 101, 102, 105, 111, 112, 113, 115, 116.
Affected floors: secrets — no credential or outbound changes; spend cap — no model calls; stop — unchanged; no duplicate sends — unchanged intent and receipt path; durable intake — unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: Reuse a named owning metadata repair, without changing acknowledgement behavior or any model-facing decision.
Side effects: The still-dark step-check deadline moves one day to October 16 under the existing append-only promotion record. No stage, protection, or live evidence is claimed. Register artifacts reflect current source bytes replayed from commit 4470f8c52d5dbae8a993ac1f51ef4658a73b0eb4; the desk tools found no additional manifest or chain pin changes necessary.
Undo and recovery: Revert this repair's metadata and regenerate the register; retain promotion history. The prior deadline then correctly reports overdue again. No live state migration or journal rewrite.
Multi-machine posture: Repository metadata is shared through git. Native macOS composition evidence remains owned by the Studio contract run; WSL cannot certify it.
Layer below: Inspected the existing promotion-record latest-deadline projection, declaration binding, overdue checks, named owning commit d746452bbe60ac6f23d04daf0627f44dcf60a8d8, and register source-pin validation. The prior review's acknowledgement behavior is preserved.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample hooks only.
Convergence: none
Prompt review: No model prompts, output parsers, routing, or acceptance judgments change. This ports the five metadata/test paths of the owning repair exactly and regenerates existing evidence.
Decision: step1o-repair-graduation | Port the five graduation metadata and test paths from owning commit d746452b without importing unrelated train-35 work or inventing another repair. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1o-reaction-ack-1014-repair-175722-PROGRESS.md
Decision: step1o-repair-native | Preserve the stale native declaration for the desk's real macOS contract renewal, per the standing charter's explicit R105 exception; never edit its digest to simulate evidence. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1o-reaction-ack-1014-repair-175722-PROGRESS.md
Decision: step1o-repair-register | Use the delegated desk tools and committed register replay to refresh source evidence, not manual pin edits. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1o-reaction-ack-1014-repair-175722-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: reuse the named owning deadline repair and existing register generators, leaving native certification to its actual host. No product machinery or ability restriction is added. Existing deadline enforcement guards the limit; committed source replay binds the evidence; real Studio contract evidence is required before native certification. No autonomous product-completion claim.
80/20: Run changed tests and direct consumers, typecheck and cheap static gates; disclose the charter-exempt native certificate and Studio-only report paths. No full suite or new live acceptance claim.
VERDICT: author submission for desk gate; no independent convergence claimed
