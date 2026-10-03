# Change review — w4-shellnet repair round 1: git fetch is a read only once established, tunnels take budget slots before setup, admission rows flushed before dispatch, R105 re-declared

Subject base: 2d801578e9ee110caf9697a44d927e50e8f0804b
Review state: open
Reviewed content: none
Outcome: Fixes the four must-fixes of the w4-shellnet unit review (Astra round 1). (1) tests/preview/tool-admission.mjs: a POST to …/git-upload-pack is a read only when the checkpoint established it: that same repository (gitUploadPackBase) answered this turn's git discovery with 200 and application/x-git-upload-pack-advertisement, and the POST declares application/x-git-upload-pack-request; the path alone is a write for the effect doorway. (2) tests/preview/egress-checkpoint.mjs: each CONNECT takes a request-budget slot and one of 16 open-tunnel slots before DNS, certificate or OpenSSL work, released on close; idle tunnels end at 30 s; past the 512 budget one egress-budget row is recorded and later refusals add none (toolTrace and the journal trace carry egressBudgetSpent). (3) the admission record is one O_APPEND descriptor; each row is written and fsynced before dispatch, the directory fsynced at open; a failed flush closes the request unsent. (4) src/assembly/harness.declarations.json: the self-host conformance digest re-declared after native-harness-contract passed (8/9 with only the declaration case failing, then 9/9).
Affected rules: 1 and 4 (exact, established git read test; other POSTs go to the doorway), 2 (the decision is on disk before dispatch), 34 and 36 (both sides of each new decision in the real checkpoint process with a controlled upstream; the recorded harness rows replay through the same establishment), 37 (fixed at source), 60 (tunnels, requests, certificates, OpenSSL runs and rows bounded), 74 (this record), 102 (decisions reported), 105 (conformance re-declared on contract evidence), 116 (no new service or gate); Purpose revision 12 (the shell keeps git clone/fetch and its other reads; the checkpoint enforces)
Affected floors: secrets — unchanged (no credential reachable or added); spend cap — unchanged (no model calls); stop — unchanged (checkpoint stopped by exact pid; tunnels now also idle-bounded); no duplicate sends — strengthened: a non-git POST with a git-shaped path no longer leaves as a read; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it changes what the shell's network checkpoint admits and how it records and bounds requests.
Side effects: each admission row now costs one fsync; a git fetch from a server that does not answer discovery as git (dumb HTTP) is a write for the doorway; at most 16 HTTPS tunnels open at once per turn; tunnels count against the 512-request budget; a trace may carry egressBudgetSpent.
Undo and recovery: revert these commits; the journal's new optional field is absent on older rows and accepted.
Multi-machine posture: machine-local, unchanged: one checkpoint per tool turn on its owning runner; journal rows replay elsewhere.
Layer below: the pinned harness sandbox's httpProxyPort (unchanged); admitToolEffect (unchanged); publicAddress/webReadHost (unchanged); fsync on the admission state's volume; git's smart-HTTP protocol (discovery content type and request content type, both protocol v0/v2).
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: shellnet-git-established | a git negotiation POST is a read only after the same repository answered discovery as a git server and the POST declares git's request type, rather than parsing its body | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-shellnet-PROGRESS.md
Decision: shellnet-tunnel-slots | tunnels have their own 16 open slots, separate from open requests, because an HTTP/1.1 tunnel carries one request at a time and a shared counter would let 8 tunnels hold all 16 | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-shellnet-PROGRESS.md
Prompt review: no model-facing change: no prompt, parse or accept/refuse path changed; the recorded shellnet admission rows (fixtures/tool-turn/shellnet-2026-10-03) replay to their recorded decisions through the new establishment.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register replay output

Subject (13 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, src/assembly/harness.declarations.json, tests/preview/egress-checkpoint.mjs, tests/preview/egress-checkpoint.test.ts, tests/preview/journal.ts, tests/preview/tool-admission.mjs, tests/preview/tool-turn.mjs

## Closing block

simplestRobustRoute: keep the one per-turn checkpoint and the existing doorway; establish git reads from the server's own discovery answer, take the existing budget before tunnel setup, and fsync the existing record before dispatch. No new service, gate or journal; no ability removed.
80/20: 0 must-fix, 2 notes — the post-test contract checkers had no gate results file to read (absent at gate-w4-shellnet); the live pinned-harness and Telegram proofs from the unit remain the desk's under the combined build.
VERDICT: author submission; the independent verdict is recorded as a pass
