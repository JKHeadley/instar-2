# Changelog — `17-harness-adapters.md`

_Generated from `17-harness-adapters.changelog.json` by `scripts/render-changelog.mjs` — do not edit by hand._
The document itself reads as a first version; every change to it is recorded here, newest first,
each linked to the git change that made it (rule 91).

## Revision 5 · 2026-10-03 · draft — Unit w4-persist (plan row #400): operator re-grounding, Justin 10:45 PDT 2026-10-03 via observer #149, and message 121996 (the 'handicapped' fresh-per-turn result rejected): a persistent workspace per conversation and a kept harness session subordinate to the journal, satisfying the full-tool ruling's MF5. No constitution change.

- **§9 gains the persistent-workspace and kept-session rule: one 128 MB volume per conversation kept for the root's life (at most four per root; further conversations run in one-turn workspaces, journaled; nothing deleted to make room); a Claude Code session named per turn, resumed only while the authority, harness, model and a digest of every journal fact it may hold are unchanged, replaced at six turns, 512 KiB, a compaction, a loss or an unsettled turn, and ended at a stop, withdrawal or failure; machine-local, never resumed across machines; Codex cell unsupported. The tool rule's workspace and the grant's scope now name the conversation's workspace.** — Operator re-grounding: the agent must keep its files and its working context across messages; MF5 requires the kept session to be a disposable cache bound to the journal's current facts and authority, with loss detection, bounded retention and fresh grounding. _(lanes/w4-persist-PROGRESS.md; lanes/astra-fulltool-ruling.md (MF5); LIVE-PATH-PLAN.md row #400)_

## Revision 4 · 2026-10-03 · draft — Unit w4-toolsfull (plan row #395): operator direction, Justin, topic 102965 message 121996, 10:15 PDT 2026-10-03, recorded as a Rule 104 standing grant: tools on by default with the full Claude Code tool set, consequential effects through the effect doorway, every subagent a Rule 114 edge. No constitution change.

- **§9 tool rule widened to the full tool set (WebFetch and WebSearch reads of public hosts, one bounded foreground subagent type recorded as a Rule 114 edge, the root's MCP servers with reads listed and every other MCP call at the doorway); the grant rule makes tools on by default under the recorded grant, derived at launch, refusable, and withdrawn live when the record or the sealed authority's resolution changes; every cleanup census reclaims each member it finds.** — The operator directed a powerful agent out of the box on a trustworthy infrastructure; the live stop-with-subagent run showed a shell child surviving a stop when cleanup only waited on later censuses. _(lanes/w4-toolsfull-PROGRESS.md; lanes/astra-fulltool-ruling.md (MF2-MF7 floors); LIVE-PATH-PLAN.md row #395)_

## Revision 3 · 2026-10-03 · draft — Unit w4-toolsreal repair, review round 1 (Astra, VERDICT NO): the §9 boundary text made true to the repaired route. No constitution change.

- **§9 scoped-tool rule: the hook no longer judges a command by its words; the sandbox refuses reads from the filesystem root down except the turn scratch volume and the runtime system files, writes outside that volume, network, unix sockets and signals to other processes; the workspace and all shell and harness temporary files live on a fixed-size volume; the per-step call count is allocated atomically.** — Review round 1 findings 1-4: the old read list left unlisted paths readable, concurrent hooks exceeded the call cap, shell writes had no aggregate ceiling, and the keyword classifier refused harmless data while admitting scripts unexamined. _(lanes/astra-unit-w4-toolsreal-review.md; lanes/w4-toolsreal-PROGRESS.md (Pipeline repair); LIVE-PATH-PLAN.md row #367)_

## Revision 2 · 2026-10-03 · draft — Unit w4-toolsreal: the full-tool ruling's replacement text, adapted to the reuse route (Justin 2026-10-02 00:43, topic 102965 message 121912; desk decision 2026-10-01 17:49, message 121586). No constitution change.

- **§9 gains the preview scoped-tool rule (Read, Write, Edit, Glob, Grep and Bash through the reused harness under the demonstrated boundary of admission hook, sandbox and clean environment; whole-liability call reservation; journaled trace; existing reply path) and the tool-grant rule (scope, custodian, withdrawal within the declared cancellation bound).** — Replaces the proposed non-governed full-tool mode the ruling rejected (MF2-MF5) with its replacement text, adapted to the route the w4-toolsreuse spike proved. _(lanes/astra-fulltool-ruling.md (replacement text); lanes/w4-toolsreuse-PROGRESS.md (proven configuration); lanes/w4-toolsreal-PROGRESS.md; LIVE-PATH-PLAN.md rows #358, #363, #367)_

## Revision 1 · 2026-09-11 · draft — Initial design

- **Initial Part Thirteen design: the session harness adapters.** — Define the harness adapter family and its conformance shape. _(`5329d4b6`)_
