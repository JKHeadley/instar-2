# Change review — repair native sandbox test process ownership

Subject base: 876de0bbb6004059999921a1db454cf2a06d39fb
Review state: open
Reviewed content: none
Outcome: Repair native-loop process fixture ownership and cleanup so an exited neighbor cannot mask the original containment assertion with ESRCH. Keep neighbor-survival, verified owner cleanup, next-call recovery and suspended-workload stop checks; replace broadcast test signals with exact owned PIDs.
Affected rules: 26, 34, 37, 49, 60, 61, 70, 74, 101, 102, 107, 108, 112, 113, 115, 116
Affected floors: secrets — unchanged sandbox and redaction; spend cap — no provider call; stop — real suspended-workload stop still exercised; no duplicate sends — no send path change; durable intake — no journal or intake change
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One test file and its review; no shipped code, policy, prompt, parsing or model decision change.
Side effects: Three neighbor fixtures now use a directly owned pipe-idle cat child instead of an orphaned timed sleep. Cleanup awaits close and uses the ChildProcess lifecycle, retaining original failures if the child already exited. Exact-PID signals replace SIGKILL/SIGSTOP broadcasts under observer #95. The outside-neighbor signal is explicitly denied by the real sandbox; shell and worker death is verified independently. This changes the adversarial fixture shape, not shipped tool ability or sandbox enforcement.
Undo and recovery: Revert this commit normally. No product state or migration. A revert restores the orphan fixture and masking cleanup exception; do not rerun its broadcast signal commands on a shared host.
Multi-machine posture: Deliberately machine-local process fixtures on the Mac running the native Seatbelt tests. No durable state, peer dependency or ownership-policy change.
Layer below: Node ChildProcess spawn/close/kill lifecycle; tests/preview/native-tool-worker.mjs shell parent relation; native-loop.mjs workerOutput and same-sandbox signal policy; scripts/resource-owner.mjs external sandbox census and cleanup; unmodified saved gate JSON with one ESRCH failure.
Bug class: integration
Bug evidence: reproducer=tests/preview/native-loop.test.ts
Hook bypass: none
Convergence: none
Decision: repair-neighbor | Use direct child ownership and an idle pipe, preserving original failures on cleanup; no added retry or timed sleep. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-rule106-auto-p2-repair-PROGRESS.md
Decision: repair-signals | Signal only exact test-owned PIDs, explicitly test denial to the outside neighbor, and verify the shell and worker have exited. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-rule106-auto-p2-repair-PROGRESS.md

Subject (1 paths): tests/preview/native-loop.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: keep the test child under the existing ChildProcess lifecycle and await its exit, rather than add retries, longer sleep timeouts or quarantine. The pipe holds the neighbor idle without a wall-clock expiry. Start guards are successful spawn and exact recorded PIDs; end guards are neighbor survival, verified inside-process exit, owner cleanup, next-call success and awaited fixture close. The existing test deadline bounds the run. No new autonomous capability is claimed.
80/20: Repair the named test and both identical neighbor fixtures in the same file, retain runtime checks, and prove live and already-exited cleanup. Targeted native-loop tests, tsc and cheap gates provide repair evidence. The saved full-run report remains failed; no synthetic green report or full-suite success is claimed.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
