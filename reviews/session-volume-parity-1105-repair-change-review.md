# Change review — preserve the explicit session-volume ceiling

Subject base: 4903db56dcf689172a204ecd2ec51b294e62de47
Review state: open
Reviewed content: none
Outcome: An explicit bytes value, including SESSION_VOLUME_BYTES (2 GiB), retains its exact ceiling unless maxBytes is explicitly overridden. Omitting bytes still enables the existing bounded growth. The existing native full-default-image fixture proves both calls on the same filled image.
Affected rules: 4, 7, 13, 26, 32, 34, 44, 60, 61, 63, 66, 69, 70, 74, 90, 101, 111, 113, 116; purpose constraint 2 (notice/loss), not rulebook Rule 2 (Self-Hosting)
Affected floors: secrets — no credential path changed; spend cap — no provider call changed; stop — admission checks retained; no duplicate sends — no send path changed; durable intake — no intake or journal path changed.
Operator questions: none
Suggested tier: significant
Declared tier: critical
Tier rationale: a small option-default repair restores a persistent physical-resource ceiling; native regression evidence is required.
Side effects: callers explicitly choosing 2 GiB no longer silently opt into the 8 GiB default ceiling; omitted size and explicit maxBytes retain their existing behavior. Generated source wiring pins reflect the repaired source. Review and report correct Rule references and distinguish refusal/remount evidence from interrupted native resize survival.
Undo and recovery: revert the repair commits and regenerate register metadata; no image migration or shrink occurs. Reverting the option fix reintroduces the explicit-size regression.
Multi-machine posture: machine-local, deliberately; the existing image remains beside the same runner root, with existing owner admission and store declaration.
Layer below: attachSessionVolume option destructuring and maxBytes validation; unchanged growSessionVolume measured volume/free-space checks, host reserve, non-forced detach and bounded resize; existing journal-agent prepareAdmission/mountVolume owner/stop boundary; the native default-image fixture and explicit maxBytes neighbor. Inherited 1.x comparison f3f94826ae7c0ae6203c2651698c02b95b89ccfa rechecked at actual JKHeadley/instar origin/main ec7024b9197f149d126192db6075e02009d903b4: src/core/InstarWorktreeManager.ts and src/core/WorktreeManager.ts create host-backed worktrees; searches of src/, docs/specs/ and git history for hdiutil/sparseimage found no matching sparse-volume growth implementation. ENOSPC matches concern intake. Worktree history 6fb1db837 and 5143e436f bounds counts, not image bytes. ONEX-LESSONS sections 2 and 6 retain continuity and resource/testing lessons. The inherited 2.0 tool-turn-prior-15c4adf10.mjs detached resize primitive stays unchanged.
Bug class: integration
Bug evidence: reproducer=tests/preview/session-volume.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains only sample hooks.
Convergence: none
Prompt review: no model prompt, parser, or semantic accept/escalate/refuse decision changes; this is deterministic resource-option handling.

Evidence: native red run at the new explicit-size assertion expected image size 2147483648 but received 4429225984 (including partition padding). After repair, nice -n 10 npx vitest run --maxWorkers 1 tests/preview/session-volume.test.ts passed all five tests, including explicit initial size followed by omitted size on the same image, explicit maxBytes, maximum, host reserve, held-volume refusal and resize refusal/remount. Typecheck and architecture checks passed. Full suite is assigned to the Studio pipeline by the repair direction, not claimed here. The resize-failure fixture exits before real resize and certifies no killed-resize crash recovery. Detailed evidence: docs/release-evidence/session-volume-parity-1105-report.md and the absolute lanes session-volume-parity-1105-repair-PROGRESS.md.

## Closing block

simplestRobustRoute: select the default maximum from whether bytes was supplied, preserving explicit maxBytes, then prove the explicit and omitted neighbors with the existing full native image. This is that route; it adds no growth machinery. Start guard remains existing owner/stop admission; end-state evidence is the native red/green test; limit guards remain the supplied ceiling, host reserve and non-forced detach. No new unattended live-session completion is claimed.
80/20: one source-default repair and seven assertions/comment lines in the existing native fixture resolve the single blocking finding. Traceability notes are reconciled in the existing report and review; no unrelated runtime repair or new framework is introduced.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
