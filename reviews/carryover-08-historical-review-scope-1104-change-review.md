# Change review — Classify prompt sources from the bytes a record reviewed

Subject base: a2d13d087f530d334167e12c383b7205c6830a92
Review state: open
Reviewed content: none
Outcome: The change-review check decides whether a record changed a prompt source from that path's bytes at the record's own base and last commit, instead of from the current working tree. A record is no longer refused for prompt text a later change added to the same path, and it is now refused for an unreviewed prompt it touched that a later change removed.
Affected rules: 12, 26, 27, 42, 48, 49, 70, 74, 95, 101, 102, 107, 111, 113, 116. Rules 12/27 keep their refusal text and required 'Prompt review:' field. Rule 74 keeps the record's subject as base..last. Rule 90/91 governed documents are not edited. No waiver (Rule 94) is sought.
Affected floors: secrets — untouched; the check reads repository objects only; spend cap — untouched; no model call or run; stop — untouched; no duplicate sends — untouched; no message path; durable intake — untouched; no intake path
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: One function in a landing gate decides whether a review field is required, so a mistake could weaken Rules 12/27 or block every landing. It has no runtime, register or product effect, and real-git CLI fixtures plus a replay over all history cover both decision directions.
Side effects: promptSourcesChanged for 'check' and 'landing' now comes from committed bytes. A record that already carries 'Prompt review:' skips the read because it cannot be refused on this field. Prompt findings (fixture-phrase and asserted-answer) and their dispositions still scan the current tree exactly as before, and 'draft' still classifies the working tree it is drafting. The stricter cases (a prompt present at the reviewed commit and gone at HEAD, and a prompt source removed or deleted by the record's own range) add no refusal to this history: see the replay below.
Undo and recovery: Revert the commit that carries this record. No state, ledger entry, record or generated file changes. The false finding on reviews/codex-harness-1014-repair-change-review.md returns if this is reverted while row 08 is present.
Multi-machine posture: The classification reads immutable git objects at commits the record names, so every clone with that history gets the same answer, and it no longer depends on one checkout's uncommitted edits. A base or last commit a clone lacks already makes the record invalid under Rule 74. Nothing is machine-local.
Layer below: Read the full constitution rows for Rules 12, 27, 74, 90, 91, 95, 102, 107, 109, 111 and 116 in docs/01-the-rules.md. Read scanPrompts, literals, isPromptSourceFile and validateRecord in scripts/change-review.mjs and the record scope, changeScope, promptScan, governedVersionErrors and draft paths in scripts/check-change-review.mjs. governedVersionErrors already reads both ends of a change so a document cannot shed governance; this follows that existing form. Read the historical record, the row 08 records and the bytes of the worker at each commit that touched it.
Bug class: integration
Bug evidence: reproducer=tests/register/change-review-git.test.ts
Hook bypass: none; core.hooksPath is unset and the shared hook directory holds samples only, so plain git commit runs no hook and none was skipped.
Convergence: none
Decision: H08-SOURCE-AT-REVIEWED-COMMIT | Classify from bytes at the record's own commits because the replay shows the worker was no prompt source there, so the historical record owes nothing and stays untouched. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-08-historical-review-scope-1104-PROGRESS.md
Decision: H08-BOTH-ENDS | Read base and last rather than last alone, because removing a prompt is a prompt-facing edit and last alone would drop a case HEAD classification could still catch. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-08-historical-review-scope-1104-PROGRESS.md
Decision: H08-FINDINGS-UNCHANGED | Leave prompt findings on the current tree because the existing own-record and older-debt logic already scopes them; only the source classification was false. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-08-historical-review-scope-1104-PROGRESS.md
Decision: H08-FAIL-CLOSED-READ | List paths with ls-tree and read with the throwing git helper, so an unreadable object stops the check instead of reading as an absent file (Rule 95). | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-08-historical-review-scope-1104-PROGRESS.md
Decision: H08-ROW-OPEN | Keep the row 08 code, tests and records unchanged and make no live claim; the desk owns the exact-head gate, independent review, live proof and row status. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-08-historical-review-scope-1104-PROGRESS.md

## Measured finding

Red before, at exact head a2d13d087f530d334167e12c383b7205c6830a92: `node scripts/check-change-review.mjs check` exits 1 with one finding that is not a Studio-only report path: reviews/codex-harness-1014-repair-change-review.md: Rules 12/27: prompt sources changed (src/harness-adapters/codex-conversation-worker.ts). This matches the desk's Studio reproduction.

Cause, read from the bytes with the repository's own scanPrompts: the worker is not a prompt source at the record's base 3eae75c4ade1b48a69f25c39ce339185f4f96555, its last commit 935457dd1, or the next three commits touching the path (240cc0cf8, 0dbf5946e, 6cfa8ffb5). It first becomes one at row 08's 11cd903d9, which adds the identifier notDispatched and matches the prompt/dispatch/instruction name rule. That is an honest classification of row 08, whose two records carry 'Prompt review:'. The old check applied it backwards to a record whose subject never held those bytes.

The historical record is not edited, its subject does not grow, and no prompt review is written for it after the fact.

## Why Rules 12/27 are not weakened

Every commit is covered by a record (Rule 74), so a later prompt edit answers at the later record, whose own last commit holds those bytes. The only records the new read excuses are those whose bytes held no prompt source at either end of their range. The definition of a prompt source and the refusal are unchanged.

Replay over all history at this head, with the same scanPrompts and isPromptSourceFile: 919 records name a prompt-source path, 19 have no 'Prompt review:'. Of those 19, one is a source at HEAD (the record above) and none is a source at its own base or last. Reading both ends therefore removes exactly the false finding and adds no refusal.

## Prompt-finding disposition

No prompt source is in this subject, so no 'Prompt review:' is owed: scripts/ and test files are outside isPromptSourceFile. 'draft' on this change lists no prompt finding, so no 'Prompt finding:' line is owed. The new test literals are inputs to throwaway repositories and are not copied into any prompt.

## Can-fail tests

tests/register/change-review-git.test.ts, 'a record answers for the prompt sources it reviewed', drives the real CLI against real git repositories. All six fail against the a2d13d087 checker and pass with this one:

| Case | Old checker | This change |
|---|---|---|
| Later reviewed change adds a prompt to the older record's path | refuses the older record (the false finding) | accepts |
| That later change has no prompt review | also refuses the older record | refuses only the later record |
| Record reviewed a prompt a later change removed, no prompt review | accepts (a miss) | refuses that record |
| Own range rewrites a prompt away, no prompt review | accepts (a miss) | refuses; accepts once reviewed |
| Own range deletes a prompt source, no prompt review | accepts (a miss) | refuses; accepts once reviewed |
| Uncommitted prompt edit over a committed plain record | refuses | accepts; 'draft' still asks for the review |

Subject (2 paths): scripts/check-change-review.mjs, tests/register/change-review-git.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: one function reads the subject's prompt-source paths at the record's base and last commit through the existing scanPrompts and passes them to the unchanged validateRecord. No new field, flag, allowlist, ledger, cache or record edit. An allowlist or a backfilled review would suppress or fabricate evidence, and a date cutoff would stop checking older records. The start and end guards are the exact commits Rule 74 already binds; the limit is the small set of records with no prompt review. Unattended shipped-path evidence is the check itself over the real 4255-commit history, not a live product run, which this tool has none of.
80/20: Six can-fail CLI cases, the existing 59 checker tests and the whole-history replay cover both directions. Prompt findings on the current tree stay as they are because they raise no false refusal here. Full suite and independent review belong to the desk.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
