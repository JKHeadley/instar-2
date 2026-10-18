# Change review — train-47 pipeline merge repair

Subject base: 454ac1b9f216a66c9e2ed84efd256f957f545fe5
Review state: open
Reviewed content: none
Outcome: Merge live 90c18fac into train-47 while retaining capacity-aware topic workers, complete turn grounding and audience-checked sibling action facts.
Affected rules: 37, 46, 60, 74, 96, 101, 102, 113, 116.
Affected floors: secrets — retain verified audience and scrubbed fact projection; spend cap — shared durable allowance unchanged; stop — existing guards unchanged; no duplicate sends — retain journal receipts and terminal outcomes; durable intake — retain queued custody through capacity waits.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Composition touches worker admission and model-facing grounding even though the repair adds no new policy or runtime mechanism.
Side effects: Combining capacity waits with dispatch-time facts can expose fixture drift; tests exercise waits, resumed delivery, audience withholding, duplicate suppression and recorded shapes.
Undo and recovery: Revert this merge using its first parent if the Studio gate rejects the composition; retain durable journal and custody, never reset allowances or replay uncertain effects.
Multi-machine posture: Admission remains installation-local under the existing conversation authority; no new replicated state, ownership grant or cross-machine effect path.
Layer below: Inspect ConversationSessionConfig and the reviewed complete-grounding revert, physical admission release, topic admission provenance, encrypted journal and audience projection.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory has sample hooks only.
Convergence: none
Prompt review: No new instructions or parser; retain live complete-grounding revert and sibling action projection. Replay recorded shapes through actual coordinator and journal worker consumers, including uncertain summaries, undecided Jev, reviews and empty replies. No live acceptance claim.
Prompt finding: 849db3a6296a | quoted-evidence | Existing memory-list test quotes the shipped empty-memory disclosure; merge introduces no phrase-based meaning gate.
Prompt finding: e8708c7fea24 | quoted-evidence | Existing hallucinated-memory test quotes the shipped source-provenance instruction; merge introduces no phrase-based meaning gate.
Decision: train-47-repair-213048-merge | Preserve both capacity and audience fixture controls; keep complete grounding from live and measure topic-local recorded input at adapter delivery instead of the removed snapshot hook. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-47-repair-213048-PROGRESS.md
Decision: train-47-repair-213048-evidence | Keep the candidate native certificate unchanged; report its byte-bound R105 mismatch for Studio certification. Regenerate publication at b328eb341c215512a5653491a7a5bd3a6118b274 using the delegated desk scripts; owner and inventory pins needed zero updates. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-47-repair-213048-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: ordinary merge, preserve both independent behaviors, adapt obsolete tests at the actual consumer, and use existing pin generation. No new machinery. Start with the two recorded heads; end with portable checks and pushed evidence for Studio gating. Existing resource, authority, stop, uniqueness and durable intake guards remain. No autonomous live-completion claim.
80/20: Targeted foreground tests, typecheck and cheap checks only; no full suite or unrelated host investigation.
VERDICT: author submission; no independent verdict or deployment claim
