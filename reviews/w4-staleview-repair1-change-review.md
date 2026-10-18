# Change review — w4-staleview round 1 repair: whole --root value and captured runner fixture

Subject base: 15ead978ebb2ee6caf8a4162fd281b78d4c7b28a
Review state: open
Reviewed content: none
Outcome: Repairs Astra's two round-1 must-fixes. (1) ownedProcessOf no longer splits the ps command line on whitespace: the --root value is everything after a standalone `--root ` up to the next ` --` option or the end of the line, so a root containing spaces is matched whole. `--root /tmp/runner copy --bot-id 123` is now present for `/tmp/runner copy` (it was unknown, a regression) and unknown for `/tmp/runner` (it was present, a false running row). A repeated --root, or a value holding ` --` itself, cannot be read unambiguously and stays unknown. The script check accepts a script path containing a space. (2) The three recorded runner command lines are checked in verbatim as tests/preview/fixtures/staleview-runners-proofroom2-2026-10-04.txt, copied byte-for-byte from P-proofroom2-20261004-042523/runners.txt, and the test reads them instead of hand-shortened approximations. Synthetic mutations stay for the boundary cases. The P114b failure remains the desk check's snapshot race (staleview-check-race); this repair claims no new live proof.
Affected rules: 26 (real state: a reused pid or a sibling root never vouches for another root, and a spaced root's own runner reads present), 36 (the parser is tested on the real captured bytes, not hand-typed approximations), 114 (never claim work nobody is doing), 9 and 96 (the existing awareness work/overlap view, unchanged in shape), 116 (one pure comparison fixed in place; no ledger, watcher, launch restriction or stop protocol). Observer #106 (operator replay duty, distinct from constitutional Rule 106 on working human-facing links) is met by replaying the captured lines.
Affected floors: secrets — unchanged, the fixture holds paths, bot ids and digests only, no secret value; spend cap — unchanged, no model call; stop — unchanged; no duplicate sends — unchanged, the view sends nothing; durable intake — unchanged, the run logs are read as before
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it edits journal.ts, the runner's operator-packet builder, though only the pure process verdict for other runners' rows.
Side effects: none beyond the verdict: rows can read running only for their exact root, including roots with spaces. The generated register is replayed for the earlier journal-agent.mjs source pin.
Undo and recovery: revert the commits and this record. Nothing is persisted by the change.
Multi-machine posture: unchanged: the view reads this machine's runner roots and processes only.
Layer below: ps -ww -p <pid> -o command= (unchanged), latestOwnedLaunch over runs.jsonl (unchanged), concurrentWorkItem (unchanged).
Bug class: unit
Bug evidence: reproducer=tests/preview/journal-overlap.test.ts
Hook bypass: none
Convergence: none
Decision: staleview-whole-root | read the --root value up to the next ` --` option rather than one whitespace token, keeping space-containing roots supported and leaving ambiguous lines unknown | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-staleview-PROGRESS.md
Prompt review: the packet's concurrentWork wording is unchanged; only which rows read running can change. Recorded shapes replayed: the three complete runner command lines of P-proofroom2-20261004-042523/runners.txt (pids 15711, 23552, 71427), checked in verbatim.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (10 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/fixtures/staleview-runners-proofroom2-2026-10-04.txt, tests/preview/journal-overlap.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: required outcome: a row reads running only while that exact root's runner is alive, for any root path. Route: fix the existing root-value extraction in place to keep the whole value; no new machinery, no launch restriction.
80/20: 0 must-fix, 0 notes.
VERDICT: author submission; the independent verdict is recorded as a pass
