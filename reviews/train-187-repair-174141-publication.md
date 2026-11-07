# Change review — train-187 merged register publication

Subject base: 93e8b37fed67e1752e050aceafc989b544381158
Review state: open
Reviewed content: none
Outcome: Publish all seven register outputs replayed from the merged source, generation sha256:e3a9b8308a46ccdda1d12364675defec4a49f8f10f6f66fc07cd2f38627f2631.
Affected rules: 26, 37, 49, 69, 74, 101, 102, 111, 112, 113, 116
Affected floors: secrets — no custody changes; spend cap — no provider call; stop — unchanged; no duplicate sends — no dispatch; durable intake — unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: Derived publication only; source merge has its own significant integration review.
Side effects: Register now binds merged source 93e8b37fed67e1752e050aceafc989b544381158; 299 entries, 122 rules, 34 terms. Existing 48 warnings and 114 prerequisites remain explicit, and authority remains shape-only.
Undo and recovery: Revert the source merge and regenerate through the same replay command. No installed state is touched.
Multi-machine posture: Git shares exact source-bound artifacts; no WSL result is a macOS conformance claim.
Layer below: The existing generator replayed committed source. Delegated owner-manifest rehash and support-source repin both completed with zero changes. Normal-priority npm run build passed before replay. The sole architecture finding is the charter-exempt native macOS self-host certificate, left unchanged for Studio.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: train187-merge-publish | Publish the existing generator's exact merged-source output, retaining shape-only authority and the native certificate qualification gap. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-187-repair-174141-PROGRESS.md

1.x comparison: Inherit reviews/train-187-repair-174141.md research at actual JKHeadley/instar main 1723950ceca23f0ae516e4cb9d3e675ae1c1eea3: src/core/GitSync.ts, src/core/LLMConflictResolver.ts, src/core/SafeGitExecutor.ts, docs/specs/INTER-AGENT-MESSAGING-SPEC.md and docs/specs/worktree-reaper-squash-merge-blindness.md; WorktreeManager history 5143e436, 269da957, def73b19 and ONEX-LESSONS section 6. Preserve both source intents and rebuild derived publication; no runtime sync transplant fits a development-branch merge.

Deferral: generated/register.json:1 | not-a-deferral=Replayed serialized existing registry descriptions; this publication postpones no implementation.

## Closing block

simplestRobustRoute: Use the existing replay generator on the committed merge. No new pin editor, runtime machinery or authority. Exact source commit is the start guard; final checks and independent Studio qualification are the end guards.
80/20: Targeted merge tests and portable publication checks suffice for this submission; the Studio owns full qualification and native conformance. No independent acceptance is asserted here.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
