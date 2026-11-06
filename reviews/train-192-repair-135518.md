# Change review — Merge live with receipt-bound Codex observations

Subject base: 7dc3c90b6107606828797d69dfe63464a6eb43c6
Review state: open
Reviewed content: none
Outcome: Restore the unchanged, still-fresh declaration from ade91bee0 and merge live 79be7e88 without inventing catalog or subsidy evidence.
Affected rules: 26, 37, 42, 49, 56, 74, 95, 101, 102, 111, 112, 113, 116
Affected floors: secrets — no credential access added; spend cap — same ratio, basis and freshness window; stop — preserve both parents; no duplicate sends — preserve claim and refusal handling; durable intake — no storage or admission changes.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Merged production launcher behavior and provider registry evidence require existing gates.
Side effects: Evidence deadline moves back to the proven observation, still within freshness. Newer receipts remain historical evidence; no host identity, capacity, measured price or invocation is certified.
Undo and recovery: Revert the source restoration or merge and regenerate derived register; unsupported evidence remains refused.
Multi-machine posture: Source declarations and receipts travel through git; local observation does not establish another host credential, quota or conformance.
Layer below: Both source declarations, committed receipts, unchanged Studio resolve-provider-stamps.py proof_for and semantic checks, and 1.x observed/canonical separation.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->

Subject (16 paths): docs/defects/codex-model-map-refresh-2026-11-05.md, docs/release-evidence/codex-model-map-refresh-1105.json, docs/release-evidence/session-volume-isolated-1105-report.md, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, src/assembly/production-codex-provider.declarations.json, tests/integration/model-provider-refusals.test.ts, tests/preview/journal-agent.mjs, tests/preview/session-volume.test.ts, tests/preview/tool-turn.declarations.json, tests/preview/tool-turn.mjs

Prompt review: No new prompt or parser is authored. Merge imports live volume-growth code and diagnostics unchanged and preserves train-192 cancellation cleanup; existing model-facing review dispositions remain in their original records. No live model acceptance claim.
Deferral: generated/register.json:1 | not-a-deferral=Generated register carries existing tracked text from the merged inputs; this repair introduces no deferred behavior.

## 1.X FIRST

Actual JKHeadley/instar origin/main 149377310f9b586641a05eddf196df4543dc031a: searched src/, docs/specs/ and git history. Read src/core/DoorwayRegistryReader.ts, src/scaffold/templates/jobs/instar/doorway-scan.md and docs/specs/DOORWAY-MODEL-KNOWLEDGE-REGISTRY-SPEC.md; history c12128176 and dfdd69e1d. Reuse the separation of canonical reviewed facts and local observations; that reader is not a merge-stamp resolver. ONEX-LESSONS freshness, login/quota and maintenance incidents require actual observations, not renewed labels.

Decision: train192-proven-observation | Restore exact ade91bee0 declaration bytes, whose committed train-187 receipt binds both timestamps and remains fresh. Preserve newer evidence without promoting it. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-192-repair-135518-PROGRESS.md
Decision: train192-live-merge | Merge 79be7e88 normally, preserving both histories and behaviors; regenerate derived artifacts with the delegated tools. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-192-repair-135518-PROGRESS.md

## Receipt selection

Unmodified Studio resolve-provider-stamps.py selected committed 0dd520cacc22b174c0fefd441e62ddd38a863c2a against live 79be7e88. Selected declaration SHA256 6279ad016a675418cc696d230c42c9e50537cda675b33d1b05db9e96a2037c8d, receipt SHA256 acc46c7e2613d13eabd2171b4201d093eb359cea7b0048620850f62828735c18. Both timestamps are 1793936455257. Live's unbound receipt is still rejected. Git otherwise auto-selects the live stamp because the restored value equals the merge base; explicitly retain the verifier-selected exact blob. Generated conflicts use live provisionally and are replayed from the merged source.

## Closing block

simplestRobustRoute: Restore exact proven committed bytes, pass the existing receipt checkpoint and perform a normal history-preserving merge. No added resolver, new timestamp, weakened check or capability reduction.
80/20: Targeted tests and cheap gates only; Studio owns full qualification. No unattended or independent acceptance claim.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
