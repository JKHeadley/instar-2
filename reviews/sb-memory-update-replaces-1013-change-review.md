# Change review — Merge saved-fact replacement guidance

Subject base: 0ed77d1682e55fb894fdc1f13b26cabd62972e00
Review state: open
Reviewed content: none
Outcome: Merge reviewed unit memory-update-replaces-1013 at 41dd2dd3fb0a4aec43948b4ab340139194158f09 onto the exact live train-16 base. The ordinary merge fast-forwarded with no conflicts. The unit's instructions distinguish a new independent fact from a changed value of the same saved fact and reuse the existing sourced update. No implementation or fixture bytes are changed by this combine. Regenerate register publications through the standard desk chain at the merged unit head.
Affected rules: Purpose constraints 2/3; Rules 4, 7, 10, 11, 12, 34, 36, 37, 49, 57, 66, 69, 70, 74, 85, 90, 96, 101, 102, 111, 113, 116.
Affected floors: secrets — existing redaction, audience and outbound checks; spend cap — existing reservations and bounded repair; stop — existing turn/retry checks; no duplicate sends — existing durable send intents; durable intake — existing journal and historical memory projection. No floor or guard constant changes.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Inherits the unit's critical tier for instructions governing persistent memory choices.
Side effects: The unit changes future model choices for restated saves. Old recorded remember decisions are not rewritten. Slight instruction growth is checked against the unchanged context floor and recall-capacity tests. Combine-only changes are generated publication metadata and this review.
Undo and recovery: Revert the unit's instruction commits and regenerate publications from the reverted source. Journal formats, admission and projection remain unchanged; historical update/correct/forget records remain readable. No migration.
Multi-machine posture: The same instructions run on each runner; existing ownership, journal and replication boundaries remain intact. No new state or transport.
Layer below: Read the unit's review and local builder report. The exact offered-source and current-turn replacement checks remain unchanged; replay demonstrates durable historical supersession and rejection of the original recall-time update when the replacement is absent from that message. The unit's Decision report paths already point to the Studio. Existing memory projection, correction, forgetting, packet floor and repair tests exercise the foundation beneath the wording.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/memory-update-replaces.test.ts; live=tests/preview/fixtures/memory-update-replaces-2026-10-13.json
Hook bypass: none; core.hooksPath checked unset and common hooks directory contains sample hooks only. Ordinary merge and plain commits.
Convergence: none
Decision: sb-memory-update-replaces-merge | Merge the reviewed unit directly onto the specified live head; fast-forward without conflicts, retaining all unit bytes and its existing report citations. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-memory-update-replaces-1013-PROGRESS.md
Decision: sb-memory-update-replaces-publication | Use the existing desk repin, build, owner-manifest rehash and register replay chain at merged head 41dd2dd3; add no new mechanism or hand-edited publication. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-memory-update-replaces-1013-PROGRESS.md
Prompt review: Carried unchanged from reviews/memory-update-replaces-1013-change-review.md. Replays consume exact save output 715675724 and update/repair outputs 715675726; relocating the update output to the save turn is explicitly labelled. The original bad remember choice remains bad when replayed, and a recall-time replacement absent from the current message still refuses. Supplementary journal-memory-save-live replays cover recorded summary, uncertain, undecided, reply-review and delivered/empty reply shapes. No fresh-provider or live-deployment claim.
Prompt finding: 849db3a6296a | protocol-literal | Existing empty-memory status wording tested at its consumer, not a phrase deciding intent.
Prompt finding: e8708c7fea24 | protocol-literal | Existing source-provenance instruction tested at its consumer, not a phrase deciding intent.

simplestRobustRoute: This is the simplest robust route: merge the reviewed wording unchanged and regenerate its publications with existing tools. No new resolver, model call, store or gate. Existing exact source admission is the start guard, durable current-value projection is the end guard, and caps, stop, secrets and send ownership retain their limit guards. No unattended live completion claim.
80/20: Targeted recorded-shape, memory and packet-boundary tests plus compilation, architecture, publication and review checks; the Studio owns full-suite and live acceptance.
VERDICT: author submission; independent combine convergence is not claimed
