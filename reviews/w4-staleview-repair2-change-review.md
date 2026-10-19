# Change review — w4-staleview round 2 repair: a root holding " --" never vouches for its shorter sibling

Subject base: fe69a027f8bb5e00311b818144ef4959d9b074ba
Review state: open
Reviewed content: none
Outcome: Repairs Astra's round-2 must-fix (the unresolved part of round-1 must-fix 1). A ps command line cannot show where a root argument ends when the path itself holds " --": `--root /tmp/runner --copy --bot-id 123` could be the root `/tmp/runner --copy` or `/tmp/runner`. ownedProcessOf now lists every possible root value (each prefix of the text after the single `--root ` that ends before a " --" or at the end of the line). The queried root is present only when it is one of them and no other possible value is a path that exists at this observation, read by the runner's own lstat (only ENOENT, ENOTDIR or ENAMETOOLONG rule a path out; any other error keeps it possible). With both `/tmp/runner` and `/tmp/runner --copy` on disk, neither is claimed running (unknown); with only the complete root on disk it is recognised whole (present); the reviewer's shorter-sibling query now feeds concurrentWorkItem as unknown, never running. The three captured runner lines still read present against their real roots: on this machine every other candidate of each line is ENOENT or ENAMETOOLONG (checked with the runner's predicate against the live filesystem). The round-1 comment's claim that a value holding " --" stays unknown is replaced with the accurate rule.
Affected rules: 26 (real state: a runner of one root never vouches for a sibling root, and the decision reads the filesystem as it is now), 36 (tested on the real captured lines plus the reviewer's exact pair), 114 (never claim work nobody is doing), 9 and 96 (the awareness work/overlap view, unchanged in shape), 116 (one comparison finished in place with one existence predicate; no ledger, watcher, launch restriction or stop protocol). Observer #106 (operator replay duty) is met by replaying the captured lines; it is distinct from constitutional Rule 106.
Affected floors: secrets — unchanged, nothing new is read beyond path existence; spend cap — unchanged, no model call; stop — unchanged; no duplicate sends — unchanged, the view sends nothing; durable intake — unchanged, run logs are read as before
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it edits journal.ts, the runner's operator-packet builder, though only the pure process verdict for other runners' rows.
Side effects: up to one lstat per " --" in another runner's command line (about twenty), only for a launch with no exit row. A root whose sibling extension exists on disk is now unknown instead of present. Residual stated plainly: a runner whose root directory was deleted while it still runs is no longer seen as a candidate root.
Undo and recovery: revert the commits and this record. Nothing is persisted by the change.
Multi-machine posture: unchanged: the view reads this machine's runner roots, processes and paths only.
Layer below: ps -ww -p <pid> -o command= (unchanged), lstat of candidate paths (new, read-only), latestOwnedLaunch over runs.jsonl (unchanged), concurrentWorkItem (unchanged).
Bug class: unit
Bug evidence: reproducer=tests/preview/journal-overlap.test.ts
Hook bypass: none
Convergence: none
Decision: staleview-root-candidates | resolve a flattened --root by its possible values and rule out the others by existence on disk, because text alone cannot place the boundary and no argument-preserving ps output exists on macOS; unresolved stays unknown | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-staleview-PROGRESS.md
Prompt review: the packet's concurrentWork wording is unchanged; only which rows read running can change. Recorded shapes replayed: the three complete runner command lines of P-proofroom2-20261004-042523/runners.txt (pids 15711, 23552, 71427).
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (10 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/journal-agent.mjs, tests/preview/journal-overlap.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: required outcome: a row reads running only while that exact root's runner is alive, for any root path. Route: finish the existing comparison in place with the possible root values and one existence check at the observation point; no new machinery.
80/20: 0 must-fix, 0 notes.
VERDICT: author submission; the independent verdict is recorded as a pass
