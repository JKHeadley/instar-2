# Change review — train-145 live merge dependency repair

Subject base: a2c5dce5a283fa172037c8efca1c4446e16acabd
Review state: open
Reviewed content: none
Outcome: Merge live 0705dae7 into train-145, retaining both histories and runtime TypeScript while resolving the dependency range conflict to the live exact 5.9.3 pin.
Affected rules: 26, 37, 49, 69, 74, 90, 101, 102, 111, 112, 113, 116
Affected floors: secrets — existing custody unchanged; spend cap — existing checkpoint unchanged; stop — existing admission unchanged; no duplicate sends — existing effect ownership unchanged; durable intake — existing journal unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Merge existing reviewed runtime setup and MCP changes; the only authored product resolution selects an exact dependency version already resolved by both parents.
Side effects: Future installs stay on TypeScript 5.9.3 rather than accepting later 5.9 patches. Generated publication is replayed from the merged source; source pins are derived by repository tools.
Undo and recovery: Revert the merge with its first parent selected and regenerate the register; retain both parent histories and do not touch installed state.
Multi-machine posture: Repository-only integration; every machine installs the same locked compiler, with existing machine-local connector custody and ownership unchanged.
Layer below: Both parent package manifests and lockfiles resolve TypeScript 5.9.3. Incoming MCP source merged cleanly; its recorded-shape admission tests and original runtime dependency regression exercise the consumers. The constitution matches origin/main. No changelog conflict or edit.
Bug class: integration
Bug evidence: reproducer=tests/preview/one-line-install.test.ts
Hook bypass: none
Convergence: none
Decision: train-145-repair-pin | Keep the live exact TypeScript 5.9.3 dependency in both manifests; preserve runtime dependency availability and both merge parents. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-145-repair-142154-PROGRESS.md
Decision: train-145-repair-register | Resolve generated conflicts by replay from committed merged source using existing desk tools, never hand-edit a pin. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-145-repair-142154-PROGRESS.md
Prompt review: No prompt, parser or admission logic authored by this repair. Incoming reviewed MCP admission code is retained byte-for-byte; its tests replay captured model and reply shapes. No live-browser completion is claimed.
Deferral: generated/register.json:1 | not-a-deferral=generated constitutional quotation, not a new deferred commitment

## Closing block

simplestRobustRoute: Ordinary merge plus the live exact dependency pin and existing register replay is the simplest robust route. No new machinery. Clean parent inspection guards start; targeted tests and register consistency guard completion; existing runtime safety floors remain the limits. No autonomous product-completion claim.
80/20: Limit repair to the manifest conflict and generated publication; run targeted regressions and required cheap checks; Studio owns full-suite and native conformance evidence.
VERDICT: author submission; independent desk review remains separate
