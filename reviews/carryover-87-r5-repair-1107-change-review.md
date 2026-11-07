# Change review — Hold the update stop through cleanup and launch under a shell that keeps the limit

Subject base: e90aab753fd1cfaa683b3909a928d6ac7b40db51
Review state: open
Reviewed content: none
Outcome: Repairs the three must-fix findings of Astra's row 87 review. A stop during the owner's cleanup now refuses the update. The owner launches under the first of /bin/sh and /bin/bash that can hold the process limit, counting threads on Linux. The native certificate is renewed after its real contract on this composition.
Affected rules: 42 (a stop that lands during cleanup stays a refusal; it was returned as success); 44/45 (the standalone update launches again on a dash host; the owner's inherited-limit reading moves to the same shell in this change); 60 (the ceiling is kept: with no capable shell the shim still exits 125 and nothing runs); 95 (fails closed on the launch limit); 105/115 (the certificate matches the current composition after the 10-case contract, no capability narrowed); 26 (the limit counts what the kernel counts); 113, 116.
Affected floors: secrets — npm output stays unforwarded and the environment is passed as before; spend cap — no model call; stop — improved: held for the whole update, honored at the end of every launch, and a stop between launches still ends the process; no duplicate sends — no send path; durable intake — untouched.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: scripts/resource-owner.mjs is the shared launch funnel for every provider, tool and update launch, and its selected shell and process limit reach all of them.
Side effects: On a host whose /bin/sh holds the limit (macOS, the live deployment) the shell is unchanged; the one new cost is one short synchronous shell probe per process, at attach. On a dash host every owner launch, not only the update, moves from refused to running under bash with the same limits. On Linux the user-wide limit is now derived from the thread count, so it is higher than a process count would have made it, and matches what the kernel compares it with. The transport shim in production-boot-io.mjs still uses /bin/sh and is not on the update path; it is unchanged. A programmatic caller of standaloneExecutor now holds signal handlers until it calls execute.release(); updateRoot does this in its finally.
Undo and recovery: Revert the commit. The update transaction, lock and installed releases are unaffected. A stopped run leaves no pointer change and the next run resumes.
Multi-machine posture: Machine-local, deliberately: the selected shell, process limit and update transaction describe this machine. No authority or state is shared.
Layer below: Read LIMIT_SCRIPT, limitedArgv, run, cleanupTree, processLimit and observeInherited in scripts/resource-owner.mjs; the standalone path in scripts/update.mjs and bin/instar2.mjs; the WSL substitution in tests/preview/followup-deliver-launch.test.ts, which showed that Linux needs threads counted; scripts/check-architecture.mjs lintParityRegister and the desk renewal tool. The owner's stop watch ending before cleanup is correct for the owner, which has nothing left to stop by then, so the stop is retained in the update's executor and the owner's result contract is unchanged.
1.x reference: b446e92b8721fcd232475b596cc8397635b04863: git grep finds no ulimit anywhere in src/, so 1.x has no shell limiter to carry; the inherited row 87 comparison (src/core/UpdateChecker.ts applyUpdate, validated pending directory) stands. src/commands/server.ts 32902-32922 records that a process ignoring SIGTERM until SIGKILL is a real failure (instar#2122), which is why a stop between launches still ends the process here rather than waiting on a hung migration.
Bug class: integration
Bug evidence: reproducer=tests/preview/update-standalone.test.ts
Hook bypass: none
Convergence: none
Prompt review: no prompt, model-output parser or accept/escalate/refuse selector changed; recorded-model replay does not apply.
Decision: c87r5r-stop | Hold the signal handlers for the whole update and convert a launch that ended under a stop into a stopped result, rather than change the owner or add a cancellation service. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-87-r5-1107-PROGRESS.md
Decision: c87r5r-between | A stop between launches re-raises with the default action, so a hung migration stays stoppable; flagging it and checking at checkpoints would have lost that. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-87-r5-1107-PROGRESS.md
Decision: c87r5r-shell | Probe /bin/sh then /bin/bash for ulimit -u, and refuse through the shim when neither holds it, rather than skip the limit or replace it with a new OS mechanism. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-87-r5-1107-PROGRESS.md
Decision: c87r5r-threads | Count threads on Linux, because the kernel compares threads to this limit and a process-count limit would fail a threaded npm after the shell repair. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-87-r5-1107-PROGRESS.md
Decision: c87r5r-certificate | Renew the certificate on the Studio with the existing tool, which runs the real contract before and after declaring the digest. The composition changed, so a hash-only edit would not be evidence. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-87-r5-1107-PROGRESS.md

Deferral: generated/register.json:1 | not-a-deferral=Generated register text carrying existing wording; this change adds no commitment.
Skip: tests/preview/update-standalone.test.ts:186 | scope=Needs a /bin/dash that refuses ulimit -u, the affected shell; on a host without it there is nothing to select away from.
Skip: tests/preview/update-standalone.test.ts:203 | scope=Needs a /bin/dash that refuses ulimit -u to supply the refusing shell for this neighbor.

Subject (13 paths): docs/update.md, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, reviews/carryover-87-r5-repair-1107-change-review.md, scripts/resource-owner.mjs, scripts/update.mjs, src/assembly/harness.declarations.json, tests/preview/update-standalone.test.ts

## Closing block

simplestRobustRoute: The required outcome is that a stop always refuses the update and the update launches wherever a capable shell exists, with its limits kept. The route is three small changes to existing code: one retained flag in the existing executor, one shell probe in front of the existing shim, one platform-correct argument list. No service, ledger or new limit mechanism is added. The certificate uses the existing renewal tool. Start, end-state and limit guards are the existing lock, transaction and owner ceilings.
80/20: Real-process tests cover a stop in cleanup, a stop in a hung migration, a real install through the selected shell with the limit read back, and the refused launch. Each repair was removed once and its test went red. A real launch on a Linux kernel is not run here; the Mama PC gate decides it.
VERDICT: author submission; independent review, Studio gate and live installed proof remain
