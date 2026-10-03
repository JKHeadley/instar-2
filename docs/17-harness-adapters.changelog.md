# Changelog — `17-harness-adapters.md`

_Generated from `17-harness-adapters.changelog.json` by `scripts/render-changelog.mjs` — do not edit by hand._
The document itself reads as a first version; every change to it is recorded here, newest first,
each linked to the git change that made it (rule 91).

## Revision 5 · 2026-10-03 · draft — Unit w4-native repair, review round 1 (Astra, VERDICT NO): the native tool rule made true to the repaired executors. No constitution change.

- **§9 native tool rule: every admitted call except a web fetch runs as a sandboxed worker process launched through the host resource owner (memory, process, CPU and handle ceilings, deadline, stop, verified cleanup); a web fetch ends on its deadline or the stop and reads at most its byte limit; a call admitted while the stop was latched is never run.** — Review round 1 findings 1-3: file tools opened admitted paths in the loop's own unsandboxed process (a path swapped into a link after admission escaped it, and a FIFO read blocked the stop), and no memory or process ceiling was attached to native execution. _(lanes/w4-native-PROGRESS.md (Pipeline repair); LIVE-PATH-PLAN.md row #414)_

## Revision 4 · 2026-10-03 · draft — Unit w4-native (plan row #401 follow-on; Rule 115, pillar (b) "any framework or no framework at all"; operator direction Justin, topic 102965 message 121996 and the 10:45 re-grounding): the first slice of Instar's native harness. No constitution change.

- **§9 gains the native tool rule: Instar runs the tool turn's agent loop itself, with each step a text-only model call under its own separately bound native framing; proposed calls pass the same admission hook, call slots and record and run in the same scratch volume, the shell under a sandbox built from the harness sandbox's read list; the loop is the tool turn's own invocation, so reservation, step bound, trace, consistency check and stop are unchanged.** — Rule 115 requires a first-party harness built only on the public core ports; the pillar asks for an agent on any framework or none. Reusing the tool turn and its hook keeps one boundary rather than a second one. _(lanes/w4-native-PROGRESS.md; LIVE-PATH-PLAN.md rows #399, #401, #414)_

## Revision 3 · 2026-10-03 · draft — Unit w4-toolsreal repair, review round 1 (Astra, VERDICT NO): the §9 boundary text made true to the repaired route. No constitution change.

- **§9 scoped-tool rule: the hook no longer judges a command by its words; the sandbox refuses reads from the filesystem root down except the turn scratch volume and the runtime system files, writes outside that volume, network, unix sockets and signals to other processes; the workspace and all shell and harness temporary files live on a fixed-size volume; the per-step call count is allocated atomically.** — Review round 1 findings 1-4: the old read list left unlisted paths readable, concurrent hooks exceeded the call cap, shell writes had no aggregate ceiling, and the keyword classifier refused harmless data while admitting scripts unexamined. _(lanes/astra-unit-w4-toolsreal-review.md; lanes/w4-toolsreal-PROGRESS.md (Pipeline repair); LIVE-PATH-PLAN.md row #367)_

## Revision 2 · 2026-10-03 · draft — Unit w4-toolsreal: the full-tool ruling's replacement text, adapted to the reuse route (Justin 2026-10-02 00:43, topic 102965 message 121912; desk decision 2026-10-01 17:49, message 121586). No constitution change.

- **§9 gains the preview scoped-tool rule (Read, Write, Edit, Glob, Grep and Bash through the reused harness under the demonstrated boundary of admission hook, sandbox and clean environment; whole-liability call reservation; journaled trace; existing reply path) and the tool-grant rule (scope, custodian, withdrawal within the declared cancellation bound).** — Replaces the proposed non-governed full-tool mode the ruling rejected (MF2-MF5) with its replacement text, adapted to the route the w4-toolsreuse spike proved. _(lanes/astra-fulltool-ruling.md (replacement text); lanes/w4-toolsreuse-PROGRESS.md (proven configuration); lanes/w4-toolsreal-PROGRESS.md; LIVE-PATH-PLAN.md rows #358, #363, #367)_

## Revision 1 · 2026-09-11 · draft — Initial design

- **Initial Part Thirteen design: the session harness adapters.** — Define the harness adapter family and its conformance shape. _(`5329d4b6`)_
