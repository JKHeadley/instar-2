# Change review — pinned indexed conversation record reads

Subject base: ac3bd4d8874495f8b66b571837a1380995113d7a
Review state: open
Reviewed content: none
Outcome: Build verified-source read indexes for conversation messages, bounded recall and owner-replayed open runs; retain the current history source and document migration gaps.
Affected rules: 7, 11, 13, 30, 32, 33, 34, 35, 42, 47, 49, 74, 96, 101, 102, 105, 110, 111, 113, 115, 116
Affected floors: secrets — existing capture redaction and reveal remain; spend cap — existing reserve-before-rerank remains; stop — existing recall and grounding checks remain; no duplicate sends — no sending or admission changes; durable intake — facts remain the source and indexes are disposable
Operator questions: Whether the brief publication-pin exemption includes the R105 native-composition conformance re-pin; charter item 7 names a narrower exception. Studio re-certification remains required before claiming that native tuple is current.
Suggested tier: significant
Declared tier: significant
Tier rationale: New derived evidence read path, with no authority change, source migration or live wiring.
Side effects: Hot readers see an explicit immutable as-of source, so compositions must refresh after intake/append. Cold verification and refresh still scale with history. Work excludes only owner-proven terminal runs; promises without run records remain a schema gap. Existing recall without an index retains its full-scan behavior.
Undo and recovery: Remove the optional reader index and use the original scan. Rebuild discarded indexes from verified facts after restart; failed rebuilds publish nothing and do not modify facts. No on-disk migration or cache file is introduced.
Multi-machine posture: Signed facts remain shared; derived indexes are deliberately machine-local and rebuilt from the locally verified source. No ownership, replication or effect authority changes.
Layer below: Fact-store prefix verification and corruption checks, run-owner fold and admission witnesses, recall bounds/exclusions/rerank/spend/stop/reveal, encrypted production storage reopen, and journal record definitions were inspected and exercised.
Bug class: unit
Bug evidence: reproducer=tests/recall/read-benchmark.test.ts
Hook bypass: none
Convergence: none
Prompt review: No prompt, parser or verdict policy changes; indexed and full-scan recall return identical results and reranker candidate text on recorded intake shapes.
Decision: record-pinned-read-view | Publish an explicit as-of verified-source index; retain integrity checks, never relabel cached evidence as live authority, and skip excluded identity ranges to prevent replicated duplicates from causing a full scan. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step5-record-1013-PROGRESS.md
Decision: record-owner-work-fold | Reuse foldRun with its status and witness checks; group only owner-replayed nonterminal runs, with assembly-supplied conversation mapping. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step5-record-1013-PROGRESS.md
Decision: record-disposable-rebuild | Keep no durable index file; publish only after complete verification and projection so restart rebuilds from facts without dual-write recovery. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step5-record-1013-PROGRESS.md
Decision: record-measured-fixture | Repeat recorded intake text using test signing identities, real store verification and bounded query timing; distinguish cold rebuild and RAM storage from disk durability. The explicit 20k measurement has a 40-minute allowance because its cold status preparation measured 563 seconds; the normal 200-fact test is limited to 30 seconds, with all assertions retained. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step5-record-1013-PROGRESS.md
Decision: record-migration-inventory | Preserve the journal as source; document missing semantic schemas and adoption joins for RG-B and step 3 rather than inventing commitment or summary semantics. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step5-record-1013-PROGRESS.md

Decision: record-operation-ancestry | Reuse ancestor bodies only within the existing read-only historical operation, in a private weak map; a fresh operation revalidates policy and captures. The populated-work benchmark exposed repeated descendant validation costing about 70 seconds at 2002 facts. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step5-record-1013-PROGRESS.md
Decision: record-iterative-ancestry | Preserve the recursive walk's exact depth-first output and refusal order using an explicit stack, so a 20000-fact lineage cannot exhaust the host call stack. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step5-record-1013-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest route: one verified read, disposable in-memory indexes, the existing semantic owner's work fold and the unchanged bounded recall ranking. No second durable store or index checkpoint protocol. The measured cold-work bottleneck additionally requires operation-local ancestor reuse and a stack-safe equivalent traversal; neither changes ancestry, standing or live-owner revalidation. A small identity-range tree skips repeated excluded captures without walking the whole history; a plain prefix scan cannot bound that replication case. Atomic publication prevents half-built context after an interruption. Source metadata and explicit refresh prevent an old read from claiming currency. Existing authority projections and outbound floors remain the guards. No unattended live-history migration is claimed; acceptance on a copy is desk-owned by the brief.
80/20: Verify exact result equivalence, source identity/count isolation, interruption/reopen and resource floors before optimizing refresh or migrating history. The second-half migration remains the already-owned plan step.
VERDICT: author submission; no independent convergence claimed
