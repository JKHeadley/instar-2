# Change review — fix/attribution-rule121-1106: unit review round 2 repair

Subject base: 294ef2a7ff1da53ef323134d8182c974d9892a5f
Review state: open
Reviewed content: none
Outcome: Repairs the round 2 must-fix: a cut inside a credited quotation turned a correctly sourced note into a no-quote refusal. Exact facts are now computed once over the whole text and each chunk answers for the markers in it, as 1.x does (JKHeadley/instar main 5118466c2, src/core/attribution/AttributionJudge.ts lines 129-143: the model counts markers within its chunk, the caller's facts belong to the whole text). Chunk edges stay outside a quote and its marker whenever the attribution fits one check, so the judge reads the credit whole. An attribution longer than one check keeps its exact facts, and its reading is recorded unchecked, never refused for being split. The call cap, stop, reservation, chunk limit, note size and write ability are unchanged.
Affected rules: 121 (a true credit clears wherever it falls, and words not in the record are still refused); 4 and 86 (an exact refusal now rests only on facts true of the text as written, never on the checker's own split); 39 and 60 (the split reading and the unread tail stay recorded outcomes, and no source is looked up past the read bound); 41, 58 and 95 (no verdict is recorded as unchecked, never as a pass); 116 (the 1.x split is restored; no new service, gate or record kind); 74 (this record); 101 (plain git commit, no bypass flag, no stash). Purpose: ability is not reduced; a refused note was the defect and the write stays available.
Affected floors: secrets — unchanged, the judge keeps the model envelope; spend cap — unchanged, each chunk still reserves against the shared allowance and the chunk bound caps calls per text, and a split attribution makes no call; stop — unchanged, checked before every chunk's call; no duplicate sends — unchanged, the send path still reads one merged result; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Takes the suggested tier; the change touches what decides a refusal on the send and write admission paths.
Side effects: In a text over 16,384 characters, chunk edges and so chunk digests differ from the previous head, and paragraphs are no longer repacked: chunks are exact slices of the text. A short text is one chunk with the same facts, so its row is unchanged. Chunks can run shorter than before when a credit is moved whole to the next chunk, which can reach the 8-chunk limit a little sooner; the rest is recorded unchecked as before. MarkerFact gains start and end offsets, which are never persisted or sent to the model. A marker in the unread tail still has no exact check, as before.
Undo and recovery: Revert the repair, replay and record commits on top of 294ef2a7f.
Multi-machine posture: Unchanged; the check reads the journal the same way on any machine, and this change adds no state.
Layer below: Read 1.x AttributionJudge at main 5118466c2 (chunkForJudge, extract's marker counting), journal attributionStep and attributionOf, and the send and write callers. Replayed the stored r3 real-model answers read-only (r3-claude.jsonl and r3-codex.jsonl, 218 model answers each): all 436 keep their verdict and reasons and none becomes unchecked. markerFacts on all 534 rows is identical between the previous head and this one.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Decision: attr-facts-whole-text | Compute exact facts once over the whole text and give each chunk the facts of its markers, renumbered for its packet, because that is the 1.x split and it makes it impossible for any cut to change a fact. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/attribution-rule121-1106-repair-030421-PROGRESS.md
Decision: attr-cut-outside-credit | Keep chunk edges out of a quote and its marker when the attribution fits one check, because correct facts alone would still show the judge half a credit with no marker, which it could read as unsourced. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/attribution-rule121-1106-repair-030421-PROGRESS.md
Decision: attr-oversize-unchecked | When an attribution is longer than one check, keep its exact refusal and record the reading unchecked with no call, because half a credit cannot be judged and being split is no ground to refuse. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/attribution-rule121-1106-repair-030421-PROGRESS.md
Decision: attr-exact-slices | Chunks are exact slices of the text instead of repacked paragraphs, because offsets are needed to place facts; this supersedes attr-chunk-cut and still prefers paragraph, then line, then sentence ends. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/attribution-rule121-1106-repair-030421-PROGRESS.md
Decision: attr-no-lookup-past-bound | Resolve sources only for markers inside the read chunks, because whole-text resolution would have made a 1 MiB note scan the journal per marker on the admission path and broken the existing work bound. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/attribution-rule121-1106-repair-030421-PROGRESS.md
Prompt review: No prompt text is changed: ATTRIBUTION_QUESTION is byte-identical. What the model sees changes only for a text over the bound: where the chunks end, and each packet numbers its markers from 0 as before. The recorded r3 answers replay unchanged, both as written and with padding placing the bound inside the first attribution.
Prompt finding: 4106b49fff07 | protocol-literal | carried unchanged in journal.ts; this repair moved its line, not its text: existing source-bound action claim protocol.
Prompt finding: 849db3a6296a | protocol-literal | carried unchanged in journal.ts; this repair moved its line, not its text: existing fixed reply literal.
Prompt finding: 85544c20941f | protocol-literal | carried unchanged in journal.ts; this repair moved its line, not its text: fixed infrastructure outage sentence.
Prompt finding: e8708c7fea24 | protocol-literal | carried unchanged in journal.ts; this repair moved its line, not its text: existing sourceLabel attribution instruction.
Deferral: generated/register.json:1 | not-a-deferral=generated register output replayed from the repair commit, not authored prose

Subject (11 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, reviews/attribution-rule121-1106-round2-repair-change-review.md, tests/preview/attribution.test.ts, tests/preview/attribution.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: Restore 1.x's whole-text exact facts in the existing journal step and keep cuts out of a credit; the only added mechanism is the span-aware cut, which prevents the named failure of the judge reading half a credit, a failure correct facts alone cannot prevent. No new service, gate, record kind or reduced limit.
80/20: The reviewer's failing offsets and their neighbours fail on the old code and pass now, words not in the record stay refused, and the recorded real answers replay unchanged.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
