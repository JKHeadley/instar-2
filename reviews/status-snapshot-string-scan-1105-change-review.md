# Change review — bounded snapshot string scanning

Subject base: b5806d1e015dc650cdc1dee2e0accab05a849d4b
Review state: open
Reviewed content: none
Outcome: Reduce authenticated journal snapshot parsing latency by skipping quoted payload with native byte search while preserving every scalar value, validation and bound, and the complete status report.
Affected rules: 7, 26, 34, 42, 60, 74, 95, 101, 111, 113, 116
Affected floors: secrets — no diagnostic payload or credentials enter source; spend cap — no model call; stop and ownership — same complete replay/report; no duplicate sends and durable intake — no writer or dispatch change.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: The shared retained-snapshot parser affects replay integrity. Focused malformed/chunk-boundary controls, real authenticated snapshot equivalence and independent review are necessary.
Side effects: All journal readers use the faster quoted-scalar scan. JSON scalar validation and two MiB scalar limit remain; larger containers remain streamed.
Undo and recovery: Revert this source commit through the ordinary reviewed update path. No journal format or state migration is required.
Multi-machine posture: Identical parser code on each machine; no new durable store or cross-machine ownership.
Layer below: The exact b580 status CLI first authenticates and decompresses frames, verifies snapshot digest, restores projection and builds full status. Its 181,823,916-byte snapshot parser dominated the measured replay. Buffer.indexOf changes only discovery of the next unescaped quote; JSON.parse still validates its exact bytes.
Bug class: live-path
Bug evidence: reproducer=tests/preview/journal-json.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/status-read-profile-1105/parser-real-control.json
Hook bypass: none
Convergence: none
Prompt review: No model prompt or decision change; recorded shapes and full authenticated snapshot were parsed equivalently.

Decision: STATUS-SCAN-1105-1 | Optimize the existing scalar scanner instead of weakening validation, adding a checkpoint reader or increasing status deadlines. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/status-read-profile-1105.md

## Closing block

simplestRobustRoute: Keep the existing authenticated journal and status consumers, and replace their per-byte quoted-string loop with native byte search and exact cross-chunk escape parity.
80/20: This removes a measured parser cost with no new service or store. Timing measurements establish improvement only for the captured input, not universal readiness.
VERDICT: author submission; independent review and normal release gates are required.
