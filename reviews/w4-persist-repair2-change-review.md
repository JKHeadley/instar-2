# Change review — w4-persist repair round 2: workspace reconciliation completes truthfully and never splices a structured file

Subject base: 55c1f616d3e39bcf2cef54f8a42805adc716467b
Review state: open
Reviewed content: none
Outcome: Unit review round 2 (Astra, VERDICT NO), two must-fixes at their source in tests/preview/tool-turn.mjs. (1) removeForgotten no longer swallows a whole-walk error or stops silently at its bound: each unreadable entry, unreadable directory or failed write is held and named; a read-only file is made writable for the edit only and its mode restored; the walk visits entries in a fixed order and, at its bound, returns the position it stopped at, which the volume mark keeps so the next turn continues there. reconcileWorkspace records the forget digest as reconciled only after a whole walk (possibly over several turns) held no file; until then every turn repeats the check, the workspace carries WORKSPACE-STALE.txt naming the held files and any unchecked part (without quoting the forgotten text), the trace row carries held/unchecked, and status shows the unfinished check. (2) Only plain-text files (valid UTF-8 without a NUL byte) are edited by removing a clause; any other file holding one (an archive, an image, a database) is kept byte-for-byte and named, so the agent can rewrite it with its own file tools; the hold ends when it no longer holds the clause. Tests: readable-but-unwritable note (mode kept), an unreadable directory held then completed after access returns, a 12-file workspace with a pass bound of 5 covered over three turns, and a stored ZIP with an unrelated entry kept intact beside a plain note that is reconciled. Part 17 §9 and its changelog (revision 7) carry it.
Affected rules: 2 (an unfinished reconciliation is journaled and shown, never silent), 7 (nothing kept is deleted or half-edited; structured files are kept intact), 33 (the forget counts as reconciled only when the workspace no longer holds it; the journal stays the authority), 36 and 106 (both sides of each decision tested), 60 (the walk stays bounded per turn), 74 (this record), 84 (status line from journal stats), 91 (changelog revision 7), 101 (no hook bypass), 113 (machine-local, unchanged), 116 (simplest source fix); Purpose constraint 2 (unrelated retained work is never destroyed); Purpose revision 12 (no tool, file type or workspace ability narrowed)
Affected floors: secrets — unchanged; the stale note never quotes a forgotten clause; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it changes how the kept workspace agrees with the journal's memory and what the runner may rewrite in retained work.
Side effects: kept.json may carry a pending {digest, cursor, clean} entry; the workspace may carry WORKSPACE-STALE.txt while a reconciliation is unfinished (removed when one completes); a read-only file's mode is briefly widened for its edit and restored; trace volume rows gain optional held and unchecked; view.toolTurns gains reconcileIncomplete; status may add one line.
Undo and recovery: revert these three commits and this record. Clauses already removed from plain-text files are not restored by a revert; the journal still holds the original messages and the forget/correct records.
Multi-machine posture: machine-local, unchanged.
Layer below: node:fs reads, writes and chmod on the mounted volume; the journal projection of trace volume rows; Claude Code's file tools (Read, Write, Edit, Bash), unchanged, which the agent uses to rewrite a held file.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: repair2-complete-only | the forget digest advances only after a whole clean walk; a held file restarts the cycle next turn and a bounded stop resumes from a kept cursor, rather than a larger cutoff | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-persist-PROGRESS.md
Decision: repair2-plain-text-only | only valid UTF-8 without NUL is spliced; other formats are kept intact and named for the agent's own edit, rather than a per-format parser | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-persist-PROGRESS.md
Prompt review: one model-facing text added: the WORKSPACE-STALE.txt note ("Some of this workspace may still disagree with this conversation's memory: it has since forgotten or corrected statements these files may still hold. The memory is the authority; do not rely on them for anything it no longer holds, and rewrite them without it if you use them. The check repeats every turn until it completes." plus the held paths and an unchecked-part line). It is a fixed statement read only by a tool, quotes no forgotten text, copies no test phrase, and asks the model nothing. No prompt, parser or accept/refuse rule of the model path changed, so no recorded model shapes apply.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (14 paths): docs/17-harness-adapters.changelog.json, docs/17-harness-adapters.changelog.md, docs/17-harness-adapters/09-claude-code-codex-and-future-runtime-mappings.md, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/journal.ts, tests/preview/tool-persist.test.ts, tests/preview/tool-turn.mjs

## Closing block

simplestRobustRoute: both findings fixed inside the existing reconciliation checkpoint: per-entry error handling instead of one catch, a completion flag gating the existing digest, a cursor in the existing volume mark, a plain-text test before the existing splice, and a note file like the existing lost-workspace note. No new ledger, watcher, parser or tool restriction. Start guard: unchanged (after mount, before planning/dispatch); end-state guard: digest advances only on a complete clean walk; limit guard: at most 10000 entries per turn, resumed from the cursor.
80/20: 0 must-fix, 2 notes — reconciliation stays literal (a rephrased forgotten fact is not found, as accepted in round 1); while a pass is unfinished, a held or unchecked file can still be read this turn, with the note and the journal packet telling the agent the memory is authoritative.
VERDICT: author submission; the independent verdict is recorded as a pass
