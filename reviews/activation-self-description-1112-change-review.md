# Change review — truthful activation self-description

Subject base: f98b62cf0bd0a3ab9e515006592963311540b906
Review state: open
Reviewed content: none
Outcome: New turn briefings, access inventories, reply-review credential facts, renewal requests and status describe the activation end as a record reminder. The agent keeps working without renewal. Genuine credential expiry retains its warning and replacement step. Existing recorded requests and replies replay unchanged.
Affected rules: 21, 26, 36, 49, 70, 74, 84, 87, 100, 101, 102, 103, 111, 113, 116, 123
Affected floors: secrets — existing label/value checks remain before projection; spend cap — unchanged allowance and context floor, no added model call; stop — actual stop still blocks, false expiry label removed; no duplicate sends — existing notice keys and durable intent unchanged; durable intake — no row rewrite or deletion, old request wording accepted
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Model-facing instructions and current credential facts change, and the request replay validator gains the exact previous rendering as a compatibility alternative.
Side effects: The record is no longer portrayed as an outage by either the answer or reply reviewer. The real credential path still uses remainingText and its original renewal action. Record dates, approvals, grants, budgets and custody remain untouched. New request/result wording names the reminder date; old request texts remain valid. Status normalizes the action even for an old registry record without editing that record. No sender, timer or store is added. Old blockers pinned to the previous stop-plus-expiry description remain stored but require rechecking before being offered as settled. Health/proof classification can now see a genuinely stalled backlog instead of treating it as inhibited by expiry.
Undo and recovery: Revert display changes if needed, but retain acceptance of the new request wording in the journal validator so newly written rows continue replaying. No credential or journal migration is required.
Multi-machine posture: Existing installation/journal owner generates current projections on each host. No new machine-local durable state, peer requirement or cross-journal deduplication claim.
Team posture: Existing verified operator request/status audience remains unchanged. Member/guest visibility and authority are not widened. This installation record is not a newly shared person-owned artifact.
Layer below: Read capabilityBriefing, readSelfAccess/selfStateSource, publicCredentialRegister, dueCredentialReminders, closingNoticeText, credentialNotices, addOperatorRequest, operatorRequestText/operatorResultText and status registration. loopHealth still projected the date as a backlog/delivery inhibition; remove that false status reason while retaining real stop and allowance reasons. Runtime already ignores activation date for stop; real stop and credential failure remain separate. Base f98b62cf0 already suppresses activation credential notices and provides the once-per-end closing notice.
Bug class: integration
Bug evidence: reproducer=tests/preview/activation-self-description.test.ts
Hook bypass: none
Convergence: none
Decision: activation-self-projections | Correct existing presentation seams rather than add a prompt filter or change authorization. Keep dates and old journal bytes; genuinely expired credentials retain blocking meaning. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/activation-self-description-1112-PROGRESS.md
Decision: activation-self-context | Shorten the capability sentence after the context-floor test caught 53 extra bytes; retain the unchanged cap/reserve and the actual date in self-state. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/activation-self-description-1112-PROGRESS.md
Decision: activation-self-replay | Extend existing exact request-rendering compatibility to both historical installation/trial wording while new requests name a record reminder date; malformed requests still refuse. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/activation-self-description-1112-PROGRESS.md
Prompt review: Regression probes the actual journal turn packet before, at and after the recorded end and distinguishes a real expired JWT. Captured replay tests retain raw outputs and history: summary writer 715672480, uncertain summary 715672483, Jev undecided 715672482, unsure 969389570, review 969389923, delivered 715672479 and empty candidate 715672550. Existing activation-reminder-once, credential-self-state and credential-label-boundary tests exercise recorded shapes with current projections. The self-description capture adapter explicitly translates only the changed capability sentence; historical judge digests and bytes are not rewritten. No claim of new live model acceptance is made.

1.x comparison: Searched actual JKHeadley/instar main 700b2a9135623f5eae27ebcf5352d9a6d9135c1b src/, docs/specs/ and history. SubscriptionReloginApprovalReminder.ts/server.ts and 7f50d366a/982978c44 provide one reminder per waiting episode but say repair waits for approval: that genuinely blocking repair is a mismatch for this nonblocking record date. BIAS-TO-ACTION-SPEC.md identifies reasking for already-held authorization as a false blocker. Reuse the existing 2.0 durable once-per-end notice and current-state projections, not an unrelated timer. Read locally cached ONEX-LESSONS /tmp/train242-onex.md sections 3/4: repeated status and ambiguous sends require durable dedup, actual login failure must be corroborated; no delivery or login policy changes here.

Independent read-only review found stale briefing commentary, model action guidance and gate labels; corrected all three. Old request replay and malformed neighbor are covered in agentready.test.ts. This is author submission to the desk, not independent Astra compliance or a Studio native proof.

Deferral: generated/register.json:1 | not-a-deferral=mechanical register replay retains existing governed declarations; this change defers no product behavior

## Closing block

simplestRobustRoute: This is the simplest robust route: correct existing renderers and accept the exact earlier request text on replay. No new classifier, stop rule, timer, credential schema or authority. Existing stop, resource caps, secret checks and durable send intent remain the guards.
80/20: Under 60 changed product lines; tests cover both sides of activation versus actual credential expiry, record replay, captured shapes and unchanged context floor. The desk owns native conformance and live acceptance.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
