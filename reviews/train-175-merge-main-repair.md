# Change review — Preserve train-175 and current main through register regeneration

Subject base: f1c04f1c9320fae145e2210628598e8df142b4cd
Review state: open
Reviewed content: none
Outcome: Merge main c20b68d1d9b5744a72c243c4dc8a4b69114179d6 into train-175, preserving both source behaviours and changelog histories. Resolve the conflicting derived approvedConversion value by recomputing it from the merged anchor, then replay the register from committed source. Main's Rule 121 and the candidate's expanded bootstrap shape both survive.
Affected rules: 26 (verify actual merged bytes), 37 (repair the source conflict), 49 (traceability), 69 (register references), 74 (this review), 90/91 (preserved governing history), 101 (plain commits), 112 (preserve both ancestries), 113 (declared machine posture), 116 (reuse generation).
Affected floors: secrets — no credentials or revelation changes; spend cap — no provider or budget changes; stop — no cancellation changes; no duplicate sends — no dispatch changes; durable intake — no journal or admission changes.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The merge imports already-approved governing text; the repair itself only regenerates its derived evidence and preserves both parents.
Side effects: Rule count becomes 121, the main amendment's register test follows it, and generated output binds the merged candidate. Candidate runtime changes, including signed subscription cache handling and native conformance evidence, remain intact. No model-facing excerpt, parser or runtime acceptance policy is changed by the resolution.
Undo and recovery: Revert the merge as a unit if rejected, retaining both parent histories; regenerate the register against the resulting committed source. Never restore a derived digest independently of its source. If a governing amendment itself needs reversal, use a corrective changelog revision rather than rewriting its history.
Multi-machine posture: Repository-distributed source and generated evidence; no new machine-local runtime state, transport or coordination mechanism. Existing checkpoints and all agent capabilities remain available on every supported machine.
Layer below: Compared both parents' scripts/build-register.mjs changes against their common base; only approvedConversion differed. Inspected merged register-source/bootstrap-anchor.json (candidate shape plus main rule/document hashes), scripts/register-source.mjs canonical hash and corpus extraction, the existing train-11-rederive-anchor.mjs desk tool, owner rehash/repin tools, and tests/e2e/register.test.ts real CLI replay and stale-output refusal.
Bug class: none
Bug evidence: Merge refusal named scripts/build-register.mjs at candidate f1c04f1c versus main c20b68d1; a local ordinary merge reproduced that conflict plus generated-output conflicts. This is integration evidence repair, with no runtime bug claim.
Hook bypass: none
Convergence: none

1.x comparison: Searched actual JKHeadley/instar origin/main ab256f684cda141db19abe8bba5300b980e1025b src/ and docs/specs/ for register replay, approvedConversion, conversion anchor, source pin and merge conflict, and git history for the first four terms (matching history ab26b7ca3). Read src/core/mergeRegistry.ts and its history ab26b7ca3: lossless machine union and lease/revocation resolution are for runtime machine records, not a derived constitutional digest. Read docs/specs/INTER-AGENT-MESSAGING-SPEC.md, Git-Sync Fallback: rebuild a derived conflicted index from retained source messages. Reuse that regeneration principle through 2.0's existing canonical anchor generator and register replay; no unrelated 1.x runtime code is transplanted. ONEX-LESSONS section 6 informs bounded foreground tests, testing the real assembled CLI, and preserving evidence according to the actual landing workflow.

Decision: train175-merge-anchor | Keep main's Rule 121 and candidate's bootstrap shape; regenerate the approval literal from their merged anchor using the existing desk tool. Neither parent's digest can bind the combined bytes. Preserve both ancestries and their review/changelog records. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-175-repair-PROGRESS.md
Deferral: generated/conversion.json:1 | not-a-deferral=generated constitutional text is imported and replayed, not a new postponement
Deferral: generated/register.json:1 | not-a-deferral=generated constitutional text is replayed whole, not a new postponement

Verification: nice -n 10 npm run build and npm run typecheck passed. node scripts/check-architecture.mjs passed. The canonical merged anchor hash is sha256:5c4f6ec00fff897d806c46112f957e2a9c8fb8b314795942a2fa5ad14d2d0503; the existing train-11 desk generator derived it, with no hand-edited pin. Owner rehash and grounding repin completed with zero changes. Register replay from merge commit 9f1e83dc4260ecbdcaa203af4b5cb0624a3a83fc succeeded: 298 entries, 121 rules, generation sha256:137df79eaa3a81f096d0d81fe44afe5c2b1af6d6537b33dfc7df850a434d704b. Generated evidence is committed in e77bb2c14. Both parent ancestries and their exact changelog suffixes were verified. Main's constitution files match main byte for byte; src/, tests/preview/briefing.ts and bootstrap-shape.json match the candidate. Both whitespace checks passed. Narrow register and constitutional briefing tests run in the foreground with one worker; their terminal results and final cheap checks are recorded in the absolute lanes progress reports. The Studio pipeline owns the full suite and live answer gate; no fresh full-run result is fabricated here.

## Closing block

simplestRobustRoute: This is the simplest robust route: an ordinary merge preserving both source histories, the existing canonical anchor generator, delegated owner rehash/repin, and register replay. It introduces no new product mechanism. The existing exact-byte and stale-output refusal checks hold the publication boundary.
80/20: The conflict is one derived value; retain the reviewed inputs and verify their regenerated composition. Independent acceptance remains with the desk.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
