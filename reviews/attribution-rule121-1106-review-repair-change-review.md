# Change review — fix/attribution-rule121-1106: unit review round 1 repair

Subject base: defd18c4d8d777a34d622ca2ad1eb7d9416b2463
Review state: open
Reviewed content: none
Outcome: Repairs the four must-fixes of the round 1 unit review. (1) Long text: chunkForJudge is ported from 1.x AttributionJudge (JKHeadley/instar, src/core/attribution/AttributionJudge.ts, read at c3529b2f7b49 in a local 1.x clone) and every chunk of a note or reply is its own recorded check under the existing call cap and stop; the first chunk keeps the plain id, so a short text is recorded exactly as before. Past ATTRIBUTION_CHUNK_LIMIT (8 chunks, 128 KiB) the tail is recorded unchecked with no call, so nothing is silently dropped; attributionPacket no longer truncates. (2) Answer validation: as 1.x AttributionJudge.support does, a claim backed by a marker and not labelled must carry ownWords own/relayed/unclear and a boolean faithful; otherwise the answer is unreadable and the existing step records unchecked ('unreadable answer'), with no hold and no extra call. (3) noteText extracts added patch lines per section and keeps only prose targets, so a code file in the same patch stays out of the note check. (4) The native macOS self-host conformance is re-declared from a passing contract run on this composition: tests/preview/native-harness-contract.test.ts passed its full contract case on this Studio (node-24.14.1, the declared runtime), and the adapter's own computed artifact, sha256:14d78f40f95e23fc8b226f4afcc326a976a8318043f9012cabe26cf5622f8d67, is the declared value; after the change the file passes 10 of 10 and the architecture check exits 0.
Affected rules: 121 (the whole note is checked; incomplete judgments are unchecked, never pass); 39 and 60 (the unread tail is a recorded, counted outcome, and the work per text is bounded); 41, 58 and 95 (an incomplete answer is no verdict); 86 and the purpose's ability requirement (code edits in a mixed patch are not gated); 105 and 115 (conformance re-declared from a contract run, not a digest copy); 116 (1.x code reused; no new classifier, no new mechanism); 74 (this record); 101 (plain git commit, no bypass flag, no stash).
Affected floors: secrets — unchanged, the judge keeps the model envelope; spend cap — each chunk reserves against the shared call allowance before dispatch, and the chunk bound caps calls per text; stop — checked before every chunk's call; no duplicate sends — unchanged, the send path still reads one merged result; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Takes the suggested tier; the change touches the send and write admission paths.
Side effects: A text over 16,384 characters now makes one recorded check per chunk (ids `<id>`, `<id>#1` …); attributionSummary counts each. The harness declaration's conformance digest changed.
Undo and recovery: Revert the repair, replay and record commits on top of defd18c4d.
Multi-machine posture: Unchanged; tree content only.
Layer below: Read the 1.x AttributionJudge (chunkForJudge, extract, support, validClaim), the journal reservation and settlement of attribution rows, the admission gate's attribution request and the hook's noteText call. Replayed the stored r3 real-model answers (lanes/attribution-2-0-replay r3-claude.jsonl and r3-codex.jsonl, 218 model answers each) through the new parser and decision read-only: all 436 verdicts are unchanged and none becomes unchecked.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Decision: attr-chunk-in-journal | Chunk in the journal's step wrapper rather than inside one check, so each chunk reuses the existing reservation, interruption and dedupe per id and digest without a new record kind. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/attribution-2-0-1106-PROGRESS.md
Decision: attr-chunk-limit | Bound one text to 8 judge calls; past it record the tail unchecked with no call, because an unbounded note would hold the admission hook for one judge budget per 16 KiB. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/attribution-2-0-1106-PROGRESS.md
Decision: attr-chunk-cut | Cut an over-long paragraph at its last line or sentence end inside the bound when one exists past half the bound, a small change to 1.x's fixed cut that keeps a marker on its quote's line. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/attribution-2-0-1106-PROGRESS.md
Decision: attr-r105-redeclare | Run the native contract on the Studio and declare the digest the adapter computed for the passing composition, as the review asked, instead of leaving R105 to the desk. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/attribution-2-0-1106-PROGRESS.md
Prompt review: No prompt text is changed: ATTRIBUTION_QUESTION is byte-identical. The parser and decision change what is accepted; the recorded r3 answers replay unchanged.
Prompt finding: 4106b49fff07 | protocol-literal | carried unchanged in journal.ts; this repair moved its line, not its text: existing source-bound action claim protocol.
Prompt finding: 849db3a6296a | protocol-literal | carried unchanged in journal.ts; this repair moved its line, not its text: existing fixed reply literal.
Prompt finding: 85544c20941f | protocol-literal | carried unchanged in journal.ts; this repair moved its line, not its text: fixed infrastructure outage sentence.
Prompt finding: e8708c7fea24 | protocol-literal | carried unchanged in journal.ts; this repair moved its line, not its text: existing sourceLabel attribution instruction.
Deferral: generated/register.json:1 | not-a-deferral=generated register output replayed from the repair commit, not authored prose

Subject (12 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, src/assembly/harness.declarations.json, tests/preview/attribution.test.ts, tests/preview/attribution.ts, tests/preview/journal.ts, tests/preview/tool-admission.mjs

## Closing block

simplestRobustRoute: Port 1.x's chunking and answer validation into the existing journal step, confine patch extraction to prose targets, and re-declare conformance from a real contract run; no new mechanism.
80/20: Four regression tests (tail case, unread-bound tail, partial answer, mixed patch) fail on the old code and pass now; the recorded real answers replay unchanged.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
