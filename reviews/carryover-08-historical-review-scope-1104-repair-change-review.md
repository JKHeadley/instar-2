# Change review — historical review scope submission repair

Subject base: 8b621876e0b33ca11ed71f5fcfa096d96adda04a
Review state: open
Reviewed content: none
Outcome: Supply the historical checker repair's missing 1.x applicability statement and renew the supported native Darwin conformance declaration from its actual contract, with dependent register publication.
Affected rules: 12, 26, 27, 34, 37, 42, 49, 70, 74, 90, 95, 101, 107, 111, 112, 113, 115, 116; architecture R105. The accepted Rules 12/27 classification implementation is unchanged.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain their existing enforcement and native contract coverage; no capability is removed or narrowed.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: This renews exact native conformance evidence and its dependent register publication; executable behavior is unchanged.
Side effects: The supported native tuple certifies the current composition and runtime. Dependent owner-reference pins and generated publication are refreshed through the existing desk tools. No historical record's subject is extended.
Undo and recovery: Revert the repair and regenerate publication with the matching composition; the old certificate cannot certify current bytes and the stale-certificate finding will return.
Multi-machine posture: Historical Git classification remains clone-independent; this certificate binds only the exact Darwin runtime and composition measured on the Studio.
Layer below: Read the 1.x candidates below, the existing 2.0 Git reader and prompt scanner, compositionClosure/compositionDigest/currentRuntime, selfHostCompositionEvidence, the native contract, and the desk's evidence-checked renewal and publication tools.
Bug class: none
Bug evidence: submission and evidence maintenance; native before/after reports and verification logs are retained under /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-08-historical-review-scope-1104-repair-native and summarized in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-08-historical-review-scope-1104-repair-PROGRESS.md.
Hook bypass: none
Convergence: none
Deferral: generated/register.json:1 | not-a-deferral=mechanically replayed register descriptions introduce no deferred work

## 1.x applicability for the historical checker repair

The 1.x `src/templates/scripts/convergence-check.sh` checks outbound content, `scripts/check-spec-review-link.mjs` checks rendered review links, and `src/core/PromptGuard.ts` protects runtime conflict-resolution prompts (inspected in JKHeadley/instar at fdcbf4e6aff46fae443e6dca626f0e94bff997e6); none classifies historical Git review subjects, so this unit reuses the existing 2.0 Git reader in `scripts/check-change-review.mjs` and `isPromptSourceFile`, `scanPrompts` and `validateRecord` in `scripts/change-review.mjs`, with no applicable 1.x implementation to port.

## Verification

The existing desk `merge-live-conformance.mjs --renew` checked all ten native cases before writing (nine passed; only the exact certificate assertion failed), then all ten passed after renewal. It recomputed the 275-file closure as sha256:dada29030a19e7a51a91c811f044154d97c45907df8f9a8d3cd602d2d5193f90 on the declared Node 24.14.1 runtime. TypeScript checking and build passed. Desk owner-manifest rehash and chain repin reported zero changed pins; register replay binds the renewed declaration to source commit 45479ce74dc4734ce3d26e84603e610f402db4ff. Final gate outputs are retained in the repair progress report.

## Closing block

simplestRobustRoute: This is the simplest robust route: add the missing applicability explanation to this record and the progress reports, then reuse the existing native contract and evidence-checked desk renewal tool followed by dependent publication. The start guard requires Darwin and the declared runtime; only the stale certificate assertion may fail before renewal; the end guard requires all ten cases to pass and restores the declaration on failure. No new implementation, test framework, gate, exception list or reduction of agent ability is introduced. This is tooling and conformance evidence, not row08's live restart/handoff proof; no unattended product completion is claimed.
80/20: The two review requirements are addressed through existing mechanisms; focused contract and mandatory gate checks establish this repair's scope. Full-suite qualification and independent acceptance remain the pipeline's work.
VERDICT: author submission; no independent verdict asserted
