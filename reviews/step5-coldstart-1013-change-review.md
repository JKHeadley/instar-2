# Change review — cold conversation-record recovery

Subject base: fe0c95d15cb73d2d1e72c753c396c6113f09c337
Review state: open
Reviewed content: none
Outcome: Remove repeated prefix sorting, full ancestry walks and all-pairs empty correction scans from cold signed-record recovery; measure the populated 20,000-fact source and preserve replay equivalence.
Affected rules: 7, 13, 26, 28, 30, 32, 33, 34, 35, 42, 49, 70, 74, 101, 102, 105, 111, 113, 115, 116
Affected floors: secrets — unchanged signed-frame secret check; spend cap — unchanged reserve-before-spend; stop — unchanged owners; no duplicate sends — no effect path changes; durable intake — original signed source remains authoritative
Operator questions: none; brief explicitly leaves publication pins and byte-bound R105 native certification to the Studio desk
Suggested tier: significant
Declared tier: significant
Tier rationale: Changes recovery of authority-bearing signed records; source, standing and refusals must remain equivalent.
Side effects: Disposable per-operation indexes retain memory proportional to facts plus required constitutional history. Rich constitutional histories still pay for their real dependencies; no universal linear bound on arbitrary dense causal graphs is asserted. Historical roots supplied with a non-causal decode context cannot become reusable ancestor summaries. Live owned decoders remain on their existing per-derivation path.
Undo and recovery: Revert this unit and use the previous full walks. No durable cache, format or migration is introduced. Crash before publication loses only derived memory; reopen revalidates the retained signed source. Existing index publication stays atomic.
Multi-machine posture: Facts remain shared and machine-signed. Chain heads are indexed independently per machine, retaining epoch and frontier checks. Sparse histories preserve cross-machine joins and deduplication. Derived indexes are machine-local and discarded on restart.
Layer below: Original extendsChain and decodeEnvelope, causalCone DFS/refusal order, HistoricalRead origin/signature and capture standing, current owned decoders, projection correction and retraction ordering, and encrypted-storage reopen.
Bug class: unit
Bug evidence: reproducer=tests/recall/read-benchmark.test.ts
Hook bypass: none
Convergence: none
Prompt review: No prompts, model-output parsing or accept/escalate/refuse policy changes. The existing recorded intake corpus is retained. Recorded-verdict replay is expressly exempted by the brief.
Decision: cold-chain-heads | Index ids and maximum chain positions within recovery; retain original signature, duplicate, genesis, epoch and frontier admission checks. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step5-cold-1013-PROGRESS.md
Decision: cold-sparse-history | Retain only ancestor constitutional contributions in private per-operation summaries; reuse only under the ancestor's own causal standing and preserve DFS order, with full-walk fallback. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step5-cold-1013-PROGRESS.md
Decision: cold-causal-stack | Resolve causal-index dependencies iteratively so a tail-first cold read of a 20,000-fact chain cannot exhaust the call stack. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step5-cold-1013-PROGRESS.md
Decision: cold-projection-scan | Reuse causal-index completeness proofs and group correction candidates once while retaining exclusion/retraction/winner order. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step5-cold-1013-PROGRESS.md
Decision: cold-replay-proof | Compare sparse reads to the forced full-cone branch, exercise crash cuts and encrypted reopen, and separate synthetic signing from measured source recovery. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step5-cold-1013-PROGRESS.md

Decision: cold-frame-reuse | Reuse only privately verified exact origin bytes/key and byte-equal immutable admitted frames; changed policy, paths, captures and bodies still revalidate. Single-slot P1 memo and weak P2 identities bound retention without a durable checkpoint. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step5-cold-1013-PROGRESS.md

Decision: cold-canonical-walk | Validate and encode canonical JSON in one walk, removing an intermediate copy while keeping exact schema-1 bytes and structural refusals against the old snapshot-plus-encode oracle. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step5-cold-1013-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest route: fold each verified ancestor once per operation and index exact chain/correction lookups. No signed checkpoint, new durable file, scheduler or recovery protocol. The named failures are quadratic restart latency and cold tail-first stack exhaustion. Original signature, standing, capture, full-walk fallback and atomic-publication checks remain the guards. Measured constant costs also justify single-pass canonical encoding and privately retained verified frame bytes; neither caches a body/standing decision. No live installation or unattended live migration claim; this is the bounded cold-record slice with Studio-owned acceptance.
80/20: Prove equality and refusal neighbors, measure the actual populated corpus, and report the absolute time reached rather than weakening verification to meet a latency target.
VERDICT: author submission; no independent convergence claimed
