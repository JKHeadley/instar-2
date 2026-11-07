# Change review — train-177 harness probe delivery repair

Subject base: c7b1eb47a4be7b2547ae1049cb8a0818287dbd54
Review state: open
Reviewed content: none
Outcome: The harness launcher's --probe writes all rows in one write and exits only after it completes, so the runner's readiness check receives every row on a busy macOS host and Claude Code launches run as the harness user instead of being held as "launch not permitted". A short or malformed probe reply is now logged instead of silent.
Affected rules: 37, 74, 101, 116
Affected floors: secrets — the probe reports access results only, as before, and the separate harness identity and custody are unchanged; spend cap — no provider calls added; stop — launcher exit and process-tree handling unchanged; no duplicate sends — send path unchanged; durable intake — journal and intake unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The launcher is the only command the harness sudo rule allows, so a defect there holds every model launch; the change keeps its probe contract and only changes how output is flushed.
Side effects: The first runner on this build reinstalls the shared launcher at its path; older builds that are still running reinstall their own copy when they next check readiness (atomic rename, path-only sudo rule, no digest pin). Readiness now writes one stderr line when a probe reply is short.
Undo and recovery: Revert the code commit and replay the register; the next readiness check reinstalls the previous launcher. No state migration.
Multi-machine posture: Machine-local launcher under /Users/Shared/instar-harness; no sync, authority or credential change.
Layer below: Node's process.stdout is asynchronous for pipes on macOS; process.exit drops queued writes. Reproduced: 9000 per-row writes then exit lost rows on 6 of 10 runs (850 to 5633 kept); one awaited write kept all 9000 on 10 of 10. The failed answer check probed about 8100 /private/tmp entries.
Bug class: live-path
Bug evidence: preview-deploy.log 2026-11-06 19:27:30 FAIL for c7b1eb47 (reply "I couldn't start my model right now"); answer-check-forum.log line 2289 "Harness identity: UNAVAILABLE ... the harness launch is not permitted (sudo rule, user or launcher missing)", with no [harness-probe] exec error, so the short-reply branch fired. Copy status: heldRepliesToday reason "model not started". harness-user.mjs and harness-launch.mjs are byte-identical to the passing c9847434 and 14748355 builds, so the failure is load-dependent rather than introduced by this branch.
Hook bypass: none
Convergence: none
Decision: train177-probe-flush | Fix the launcher's output flushing at its source, not the readiness count check or its timeout, because the probe contract (one row per spec) is correct and only delivery was lossy. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-177-PROGRESS.md
Decision: train177-probe-log | Log a short reply in probeAccess so the next lossy reply names itself instead of reading as a missing sudo rule. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-177-PROGRESS.md
Decision: train177-register | Use the canonical register replay at the code commit; desk rehash/repin reported zero pin changes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-177-PROGRESS.md
1.x comparison: JKHeadley/instar main fe1b0f41a0b4a5f428c6fa07478ae0aad0c19b23; 1.x has no separate-user harness launcher or access probe. Searched code for sudo -n probes and stdout flush before exit: src/core/memorySandboxProbe.ts uses sudo -n only for root install steps with ignored stdout, and scripts/verify-deployed-templates.ts exits without large piped output. Neither fits; the repair is 2.0-native.
Prompt review: No prompt, model output parsing, or accept/escalate/refuse decision changes. The change restores model launches that readiness wrongly held; real recorded shape replayed: the copy's held reply (update 367055391, reason "model not started") and the runner's logged readiness line.
Deferral: generated/register.json:1 | not-a-deferral=derived register metadata replayed from committed source

Subject (10 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/harness-launch.mjs, tests/preview/harness-user.mjs, tests/preview/harness-user.test.ts

## Closing block

simplestRobustRoute: One buffered write awaited before exit in the launcher, plus one diagnostic line. No retries, timeouts or new machinery; no ability narrowed.
80/20: tsc passed; tests/preview/harness-user.test.ts 51 of 51 passed. The new launcher test fails on the old launcher (1387 of 9000 rows) and passes on the new one (5 of 5 runs, all rows). lint, register:check passed. A live harness-user run is for the Studio answer check.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
