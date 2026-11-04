# Change review — worker reads connector launch configuration

Subject base: bcbe1def1642146c18f1e0d569ab84016fa6454e
Review state: open
Reviewed content: none
Outcome: Grant the worker read access to the generated MCP launch configuration before its continuing session starts. Keep the configuration owned by the operator and read-only to the worker.
Affected rules: 31, 63, 74, 78, 95, 101, 103, 111, 113, 116
Affected floors: secrets — only the already redacted launch file is readable, not credential custody; spend cap — unchanged; stop — unchanged; no duplicate sends — no new effect path; durable intake — unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: This repairs a worker account access boundary used by the signed-in browser connector. It requires a real worker-account test, full exact-head gate, independent review, and copy trial before live use.
Side effects: The harness worker can read the generated MCP launch file for its own session. It cannot edit that file or read the owner browser profile.
Undo and recovery: Keep live 47b9c823 serving until the corrected build proves a real signed-in multi-step browser task. Restore that live build if the later switch fails.
Multi-machine posture: This is the existing macOS harness account ACL on the local generated file; no remote credential or profile copy.
Layer below: A real copy produced an MCP file with owner_github but the worker account could not read it. The adjacent admission file was readable. The added test uses sudo as the worker to read the exact launch file and fails when the ACL line is removed.
1.x reference: A 1.x session runs as the machine owner and can read its own browser connector configuration. The separate 2.0 worker account needs this narrow read grant to reach the same connector.
Bug class: connector launch file inaccessible to worker
Bug evidence: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/browser-bridge-real-room2-r2-1104.log
Hook bypass: none
Convergence: none
Prompt review: no prompt or model dispatch change.
Skip: tests/preview/session-connectors.test.ts:60 | scope=the native worker-account check applies only to the macOS harness host with passwordless sudo; other hosts run the cross-platform connector cases.

Decision: MCP-READ-1104-1 | Grant read-only ACL only on the generated MCP file at launch, rather than giving the worker access to the owner profile or shared temp directory. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/SEAM-LEDGER.md

## Closing block

simplestRobustRoute: Use the existing harness ACL helper on the one generated file before a continuing session launches.
80/20: The worker can load the connector without changing owner profile custody. Real signed-in page reads still need copy proof before live release.
VERDICT: author submission; this record asserts no independent verdict.
