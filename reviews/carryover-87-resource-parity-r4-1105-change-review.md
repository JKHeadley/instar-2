# Change review — Observe updater bounds and resolve computed configuration owners

Subject base: c3d42bd2c651ae816650080e0a2a98a659ec8cce
Review state: open
Reviewed content: none
Outcome: Add a recurring updater-bound observation to the existing due-proof runner, with fresh transaction replay and actual controller/resource state. Trace the ten computed 1.x configuration calls into their owners and retain absent-feature dependencies. Void two stale frozen review rounds through the normal review command while preserving their historical mismatches. Row 87 remains OPEN: standalone independent resource admission and complete periodic enforcement are not finished.
Affected rules: 26/42/43/55/60/61/95 (honest observed bounds and unknown/refusal); 44/45 (computed and nested consumer ownership); 34/70 (positive and negative runtime-state evidence); 49/69/74/102 (provenance and review); 101/109 (ordinary hooks and reopened review rounds); 32/113 (machine-local update state); 116 (reuse existing proof scheduler and transaction).
Affected floors: secrets — only counts, times and states are observed, no credential paths added; spend cap — zero model calls or cap changes; stop — proof scheduling retains stop and expiry; no duplicate sends — no send or canary update path; durable intake — the existing runner continues serving on missing update evidence, no restore or replay.
Operator questions: none
Suggested tier: significant
Declared tier: critical
Tier rationale: The change observes the admitted runner's update and resource state, but does not grant standalone authority or change update enforcement.
Side effects: One additional due plan runs at most once per minute through the existing one-plan-per-cycle scheduler. Missing updater state remains unknown; a violated pressure/timer/resource predicate is failed. Existing shortest-cadence tests now account for this plan. Historical browser review rounds are void, not accepted on changed bytes.
Undo and recovery: Revert this source change while retaining update-state, proof history and the original resource ledger. Reverting observation does not undo an install. Do not reinstate a stale frozen review as accepted; any review close requires its current subject and independent evidence.
Multi-machine posture: The observed updater transaction, timers and host capacity describe this machine. No settings, installation identity or resource authority is replicated or widened. Existing conversation ownership and independently admitted replacement remain unchanged.
Layer below: Read full purpose/rules and origin/main wording differences, both predecessor reports, the existing updater transaction/resource owner, Six host composition, production installation/boot interfaces, the due-proof scheduler and proof-record decoder. Read the pinned 1.x computed callers and their path producers. The only host allocation composition found uses fixture signing; it is not repurposed into standalone authority.
Bug class: integration
Bug evidence: reproducer=tests/preview/update-bound.test.ts
Hook bypass: none
Convergence: none
Prompt review: No model prompt, model-output parser or acceptance/escalation selector changes. The new probe is a host-state observation in the existing status/proof inventory. Its test results are not model replay or live installed proof.
Decision: c87r4-probe | Reuse due proofs and fresh updater/resource observations; missing evidence is unknown, violations fail, and the unbounded-service declaration stays visible until complete enforcement is established. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-87-resource-parity-r4-1105-PROGRESS.md
Decision: c87r4-owners | Resolve all ten computed call sites at pinned b446e92 and review named nested blocks; keep authority paths protected and absent consumers as explicit dependencies. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-87-resource-parity-r4-1105-PROGRESS.md
Decision: c87r4-review | Use the normal open command to void two mismatched historical frozen rounds, retaining their old digests and need for independent review; do not waive or repin them as accepted. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-87-resource-parity-r4-1105-PROGRESS.md
Decision: c87r4-authority | Preserve the existing standalone path as an explicit unresolved requirement rather than supplying fixture signing, a fake allocation handle, changed installation bindings or a second ledger as independent admission. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-87-resource-parity-r4-1105-PROGRESS.md

## Closing block

simplestRobustRoute: The existing due-proof runner reads the existing update transaction and real controller/resource state. This prevents an updater whose pause or resource attachment is broken from appearing healthy on the pull surface, without a second scheduler, watcher or state store. The owner map resolves the computed domains rather than copying a generic config writer. This change does not claim autonomous-completion or standalone resource admission; the earlier physical replacement/recovery evidence remains distinct and unchanged.
80/20: Focused tests cover fresh evidence, corrupt or missing input, retained pressure through recreation, timer mismatch, backoff and capacity/refusal neighbors. The two historical frozen reviews are reopened rather than hidden. Full row parity, independent review and live installed acceptance are not claimed.
VERDICT: author submission; whole-row completion remains open
