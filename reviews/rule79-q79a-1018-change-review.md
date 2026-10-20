# Change review — separate phone coverage from unavailable renewal

Subject base: 9e6cc240a4d1e722d2cf828d522e3afb5d29db7f
Review state: open
Reviewed content: none
Outcome: Preserve the real October 9 failure (renewal below the reviewed ceiling lacked its activation), while allowing available-action coverage at the ceiling to pass independently of an explicitly untested renewal. Deliver a small desk patch for Q/M; it uses the deployed versioned helper and requires the probe update's nonempty Telegram API-accepted reply. Studio files were read only; the desk must apply the patch.
Affected rules: 26/36/70 (replay actual recorded statuses and delivery), 49/74/111 (scope and foundation), 79/82 (phone routes and unchanged renewal ceiling), 101 (no hook bypass), 102 (decisions reported), 113 (posture), 116 (split existing predicate).
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake are unchanged. No journal writes, approval submissions, live messages or authority changes.
Operator questions: none.
Suggested tier: significant
Declared tier: significant
Tier rationale: Changes proof classification, not product behavior; missing available routes must remain failures.
Side effects: Q79a/M79a can pass at the reviewed ceiling, while Q79c/M79d remain UNTESTED. Aggregate Rule 79 may remain UNTESTED; this does not claim complete renewal proof or retroactively green October 9. Configuration plus ordinary Telegram reachability does not claim an operator completed an approval. The committed patch is an unapplied desk artifact, not a deployed change.
Undo and recovery: Revert the commit and reverse the desk patch after application. No persisted product state changes.
Multi-machine posture: Each probe reads its deployed tree's reviewed expiry and declared actions and its own root's recorded status and Telegram receipt; no new store or cross-machine authority.
Layer below: Rule 79; phoneRouteProof; explicitYesStatus and operatorActionSurface; journal-agent renewalActivationOf; deployed October 9 subscription-window at 01279df4; Q/M and check.py; October 9 and October 18 saved status/receipt evidence.
Bug class: unit
Bug evidence: reproducer=tests/preview/phone-route-proof.test.ts
Hook bypass: none; core.hooksPath unset, shared hooks directory contains only sample hooks (checked).
Convergence: none
Decision: split-available-renewal | preserve below-ceiling missing-activation failure; report available actions and ceiling renewal separately without changing any trial limit | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/rule79-q79a-1018-PROGRESS.md
Decision: deployed-proof-and-receipt | Q/M use the deployed versioned helper and require their own Telegram receipt; desk changes are delivered as a patch because Studio is read-only here | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/rule79-q79a-1018-PROGRESS.md
Prompt review: No model prompt, model-output parser or model acceptance/escalation/refusal changed. Recorded status excerpts replay updates 715675120 and 6234534; the latter includes the real Telegram API-accepted receipt 8858. Existing October 8 fixture updates 715674868 and 6232820 still replay. No synthetic approval or completed renewal is claimed.
simplestRobustRoute: Split the existing predicate result and add a separate M/Q check, retaining all invalid-source, missing-route, declaration and expiry refusals. Reuse the recorded Telegram receipt and deployed helper rather than introducing a service or copying policy. No autonomous-completion claim.
80/20: Author submission for independent desk review; recorded-path replay and negative controls, with deployment and a fresh live run owned by the Studio pipeline.
VERDICT: author submission; independent review pending
