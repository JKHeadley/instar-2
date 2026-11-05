# Change review — train-180 current-main merge repair

Subject base: edaac239fc860c2a38bd40b0533d0c8ebb71e7ad
Review state: open
Reviewed content: none
Outcome: Merge current main c20b68d1d into train-180, preserve both histories and candidate pre-send behavior, and regenerate the combined conversion anchor and register publication.
Affected rules: 4, 14, 86, 95 retain the existing intake and gate behavior; 69 and 90 keep references and governing history; 74 and 102 record repair decisions; 101 prohibits hook bypass; 112 preserves both histories; 113 declares machine scope; 116 reuses the existing generator. Main's approved Rule 121 is carried unchanged.
Affected floors: secrets — no custody changes; spend cap — no model calls or budget changes; stop — no cancellation changes; no duplicate sends — no effect logic changes; durable intake — no journal changes.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Merge carries already-approved constitutional text and regenerates governed register evidence.
Side effects: Register publishes the combined document set with 121 rules; no runtime or model-facing implementation changes. Both source parents remain ancestors.
Undo and recovery: Reject the candidate before installation, or revert this merge and its generated publication together using the preserved parent edaac239. No live state was changed.
Multi-machine posture: Repository build artifacts propagate through git. No runtime machine ownership, replication, credentials or authority changes. WSL performs portable checks; Studio retains native and full-suite verification.
Layer below: Full purpose and rule book, both parent diffs in scripts/build-register.mjs, merged bootstrap-anchor document map, canonical hash implementation, existing build-register replay, owner-reference manifests and their consumer checks. 1.x comparison below.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: train180-repair-merge | Preserve both parents and derive approvedConversion from the canonically hashed merged anchor; regenerate outputs with the existing builder instead of choosing either parent's generated hash. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-180-repair-130006-PROGRESS.md
Decision: train180-repair-checks | Use targeted portable checks and the delegated owner-manifest and chain repin tools; native and full-suite evidence remains the Studio gate's responsibility. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-180-repair-130006-PROGRESS.md
Deferral: generated/conversion.json:1 | not-a-deferral=regenerated output carries existing governing text, not a new deferral
Deferral: generated/register.json:1 | not-a-deferral=regenerated output carries existing governing text, not a new deferral

1.x comparison: JKHeadley/instar origin/main ab256f684cda141db19abe8bba5300b980e1025b; searched src/ and docs/specs/ for source pins, register wiring and manifest hashing, inspected src/core/CapabilityMapper.ts contentHash comparisons and hashContent, docs/specs/CAPABILITY-MAP-SPEC.md build-time hashing, and path history d5b30b1d7. The shared principle is hashes derived from actual bytes. Capability provenance does not implement 2.0 governed conversion, so retain the existing 2.0 generator rather than transplant unrelated code. ONEX-LESSONS.md maintenance section reviewed: use actual workflow evidence and preserve history.

## Closing block

simplestRobustRoute: This is the simplest robust route: an ordinary merge plus the existing canonical hash and register generators. No new mechanism, runtime limit, or authority is introduced; source and publication checks retain their existing failure behavior.
80/20: Author submits the focused repair and targeted evidence for the independent desk review; no independent acceptance is claimed.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
