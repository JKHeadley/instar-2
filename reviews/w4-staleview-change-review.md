# Change review — w4-staleview: a runner row is running only when its pid's --root equals that root exactly

Subject base: ff54afb315fdc24d1693334450b05e67724e6e12
Review state: open
Reviewed content: none
Outcome: Plan row #484. Live cint-L47 group P (P-proofroom2-20261004-042523) read P114b FAIL. The recorded evidence shows the view's running rows were true at the send: the flagged row justin-20261003-1046 was relaunched at 11:26:12Z (pid 73747) and its own exit row says it ran until 11:57:50Z, so it was alive at the 11:26:36Z send; the check's runners.txt was captured at 11:25:25Z, before that relaunch, and proofroom2-ps-20261004-022506 is the 'you' row (pid 23552 in runners.txt, exit 11:28:06Z). Inspecting the source found one real way the view could claim work nobody is doing: a launch with no exit row was confirmed against its pid with a substring test on '--root <root>', so a live runner of a root extending this root's path vouched for a gone runner. ownedProcessOf (journal.ts) now requires the pid's --root argument to equal the root exactly; anything else is unknown, never running. The check race is reported to the desk with a proposed check change.
Affected rules: 114 (the concurrent-work view never claims work nobody is doing: running needs the pid to be that exact root's runner), 9 and 96 (the view stays the existing awareness projection, unchanged in shape), 106 (tests replay the recorded P run's runner command lines and run log rows), 116 (a pure exact-argument comparison in place of a substring test; no new machinery).
Affected floors: secrets — unchanged, no new text leaves the machine and row text is still redacted; spend cap — unchanged, no model call; stop — unchanged; no duplicate sends — unchanged, the view sends nothing; durable intake — unchanged, the run logs are read as before
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it edits journal.ts, the runner's operator-packet builder, though only the pure process verdict for other runners' rows.
Side effects: journal.ts exports ownedProcessOf; journal-agent.mjs's ownedProcess calls it instead of its inline substring test. A runner whose --root argument is spelled differently from the sibling path stays unknown, as before.
Undo and recovery: revert the commits and this record. Nothing is persisted by the change.
Multi-machine posture: unchanged: the view reads this machine's runner roots and processes only.
Layer below: ps -o command= for the recorded pid (unchanged), latestOwnedLaunch over runs.jsonl (unchanged), concurrentWorkItem and the awareness work/overlap view (unchanged).
Bug class: unit
Bug evidence: reproducer=tests/preview/journal-overlap.test.ts
Hook bypass: none
Convergence: none
Decision: staleview-exact-root | confirm a running row by the exact --root argument of its live pid rather than make every stop path record an exit: a signal or SIGKILL cannot always write an exit row, while the process check cannot drift | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-staleview-PROGRESS.md
Decision: staleview-check-race | the P114b failure is a snapshot race in the desk's check (runners.txt taken before the send while a sibling relaunched), not a false running row; reported with a proposed check change rather than edited, since P.sh is desk-owned | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-staleview-PROGRESS.md
Prompt review: the packet's concurrentWork item keeps its wording; only which rows read running can change (fewer, never more). Recorded shapes replayed: the three runner command lines in P-proofroom2-20261004-042523/runners.txt, and the justin-20261003-1046 run log rows for its 10:30:17Z launch (pid 11377, SIGHUP exit 11:24:55Z) and its 11:26:12Z launch 1791113172756 (pid 73747) with exit 1791115070742; the packet's last.concurrentWork rows from inspect-p1.json (update 6232120).
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change

Subject (3 paths): tests/preview/journal-agent.mjs, tests/preview/journal-overlap.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: required outcome: a row reads running only while that root's runner process is alive. Route: keep the existing live-process check and make its root comparison exact (one pure function), instead of adding exit-recording to every stop path, which a SIGKILL can never satisfy.
80/20: 0 must-fix, 0 notes.
VERDICT: author submission; the independent verdict is recorded as a pass
