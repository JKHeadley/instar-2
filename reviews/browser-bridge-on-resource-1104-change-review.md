# Change review — browser bridge on current live resource recovery

Subject base: 47b9c8234e85856ca3aeee322927621139af4342
Review state: open
Reviewed content: none
Outcome: Merge the independently reviewed bounded owner GitHub read sequence onto the answering resource-recovery build, retaining its worker-slot repair. The only merge conflicts were generated register outputs; regenerate those against the merged source commit. The later connector file ACL and Claude-compatible MCP schema repairs are reviewed separately in browser-mcp-worker-read-1104-change-review.md; this combined record covers the updated exact content.
Affected rules: 1, 4, 18, 28, 34, 36, 42, 44, 49, 55, 57, 60, 61, 62, 63, 66, 74, 78, 84, 95, 100, 101, 103, 111, 113, 116
Affected floors: secrets — owner-side fixed DOM projection and scrub stay in place; spend cap — no model budget change; stop — the same claim and deadline bound every read; no duplicate sends — read-only operation admits no send or write; durable intake — existing effect preparation and exact grant remain prerequisites.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The combined browser and live worker paths touch protected task execution and require an exact-head full gate and live proof.
Side effects: The configured agent-owned Chrome tab can navigate through two to four named GitHub pages. The worker receives bounded observations, not profile custody. The resource-owner recovery remains as in the live build.
Undo and recovery: Restore live 47b9c823 if the combined build fails. Retain prepared and uncertain effect records; do not replay an uncertain identity.
Multi-machine posture: Owner browser stays local to its signed-in profile; worker remains separate. No new remote credential or browser fallback.
Layer below: Compared the two parent trees and the seven generated conflicts. No production source file conflicted; the initial combination preserved reviewed 24194ed8 browser source and live 47b9c823 resource-owner source. Subsequent exact-head connector repairs are scoped in the separate review; resource-owner source remains byte-identical to live.
1.x reference: Reuses the PID-addressed Chrome Apple Event and active-tab behavior in 1.x `src/core/PlainChromeReloginBrowser.ts` and `src/templates/scripts/browser/chrome-js.sh`, and dead-holder recovery from `src/core/hostTestRunnerSemaphore.ts`. The 2.0 owner bridge keeps profile custody on the owner side and adds only bounded named-page sequencing; its resource recovery also requires a descendant census before returning worker capacity. This does not claim general 1.x browser parity before the real multi-step group task.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: claimed
Prompt review: no prompt or model dispatch change.
Skip: tests/preview/session-connectors.test.ts:60 | scope=the worker-account check requires a macOS harness host with passwordless sudo; cross-platform cases run elsewhere.
Deferral: generated/register.json:1 | not-a-deferral=generated source hash was regenerated from the merged commit; the original branch's separate missing Part Two authority is unchanged and remains open.

Decision: BROWSER-MERGE-1104-1 | Merge reviewed 24194ed8 onto live 47b9c823; retain live generated output only for the merge commit, then regenerate all seven outputs from that exact merged source. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/SEAM-LEDGER.md
Decision: BROWSER-MERGE-1104-2 | Reopen the copied resource-recovery review whose generated-register subject changed in the combination; cover the exact combined content here and require independent review again before release. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/SEAM-LEDGER.md



## Row 88 review invalidation

The b738936 frozen subject was intact before this unit. The generated register
publication now differs, so this round is explicitly reopened. Prior
browser evidence remains history, not approval of the combined head. Row 88
runtime/model changes and remaining gaps are described in
carryover-88-hub-binding-r2-1105-change-review.md; new independent review is required.

Prompt finding: 4106b49fff07 | protocol-literal | Existing session capability boundary describes observed tool availability, not an expected fixture answer. This change only adds a journal frame and does not alter that prompt.
Prompt finding: 849db3a6296a | protocol-literal | Existing empty-memory wording is conditional on the actual memory projection; the fixture quotes that governed-state branch. No prompt edit here.
Prompt finding: 85544c20941f | protocol-literal | Existing retained-input acknowledgement names actual custody, not a target answer supplied by this hub change.
Prompt finding: e8708c7fea24 | protocol-literal | Existing source-label grounding instruction is general and names uncertainty; it does not inject a test answer.
Skip: tests/preview/hub-recorded.test.ts:43 | scope=Private actual-provider recordings are supplied with INSTAR_HUB_CAPTURE_ROOT; absent evidence visibly skips, and never counts as recorded proof. This unit explicitly ran all six cases with hash-verified private bytes.

## Closing block

simplestRobustRoute: Reuse the existing owner read bridge with explicit page scope and the live resource recovery, under the same grant and custody boundary.
80/20: The two browser test files and register lifecycle test passed 31/31 on the combined branch. Full exact-head suite, independent combination review and a real signed-in multi-step group task remain required before release. No new browser service or credential custody path.
VERDICT: author submission; this record asserts no independent verdict.
