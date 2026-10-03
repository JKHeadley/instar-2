# Change review — cint-L43 pipeline repair: Part Fourteen body names the rewrite review, and the owner pin follows the merge

Subject base: 973de12d3a114308660ff2ec2cf71e7b6d40555c
Review state: open
Reviewed content: none
Outcome: Plan row #420. The studio full run of cint-L43 at 973de12d failed 7 tests in 2 files. (1) P13-NF-02 (tests/harness-adapters/foundation.test.ts): the governed-document checker refused four body lines in docs/18-sentinel-holders (13-negative-contract-fixtures.md:83-84 and 16-the-guidance-sentinel-family.md:62 and 113) because each said "revision review", and rule 91 bans the history marker "revision" in a design body. There it names the review of the agent's rewrite, not a document history. The source fix rewords those four occurrences to "rewrite review" (same meaning; the changelog keeps its own wording). The checker now passes and P13-NF-02 passes. (2) Six tests in tests/e2e/register.test.ts failed with "reference artifact hash differs: tests/preview/journal-obligations.test.ts": the owner-reference pin trailed the merged file after the round-2 merge. The desk repin (desk-rehash-owner-manifests.mjs, 1 pin in preview.json; desk-repin-chain.sh) refreshed it, and the register was replayed at that commit. No pin was hand-edited. lint, register:check and the governed-document check pass.
Affected rules: 91 (the body reads as one version, no history marker), 37 (each failure fixed at its source, no quarantine), 90 (register replayed by the tool, not hand-edited), 74 (this record), 116 (a four-line wording change plus the standard desk chain)
Affected floors: secrets, spend cap, stop, no duplicate sends, durable intake — all unchanged (documentation wording and regenerated pins only; no code path changed)
Operator questions: none
Suggested tier: low
Declared tier: low
Tier rationale: design-body wording plus desk-regenerated pins and register; no behaviour changes.
Side effects: none; register replay at 2bb21146.
Undo and recovery: revert the three commits; the checker would refuse the old wording again.
Multi-machine posture: unchanged; no runtime path is touched.
Layer below: scripts/check-governed-docs.mjs and the desk repin tools, unchanged.
Bug class: none
Bug evidence: none
Hook bypass: none (plain commits; core.hooksPath is unset)
Convergence: none
Decision: cint-L43-pipeline-rewrite-review | reworded "revision review" to "rewrite review" in the Part Fourteen body instead of adding four line-pinned exemptions to the checker: the word names the review of a rewrite, and a wording change is simpler and does not drift when lines move (Rule 116) | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L43-PROGRESS.md
Prompt review: no model-facing text is added or changed (the code comments and test names that say "revision review" are untouched; only the design body changed).
Deferral: generated/register.json:1 | not-a-deferral=generated register replay at the repair commit

Subject (10 paths): docs/18-sentinel-holders/13-negative-contract-fixtures.md, docs/18-sentinel-holders/16-the-guidance-sentinel-family.md, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json

## Closing block

simplestRobustRoute: fix the wording the checker refuses at its source, and let the desk chain regenerate the trailing pin and register.
80/20: 0 must-fix, 1 note: targeted tests only (P13-NF-02 and the register e2e file); the pipeline reruns the full suite.
VERDICT: author submission; the independent verdict is recorded as a pass
