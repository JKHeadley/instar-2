# Change review — w4-shellnet repair round 2: forward each request to the checked authority, strip method overrides from reads, close the network once a byte allowance is spent

Subject base: d7b13992d87f5c546e38f9715d369e769453f5d0
Review state: open
Reviewed content: none
Outcome: Fixes the two must-fixes of the w4-shellnet unit review round 2 (Astra). (1) tests/preview/egress-checkpoint.mjs: every forwarded request's Host header is set to the checked URL authority (the authority that admitted it and that established any git repository), so a caller's Host can no longer move an admitted read or an established git fetch to another virtual host; on an admitted network read the X-HTTP-Method-Override / X-HTTP-Method / X-Method-Override headers are removed, so a read goes upstream as the GET/HEAD it was admitted as. A registered network write keeps its headers. (2) once either byte counter has passed its allowance (256 MiB down, 8 MiB up), every later request is refused with kind budget at admission (after name resolution, before dispatch) and every later CONNECT is refused before any tunnel setup; the refusal is recorded. Tests in tests/preview/egress-checkpoint.test.ts drive the real checkpoint process with a controlled upstream: forged Host on a read and on an established fetch reaches only the checked authority; GET with a DELETE override reaches upstream as a plain GET without the header while a direct DELETE is refused; a below-allowance read and tunnel pass, a 9 MiB upload exhausts the upload allowance, and a fresh GET and a fresh CONNECT are then refused with no new upstream dispatch. Both new tests fail against the previous checkpoint and pass now.
Affected rules: 1 and 4 (the admitted operation is the one sent: authority and method bound), 26 (consequential effects only through the doorway; a read cannot be turned into a write by header), 34 and 36 (both sides of each decision in the real process), 37 (fixed at source), 60 (the byte bound is enforced at dispatch), 74 (this record), 116 (no new service; existing counters and headers); Purpose revision 12 (reads, git fetch and tunnels stay available within the allowance; the checkpoint enforces)
Affected floors: secrets — unchanged; spend cap — unchanged (no model calls); stop — unchanged; no duplicate sends — strengthened: a read can no longer reach another virtual host or act as a delete; durable intake — unchanged
Operator questions: none
Suggested tier: significant
Declared tier: critical
Tier rationale: it changes what the shell's network checkpoint sends upstream and when it stops admitting.
Side effects: a request sent with a Host differing from its URL authority now reaches the URL authority; servers relying on method-override headers for GET/HEAD reads no longer see them; after the turn's byte allowance is spent the shell has no further network for that turn.
Undo and recovery: revert this commit.
Multi-machine posture: machine-local, unchanged: one checkpoint per tool turn on its owning runner.
Layer below: the pinned harness sandbox's httpProxyPort (unchanged); admitEgress (unchanged); Node's http/https client Host handling.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: shellnet-host-bind | overwrite the forwarded Host with the checked authority rather than refuse a mismatch, so ordinary clients keep working and the request can only reach what was checked | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-shellnet-PROGRESS.md
Decision: shellnet-bytes-terminal | either spent byte allowance closes the turn's network admission (requests and tunnels) using the existing counters | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-shellnet-PROGRESS.md
Prompt review: no model-facing change: no prompt, parse or accept/refuse model path changed; the ten recorded shellnet admission rows (fixtures/tool-turn/shellnet-2026-10-03) still replay to their recorded decisions.

Subject (2 paths): tests/preview/egress-checkpoint.mjs, tests/preview/egress-checkpoint.test.ts

## Closing block

simplestRobustRoute: bind the existing forwarded headers to what admission checked and add one spent-bytes check at the existing admission points. No new service, gate or state; no ability removed.
80/20: 0 must-fix, 1 note — the gate's saved test results file was absent, so the post-test contract checkers ran without it (see PROGRESS).
VERDICT: author submission; the independent verdict is recorded as a pass
