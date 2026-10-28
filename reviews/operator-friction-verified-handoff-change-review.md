# Change review — Organizational approval hierarchy amendment

Subject base: 2f46478df4fd512e74d612ac494dc88441aa3bd6
Review state: open
Reviewed content: none
Outcome: Justin approved the constitutional wording in PR #185 on 2026-10-27. The amendment makes the agent's employee role explicit and connects the existing self-unblock, principal, mobile action, and approval rules. It does not claim the proposed cross-agent receipt runtime is shipped. The PR's document CI exposed two workflow defects: it imported TypeScript without installing dependencies, and checked GitHub's synthetic merge commit as though that commit needed a proposal review record. This change installs locked dependencies and checks the proposed head. Generated register evidence remains blocked by the unrelated overdue `preview.step-check` graduation gate, tracked in #184; do not present this draft as landed.
Affected rules: 23, 28, 72, 74, 79, 82, 90
Affected floors: secrets — unchanged; no credential is read or written; spend cap — unchanged; no model call added; stop — unchanged; no run-control path touched; no duplicate sends — unchanged; no send path touched; durable intake — unchanged; no intake or store path touched
Operator questions: none for this wording. The separate `preview.step-check` graduation needs its own honest decision under #184.
Suggested tier: critical
Declared tier: critical
Tier rationale: The source-of-truth constitution governs future agent behavior and permission design across the fleet even though this patch changes documents only.
Side effects: Agents may cite the amended language after landing. Before then, the old constitution remains authoritative. Document CI now installs the lockfile's dependencies before checks, adding install time and requiring registry access. On pull requests its review checker sees the proposed head instead of a synthetic merge commit; merge compatibility remains guarded by later landing checks. The generated register and rule map must be rebuilt from this exact source head once the independent graduation gate is resolved.
Undo and recovery: Revert the new purpose and rule-book versions with a new governed changelog version and regenerate the register; never rewrite earlier changelog entries.
Multi-machine posture: This is an Instar 2.0 constitutional source change. It does not alter deployed 1.x machines; implementation guidance is separately proposed in instar#2414, while receipt runtime is tracked in instar#2413.
Layer below: Existing identity and approval plumbing remains the enforcement layer. This wording requires verified exact-scope operator or delegated-peer proof at the future action doorway; a Threadline sender signature alone does not grant human authority.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->

Subject (8 paths): .github/workflows/document-checks.yml, docs/00-the-purpose.changelog.json, docs/00-the-purpose.changelog.md, docs/00-the-purpose.md, docs/01-the-rules.changelog.json, docs/01-the-rules.changelog.md, docs/01-the-rules.md, reviews/operator-friction-verified-handoff-change-review.md

## Closing block

simplestRobustRoute: Amend the existing purpose and Rules 23, 79, and 82 with append-only governed changelogs; reuse the current approval hierarchy instead of adding a parallel policy document.
80/20: Exact-scope proof and a direct phone action cover the common cross-agent approval case while preserving human control over consequential decisions.
VERDICT: author submission; independent review and final-head landing gates remain pending.
