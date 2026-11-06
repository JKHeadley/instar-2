# Change review — Flush harness access evidence before successful exit

Subject base: 3f28c10a23f29a788d4c3a9a90116cdb34e5fc2f
Review state: open
Reviewed content: none
Outcome: Complete the harness access probe's queued stdout before successful exit, so a slow reader receives every kernel access result and does not falsely hold model startup.
Affected rules: 26, 36, 37, 44, 60, 61, 66, 74, 95, 101, 102, 113, 116
Affected floors: secrets — unchanged access checks and custody; spend cap — no model calls or new retries; stop — caller timeout and cancellation remain; no duplicate sends — no send or replay change; durable intake — retained original journal unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Reuse the existing minimal source repair caaf501e0e8a2733701dcd19f79b643c60ed480a with its real subprocess regression; no authority, parser, model prompt or refusal-policy change.
Side effects: Successful probes wait for the existing pipe queue to drain. A non-reading caller remains bounded by the existing 45-second probe timeout. Malformed specifications still exit 125; missing or inaccessible paths retain their exact kernel outcomes. No access evidence is omitted or reclassified.
Undo and recovery: Revert the integrated owner patch, then regenerate source pins/publication. That restores the reproduced truncation defect; retained journals and failed probe evidence must not be replayed as sends.
Multi-machine posture: The pipe completion fix travels with the shared launcher source; access checks still measure each host's own kernel identity and paths. No peer state or credential moves.
Layer below: Read the constitution, saved copy status and tool-turn state, harnessGate/readiness/probeAccess, launcher output and existing installation-by-content path. The probe reader already rejects incomplete evidence correctly; the producer exits while writes remain queued. Source repair preserves that reader and the kernel checkpoint.
Bug class: live-path
Bug evidence: reproducer=tests/preview/harness-user.test.ts; live=docs/defects/2026-11-05-harness-probe-drain-minimal.md
Diagnosis: Saved update 367055172 has zero model calls or tool-turn reservations and a model-not-started notice. Adjacent answer-check-forum.log records unavailable harness readiness but lacks per-run timestamps; correlation is not asserted as unique proof of that run's cause. Independent local reproduction returned exit 0 with 1235/2048 rows before the flush and all rows after it. The final change reuses the existing minimal owning commit rather than shipping that duplicate test.
Hook bypass: none
Convergence: none

1.X FIRST: Fetched actual JKHeadley/instar main 234fa37563dfb6ec8ba0c8c8e0deb7514b61db34; searched src/ and docs/specs for startup, stdout flush/truncation/backpressure and process exit; inspected history 9585a36e6, 352daf534, e8bbdf0ae and 92a21075d. Read src/core/SessionManager.ts tmuxExecAsync/tmuxExecCoalesced, docs/specs/unified-session-lifecycle-robustness.md, src/core/PhysicalEffectLock.ts:91,97, docs/specs/token-audit-completeness.md:56,59 and docs/specs/MULTI-MACHINE-LEASE-ROBUSTNESS-SPEC.md:89. Read ONEX-LESSONS.md sections 2 and 3. Reused behavior: flush completion evidence before exiting, as the Python flock helper does, and distinguish uncertain observations from actual outcomes. Mismatch: Python flock and tmux lifecycle machinery do not fit the Node access probe; the existing Node write callback provides the same completion ordering without another subsystem.

Decision: train-188-flush-probe | Reuse the four exact files from owner caaf501e0e8a2733701dcd19f79b643c60ed480a. The acceptance condition is complete real probe rows under a paused reader, with existing refusal and timeout checks unchanged; no competing repair. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-188-repair-PROGRESS.md

Verification: Independent real subprocess regression was red before source edit (1235/2048 rows), green after (2 tests); the duplicate patch/test was then removed in favor of the owner. Final owner regression and existing positive/negative controls are run from tests/preview/harness-user.test.ts. Typecheck/build, architecture, publication and final cheap gate results are recorded in PROGRESS. No model prompt, model-output parser or judgment policy changes. The saved preview copy was read only and never run. Full suites and renewed live answer proof remain with the automatic Studio pipeline, as directed.

Owner reuse: The final source, test, defect and owner review are byte-identical to caaf501e0e8a2733701dcd19f79b643c60ed480a at integration. This retains its tuned producer fix and test evidence while avoiding unrelated diagnostic expansion in 78180945e. The owner review's 1.x comparison is inherited and independently checked at current 1.x main: src/scheduler/ScriptCanaryRunner.ts:489-491 uses the stdout write callback before process.exit; its introducing history is 35b02553b. This is a direct behavioral fit for the Node probe.

Subject: tests/preview/harness-launch.mjs; tests/preview/harness-user.test.ts; docs/defects/2026-11-05-harness-probe-drain-minimal.md; owner review; mechanically regenerated owner pins and register publication.

Publication: Desk owner rehash and repin changed zero pins. Existing register replay from source c45cbd0c403a97ac43bc59dae46e46899d2ac6c0 generated sha256:1d5d5fb87f0e9cf9bb4f92ce129217e924706b6da812afcb54cc968585635feb (298 entries, 121 rules; shape-only). Final selected readiness/gate/launcher tests passed 25/25, with 26 unrelated cases not selected; typecheck passed after owner integration.

## Closing block

simplestRobustRoute: This is the simplest robust route: finish the already queued evidence before the existing successful exit. It prevents the demonstrated incomplete probe without loosening any access guard, adding retries, or reducing tools. Start guards and bounds remain in probeAccess and harnessReadiness; success requires the entire output. This source handoff makes no independent convergence or unattended live-answer acceptance claim.
80/20: Reproduce the actual pipe loss, cover successful and refused outcomes, run typecheck and cheap gates, and leave the full suite/live proof to the Studio pipeline.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
