# Change review — train-147 scheduled MCP integration

Subject base: 17daf07876102b3cf68d8ecc4e9faa178784acbe
Review state: open
Reviewed content: none
Outcome: integrate the exact reviewed scheduled-session MCP passthrough onto the accepted train-144 live base.
Affected rules: 1, 26, 34, 36, 37, 49, 70, 74, 90, 100, 101, 102, 103, 111, 113, 116
Affected floors: existing secret custody, spend cap, stop, effect uniqueness including no duplicate sends, and durable intake remain enforced by the same owners. No policy or grant is widened.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: integration of reviewed connector launch plumbing; no new prompt, parser, policy or effect engine.
Side effects: scheduled sessions now receive configured reviewed MCP connectors and read scope through existing preparation and admission. Empty configuration stays empty; unlisted and write calls still require existing grants.
Undo and recovery: keep accepted live build until desk gate; revert this integration through the existing release process if needed. No live runner or persistent product state was modified here.
Multi-machine posture: installation-local configuration and connector processes stay under the existing session owner; ownership, replication and handoff remain unchanged.
Layer below: read both constitutional documents, verified task snapshots, traced the member diff and actual factory/admission test, and reused existing repin/build/rehash/register machinery.
Bug class: integration
Bug evidence: reproducer=tests/preview/mcp-passthrough.test.ts
Hook bypass: none
Convergence: none
Decision: train-147-merge | Ordinary merge of exact reviewed 099456d9745a90a50d637f7005aac17e4e57a408; member report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/mcp-passthrough-1024-PROGRESS.md read from its SHA-verified task snapshot. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-147-PROGRESS.md
Decision: train-147-A | Preserve the member and live behavior byte-for-byte; fast-forward merge requires no conflict resolution. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-147-PROGRESS.md
Decision: train-147-B | Create branch directly at exact live 17daf07876102b3cf68d8ecc4e9faa178784acbe, with no main merge or branch movement. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-147-PROGRESS.md
Decision: train-147-C | No product conflict and no member omitted; regenerate generated publication rather than hand-editing it. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-147-PROGRESS.md
Decision: train-147-D | Report unchanged WSL host-dependent failures and Studio-only evidence separately under the explicit remote handoff exception; do not weaken declarations. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-147-PROGRESS.md
Decision: train-147-desk | Run downloaded desk chain with the temporary sed command adapted to Linux; preserve the fixed prompt guard and publish regenerated register pins. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-147-PROGRESS.md
Prompt review: No prompt or model parser changed. Member regression replays recorded summary-writer 715672480, uncertain summary 715672483, Jev undecided 715672482, Jev unsure 969389570, reply-review 969389923, delivered reply 715672479 and empty candidate 715672550 through actual prepared read/effect admission. The empty candidate is not claimed delivered.
Deferral: generated/register.json:1 | not-a-deferral=generated quotation of governing rules, not a deferred commitment
simplestRobustRoute: This is the simplest robust route: one ordinary reviewed-head merge and existing desk regeneration and consumer checks, with no new machinery. Existing admission is the start guard, claim close the end guard, and stop, expiry, budget and effect uniqueness the limit guards. No unattended live deployment claim is made.
80/20: Preserve reviewed behavior, verify configured and absent roots and both session modes, then submit the combined candidate to the Studio gate without running the full suite here.
VERDICT: author submission; no independent convergence claim
