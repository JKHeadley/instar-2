# Change review — Repair historical capability replay after step-check retirement

Subject base: 0a8305ce7d58a97f7aee1423df48fe42343582fd
Review state: open
Reviewed content: none
Outcome: Restore the five historical capability-note comparisons after the accepted step-check retirement while preserving captured evidence.
Affected rules: Rules 36, 37, 49, 70, 74, 78, 84, 101, 102, 111, 112, 113, 116.
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged; test-only translation, no runtime changes.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One replay test file changes; no production prompt, reader, authority, state or effect path changes.
Side effects: Only exact historical step-check inventory text is removed for comparison; negative controls retain altered retirement text and unrelated capability drift. Historical PASSes do not certify current live-model quality.
Undo and recovery: Revert this repair commit to restore the previous comparison and its five known failures; no state migration or runtime recovery needed.
Multi-machine posture: Shared repository test repair runs identically on each host; no machine-local product state or cross-machine protocol changes.
Layer below: scripts/register-shipped.mjs excludes retired features; tests/preview/capabilities.ts retains retired status and promotion consistency. Existing captured notes and judge digest assertions remain intact.
Bug class: integration
Bug evidence: reproducer=tests/preview/selfdesc-abilities.test.ts
Hook bypass: none
Convergence: none
Decision: train106-retired-replay | Translate only the exact retired step-check inventory line in the existing test helper; retain captures and digests to avoid rewriting historical evidence. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/limit-notice-1020-repair-205520-PROGRESS.md
Prompt finding: 0d4664ea9de7 | quoted-evidence | Existing exact historical guidance comparison; no production prompt edits or literal-trigger judgment — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "run without another yes. the operator can tighten or revoke trust through setup-"
Prompt finding: 14d7eeccc218 | quoted-evidence | Existing exact historical guidance comparison; no production prompt edits or literal-trigger judgment — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "checked when made. workspace work and public reads are already allowed. register"
Prompt finding: 45e37ea2e9e9 | quoted-evidence | Existing exact historical guidance comparison; no production prompt edits or literal-trigger judgment — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "checked when made. workspace work and public reads are already allowed. register"
Prompt finding: 4b98dc2a1b9f | quoted-evidence | Existing exact historical guidance comparison; no production prompt edits or literal-trigger judgment — fixture-phrase tests/preview/briefing.ts <- tests/preview/selfdesc-abilities.test.ts: "tools: full claude code set"
Prompt finding: 95e349aaf4ac | quoted-evidence | Existing exact historical guidance comparison; no production prompt edits or literal-trigger judgment — fixture-phrase tests/preview/briefing.ts <- tests/preview/selfdesc-abilities.test.ts: "via the doorway's four tests; standing grants need no new approval."
Prompt finding: 9781075d458e | quoted-evidence | Existing exact historical guidance comparison; no production prompt edits or literal-trigger judgment — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "the effect doorway reports any refusal and its reason; say so plainly."

Subject (1 paths): tests/preview/selfdesc-abilities.test.ts

Reuse provenance: Cherry-picked unchanged implementation from b84884e440c12aa57b8ac1d20420d3fa856acb98; subject base follows its new parent on limit-notice-1020. The original train review remains in that source commit.
Deferral: generated/register.json:1 | not-a-deferral=derived register quotation of governing rules, not a deferred commitment

## Closing block

simplestRobustRoute: Extend the existing explicit historical-note translation with one exact labelled line removal; this is the simplest robust route. Keep whole-note equality, immutable captures and original judge digests; add no runtime machinery.
80/20: Five reproduced failures now pass with the original ten tests plus a narrow negative-control test; full-suite acceptance belongs to the Studio gate.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
