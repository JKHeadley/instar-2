# Change review — w4-persist repair round 4: the workspace notice masks forgotten clauses in the filenames it names, and the declared workspace agreement matches the implemented one

Subject base: 07bdf91c1d758caf9f81df00461db88ad136c7bb
Review state: open
Reviewed content: none
Outcome: Unit review round 4 (Astra, VERDICT NO), two must-fixes at their source. (1) tests/preview/tool-turn.mjs: the stale note's `named` now replaces every literal forgotten quote in a held file's name with "[forgotten]" before clipping, so the note and the packet.workspace notice built from it never return a forgotten value through a filename; the accurate paths stay internal in the volume mark, and no file, path or tool ability is restricted. The notice test gains the reviewer's neighbor: a structured file whose name itself holds the forgotten clause, held beside ws/memo.dat; the packet names ws/[forgotten]json and contains no 4417 (shown failing without the mask, passing with it). (2) tests/preview/tool-turn.declarations.json: the machine-scope explanation and the PREVIEW-WORKSPACE-SUBORDINATE invariant now declare the implemented agreement (journal authority, automatic prose reconciliation, intact readable held files, bounded continuation, delivered guidance naming files without the clause, honest incomplete status) instead of the replaced complete-removal claim. Owner references repinned and the register regenerated through the desk workflow.
Affected rules: 33 (journal subordination: the delivered notice no longer reintroduces a forgotten clause; the registered agreement states the real contract), 36 (both sides of the masking tested), 60 (notice bound unchanged), 74 (this record), 101 (no hook bypass), 113 (machine-local, unchanged), 116 (a literal mask in the existing note builder; no classifier, gate or filename restriction); Purpose revision 12 (no ability narrowed: files keep their names and stay readable and editable)
Affected floors: secrets — unchanged; the notice now quotes no forgotten clause in any part; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it changes text the model receives in its tool-turn input and a registered cross-store invariant.
Side effects: a held file whose name contains a forgotten quote is named in the note with that quote shown as [forgotten]; the declaration text and generated register change wording only.
Undo and recovery: revert these three commits and this record; nothing on disk outside the note text changes.
Multi-machine posture: machine-local, unchanged.
Layer below: node:fs on the mounted volume (unchanged); the canonical envelope encoder carrying packet.workspace (unchanged); the register builder reading the declaration.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: repair4-mask-names | mask the literal forgotten quotes in the names the note gives, rather than omitting held files or renaming them, so the agent still finds and rewrites the file while the clause never re-enters its input | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-persist-PROGRESS.md
Prompt review: the model-facing packet.workspace text is unchanged except that a held file's name has each forgotten quote replaced by "[forgotten]"; no parser or accept/refuse rule changes. Recorded shape replayed: the live forget run's memory change (fixtures/tool-turn/persist-2026-10-03/forget.json, update 2 forgetting update 1's "My locker code is 4417."), via the existing replay test.
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (11 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/tool-persist.test.ts, tests/preview/tool-turn.declarations.json, tests/preview/tool-turn.mjs

## Closing block

simplestRobustRoute: one literal split/join over the existing forgotten-quote set inside the existing note builder, plus a wording correction of the declaration; no new mechanism. Start guard: masking happens before the note is written; end-state guard: the delivered notice contains no forgotten quote; limit guard: 16 names, 96-character clip, 3072-byte notice unchanged.
80/20: 0 must-fix, 1 note — masking is literal like reconciliation itself (a rephrased forgotten fact in a filename is not found, as accepted in round 1).
VERDICT: author submission; the independent verdict is recorded as a pass
