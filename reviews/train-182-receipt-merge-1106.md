# Change review — merge live with its recorded Codex observation

Subject base: a302abd8e952776277dba82a155ec29ed540c853
Review state: open
Reviewed content: none
Outcome: Integrate live 79be7e88 and its existing receipt repair ee6bda5e into train-182, preserving both behaviors and histories while selecting an actual receipt-bound Codex observation.
Affected rules: 26, 34, 42, 56, 70, 74, 90, 91, 95, 101, 102, 107, 111, 112, 113, 116
Affected floors: secrets — sanitized receipt only; spend cap — no provider calls or budget changes; stop — inherited post-claim refusal settlement retained; no duplicate sends — existing claims and settlement unchanged; durable intake — no store changes.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Live integration includes existing send-claim settlement and session-volume infrastructure; manual conflict resolution is limited to evidence and generated publication.
Side effects: Live adds isolated session-volume behavior and settles post-claim refusal exits. Candidate notice assertions and census recovery remain. Catalog/subsidy timestamps now match the owning committed receipt; model identity, subscription billing, estimated ratio and freshness windows are unchanged. Generated register reflects combined source.
Undo and recovery: Revert the merge by first parent and regenerate publication; preserve both histories. No rebase, force push or installed-state migration.
Multi-machine posture: Source and sanitized receipt travel through Git. The receipt observes the Studio catalog and login only; it does not certify this WSL host, free capacity, actual price or another account. Platform-specific volume/native tests remain with the Studio gate.
Layer below: Read both declaration versions, their receipts, owning repair 83a7063bf, and existing resolve-provider-stamps.py proof_for/choose/plan. Read the ordinary merge of journal-agent.mjs; generated files are rebuilt from committed source, never hand-pinned.
Bug class: none
Bug evidence: Supplied merge refusal lacks a receipt-bound committed selection. Existing owning repair adds the missing actual subsidy-review time; no new runtime bug fix claimed.
Hook bypass: none; core.hooksPath unset and hooks directory contains samples only.
Convergence: none
Prompt review: No newly authored prompt, output parser or model verdict boundary. Normal merge preserves existing parent behavior and evidence; this repair resolves observation metadata and derived publication only.
Decision: train182-receipt-owner | Merge ee6bda5e763f38f4ed4b3bb84a6c31650e6f6d8f, which contains required live 79be7e88 and the existing owning receipt repair 83a7063bf. Resolve the declaration using its exact proven bytes, without inventing timestamps or weakening the planner. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-182-repair-142743-PROGRESS.md
Decision: train182-receipt-publication | Preserve candidate and live history with a normal merge; regenerate derived owner pins and register using existing tools. Keep native host verification distinct from portable checks. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-182-repair-142743-PROGRESS.md

1.x FIRST: Searched actual JKHeadley/instar main 3d9e102a2610e8ef5769e341f1683cc662428946 src/, docs/specs/ and Git history for model map, catalog and freshness. Read src/core/DoorwayRegistryReader.ts, src/core/CapabilityRegistry.ts deriveStatus, docs/specs/DOORWAY-MODEL-KNOWLEDGE-REGISTRY-SPEC.md and history 35b02553b0b0ea9892e1809091772679dd176102. Reuse the canonical-versus-observed evidence distinction; the 1.x runtime scanner does not fit this source merge, which already has a narrower receipt consumer. Read authenticated Studio ONEX-LESSONS area 6 after service recovery (same entries as the cached copy), including source-target guards, consumer verification, bounded testing and simplest-route lessons; inherit the original train-182 merge comparison in reviews/train-182-live-conflict-repair.md.

Verification: Build passed; the existing desk rehash/repin found zero stale pins. Register replay from eea98e78277ddf7d099bdc188b90c36e1ac8a8f2 succeeded with generation sha256:4c49dc1ba1e82be43767c314aa9acde3653c69dc57e12f1179cd163da0a5852c (299 entries, 122 rules, 34 terms, 114 prerequisites; shape-only). Current authenticated receipt planner reproduces the supplied refusal for the old pair and selects the existing owning repair for the new pair. Targeted and final gate outcomes are recorded in the named report.

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse the already committed owning receipt repair and ordinary merge, retain the refusing checker, and regenerate existing derived publications. Exact source ancestry and receipt binding guard entry; targeted tests and cheap checks guard submission. No new machinery, reduced ability or live acceptance claim.
80/20: Only the narrow integration and affected checks run on WSL; the Studio pipeline owns full-suite and native acceptance.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
