# Change review — train-188 live merge with receipt-bound model evidence

Subject base: d01801ab15ca8b3f6f66c69fc19a6937cc741fa9
Review state: open
Reviewed content: none
Outcome: Integrate live 79be7e88e9e6445a675d1c7117d68da4c9ae84a4 while retaining train-188 behavior and both histories. Resolve the Codex observation conflict with the unchanged declaration from 5eefd6fd9, whose existing train-187 receipt explicitly binds both timestamps and remains fresh.
Affected rules: 26, 36, 44, 56, 60, 61, 66, 74, 90, 95, 101, 102, 112, 113, 116
Affected floors: secrets — no credential reads or publication; spend cap — no model invocation or budget change; stop — incoming definite refusal finalization retained; no duplicate sends — incoming consumed-claim handling retained; durable intake — existing journals and both histories retained.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Merge includes existing bounded session-volume and shared refusal repairs. The authored conflict resolution changes only observational evidence and generated publication; full composition qualification remains with the Studio.
Side effects: The selected timestamp is earlier than either conflicting stamp, so its unchanged freshness window expires earlier. It is supported by complete existing evidence, unlike the two conflicting candidates. No model, estimated subsidy ratio, routing or provider capability changes. Native conformance for the combined composition needs Studio requalification.
Undo and recovery: Revert the merge against its first parent and regenerate publication. Retain every receipt and historical record; no live installation is changed.
Multi-machine posture: Repository publication travels through git. The reused catalog receipt is machine-local observation and does not certify another machine's credentials, quota, billing or inference. macOS storage and native conformance checks remain Studio-owned.
Layer below: Both governing documents at origin/main aa8cbc934, both merge parents, original declaration and receipt at 5eefd6fd9, production provider subscription policy, existing register freshness checks, and read-only desk resolve-provider-stamps.py. The planner requires an explicit subsidy reviewedAt rather than inferring it from catalog time. Existing incoming owner records retain their scope and limitations.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: No authored prompt, parser or model-facing accept/escalate/refuse change. Incoming code and tests merge unchanged from their owners; no new model-output replay claim. The evidence selection uses recorded catalog bytes, not model stubs or inference claims.

1.x comparison: Searched actual JKHeadley/instar origin/main ab10430bca3204d5ca34b90c814fcd5408017bbd src/ and docs/specs/ for model freshness/catalog behavior. Read src/core/DoorwayRegistryReader.ts and docs/specs/model-registry-freshness-guard.eli16.md, history 35b02553, c1212817, e42db45d and 55ff08a7, and ONEX-LESSONS sections 4 and 6. Reuse the separation of reviewed facts from machine-local reachability and bounded freshness. The 1.x filesystem reader does not fit an immutable declaration merge; existing 2.0 receipt validation and publication suffice.

Decision: train188-133026-evidence | Select the complete previously committed train-187 observation at 5eefd6fd9 unchanged, retaining both stamps 1793936455257 and the original finite windows. Preserve the later incomplete receipts as history without promoting their unsupported timestamps. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-188-repair-133026-PROGRESS.md
Decision: train188-133026-merge | Preserve incoming live session-volume and refusal behavior together with train-188 crash-recovery tests; source files merge without conflict. Keep both changelog histories unchanged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-188-repair-133026-PROGRESS.md
Decision: train188-133026-publication | Recompute owner pins and generated register using delegated tools; retain the original native certificate pending exact-head Studio qualification, without changing a declaration to claim an unrun check. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-188-repair-133026-PROGRESS.md

Verification: The existing receipt validator accepts the selected committed bytes and rejects the original candidate for mismatched model time, live for missing subsidy review time, and expired/future controls. Targeted tests and final publication checks are recorded in the report.

Publication: Delegated owner and support rehash changed no pins. Register replay from 3735bf536db3df383b941e6d5a82eecfa0d1ef92 generated 299 entries, 122 rules and 34 terms, generation sha256:c1814e001fbc4a68005ce73aff95d5b425885ac51fc5bcac89f50bade31eda3d. This record covers the merge and its generated publication. Build and architecture checks passed; 42 targeted tests passed.

## Closing block

simplestRobustRoute: Reuse complete existing evidence and merge the existing source repairs, then regenerate derived publication. This is the simplest robust route; no new gate, receipt, timestamp or runtime machinery. The start guard is the provenance refusal, the end guard is receipt validation and register consistency, and the original freshness windows remain the limit guards. No live completion is claimed.
80/20: Run typecheck, focused model-map checks, pinned-text gates and cheap architecture/register/review checks; Studio owns full and native composition checks. No full suite or deliberate machine load.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
