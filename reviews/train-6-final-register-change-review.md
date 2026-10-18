# Change review — train-6 final register publication

Subject base: d25d9674afe647db9fcd2bb91587f46a98e49fc8
Review state: open
Reviewed content: none
Outcome: Publish the existing register replay from the exact merged train-6 source, replacing the temporary first-parent publication.
Affected rules: 26, 37, 49, 69, 74, 90, 101, 102, 111, 112, 113, 116
Affected floors: secrets — no credential or content exposure; spend cap — no paid calls; stop — no runtime changes; no duplicate sends — no sends; durable intake — no journal changes
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Seven derived output files change only source commit and generation identifiers; no source or policy changes.
Side effects: Register consumers now bind the merged audit reader and Studio repair together. Publication remains explicitly shape-only replay, not a live authority verdict.
Undo and recovery: Revert this publication only together with its source merge, then regenerate from retained source. Preserve all history and journal evidence.
Multi-machine posture: Identical generated artifacts travel through git. No new store, runtime ownership, peer dependency or replication behavior.
Layer below: Existing committed-source register reader, source roster and trailing-input checks; generated outputs compared after substituting only source commit and generation identifiers.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: train6-final-publication | Regenerate once with the existing replay builder at exact merge commit d25d9674afe647db9fcd2bb91587f46a98e49fc8, then verify with the real clock and commit derived outputs separately. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-6-final-PROGRESS.md
Prompt review: No prompt, decoder or model-facing decision changes; source behavior is covered by the merge review and its 171 passing targeted tests.

Subject (7 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse the existing generator without hand-editing output, pinning the merged source exactly. Start guard is the committed source; end guards are real-clock publication and wiring checks; existing runtime limits are unchanged. No new machinery or runtime-completion claim.
80/20: Generation sha256:295158defe4a1eb204bee70d057aec55b6a67d7cbc8c7c2ab3b53183bb7b8463 contains 286 entries and 116 Rules. Final checks and pushed evidence are reported in train-6-final-PROGRESS.md through the desk copy of the local report.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
