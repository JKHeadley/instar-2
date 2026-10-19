# Change review — w4-native repair round 5: restart recovery joins a sandboxed launch by its recorded sandbox

Subject base: 585fe7c2885c4852d18c177772dcc4ef995e40bc
Review state: open
Reviewed content: none
Outcome: Review round 5 (Astra, VERDICT NO), plan row #414, one must-fix, fixed at its source. Live cleanup joined a sandbox-declared launch's descendants by the kernel's sandbox identity, but the durable launch row did not record that declaration and `recover()` rebuilt only working-area roots and ran only `joinWorkingArea`. Suppose a native child daemonized to `/` before its incarnation was recorded, and then its owner and launch root died. After a restart, recovery saw that child in a complete census but attributed it to no launch. It then deleted the row and returned the Six allocation as `recovery-observed-gone`, so live ownership evidence was lost and capacity was released. Fix (scripts/resource-owner.mjs): the launch row (both the pre-gate row and the late-created unresolved row) now records `sandboxArea` alongside `workingArea`; the live census's membership join is factored into one function (`joinRoots`) that recovery now calls with roots rebuilt from the rows, so recovery joins by recorded incarnation, group, ancestry, working area AND sandbox exactly as live cleanup does, with the same unknown-reading rule (an unreadable sandbox reading or working directory makes the census partial, and every row stays). Recovery stays observation-only; nothing is signalled. New regression (tests/integration/resource-owner.test.ts, host observations injected, real owner/inventory decoder/joins/ledger): an inside-area survivor and a root-cwd sandboxed survivor each keep the row with `state: surviving` and no allocation close; a root-cwd survivor with an unreadable sandbox reading keeps the row as `unknown` with no close; a genuinely gone launch closes its row and returns the debit once as `recovery-observed-gone:native`. With the old recovery the test fails; with the fix it passes. Re-declared the self-host conformance digest (R105) for the changed composition bytes; the harness contract test passes on them.
Affected rules: 2 (no silent loss: a surviving or unreadable member keeps the launch evidence and the debit), 26 (recovery verifies actual state through the same complete join as live cleanup before declaring absence), 60 and 61 (the allocation returns only on proved absence), 34 (both sides tested: survivor kept, unknown kept, gone returned), 74 (this record), 101 (plain commits), 105 (conformance re-declared after re-running its contract), 116 (one shared join replaces recovery's narrower copy: less code); Purpose revision 12: no ability is reduced — Bash, background and detached work stay allowed; the checkpoint (the resource owner's recovery) carries the safeguard.
Affected floors: secrets — unchanged; spend cap — unchanged (the Six debit is now held while a native survivor may live); stop — unchanged; no duplicate sends — unchanged (no send path touched); durable intake — unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it changes when the owner's restart recovery releases launch evidence and resource capacity.
Side effects: launch rows carry a `sandboxArea` field (null for non-sandboxed launches); rows written before this change lack it and are joined by working area only, as before (no such rows shipped: the native path is unmerged); recovery may now run the sandbox reader (`/usr/bin/python3`) when a recovered sandboxed row has unjoined candidates; register replayed.
Undo and recovery: revert these commits and this record; the added row field is ignored by older code.
Multi-machine posture: machine-local, deliberately: launch rows and recovery are per runner.
Layer below: createResourceOwner().attach → recover() and census() (now both through joinRoots); Ten's launchMembership/joinWorkingArea/joinSandbox (unchanged, pure); the process inventory's census/workingDirectories/sandboxes (unchanged). Verified: resource-owner 31/31, process-inventory 11/11 (42 together), native-harness-contract 9/9, tsc clean, check-architecture passed, lint passes, register check passes; the reviewer's probe (whose hand-written row predates the field) is reproduced with the field recorded by the new test.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: recovery-shares-live-join | recovery calls the same membership join as live cleanup instead of keeping its own narrower copy, because two joins drift (this defect was exactly that drift) | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-native-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (10 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, scripts/resource-owner.mjs, src/assembly/harness.declarations.json, tests/integration/resource-owner.test.ts

## Closing block

simplestRobustRoute: the required outcome is that restart recovery never declares a sandboxed native launch gone while a member survives or membership is unreadable. Live cleanup already has the correct join; persisting the one missing declaration and routing recovery through that same join delivers it with no new mechanism, and removes recovery's duplicate join code.
80/20: 0 must-fix; note — legacy rows without `sandboxArea` keep the old working-area-only recovery, which is acceptable because none exist outside this unmerged branch.
VERDICT: author submission; the independent verdict is recorded as a pass
