# Change review — retain requested follow-up delivery after busy work

Subject base: ca3d8ab80f606ce490c2883e71b6b5ab2a93d154
Review state: open
Reviewed content: none
Outcome: a successful empty poll retains one ordinary-lane wake when work is busy, so its finished requested result can be delivered without another operator message. Nonempty polls still drain intake first. The result's existing durable identity and receipts govern delivery and restart.
Affected rules: 1/8/46/83 structural follow-through; 4/28/29/63 existing source and owner admission; 34/36/70 recorded-shape regression through the launcher; 55/60/61 bounded coalescing and existing backoff; 74/113 review and multi-machine posture; 87/93 requested delivery and withdrawal; 101 no bypass; 102 recorded decisions; 116 reuse the existing mechanism.
Affected floors: secrets — unchanged outbound checks; spend cap — unchanged worker capacity; stop — wake admission and worker gates; no duplicate sends — unchanged signed result occurrence and uncertain-send identity; durable intake — the queued pass drains accepted input before delivery.
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: changes the delivery scheduling of already-authorized results, with no new authority, model call or protocol.
Side effects: one pending job can now be retained by a quiet poll. Repeated empty polls coalesce in the existing single slot. A subsequent inbound wake replaces it and drains withdrawal input. Ownership, peer durability and failure backoff are still checked when the pending job is admitted.
Undo and recovery: revert the scheduling line. No journal schema changes; durable work and receipts remain readable. Results remain pending if the wake is refused or the process dies.
Multi-machine posture: the wake is deliberately process-local and disposable, exactly like the existing intake wake. Work and send identity remain in the shared journal; only the admitted owner with current peer durability can consume the wake. A restart reconstructs pending work from the journal and the next successful empty poll.
Layer below: inspected createOrdinaryLane/sentinelCycle admission and coalescing, sendRequested/drainTurns withdrawal ordering, owedResultAuthority source binding, and existing result/receipt projection. Compared 1.x CommitmentTracker.deliver and PromiseBeacon emitUserSendSerial/applyDeliveryOutcome at origin/main c2300451e37c98e592ea8d2c260c56fb7b1c901a: reuse the unfinished-delivery rearming behavior and receipt-bound retirement through existing 2.0 ports, not a second beacon service.
Bug class: integration
Bug evidence: reproducer=tests/preview/followup-deliver-launch.test.ts
Hook bypass: none
Convergence: none
Deferral: tests/preview/followup-deliver-launch.test.ts:14 | not-a-deferral=Test name exercises recorded follow-up scheduling; it postpones no assigned work.
Prompt review: no prompt, parser, model classification or acceptance semantics changed. Exact recorded request, answer and work result from proofroom4 update 46040219 run through the actual launcher, journal and isolated HTTP transport. Reviewer and cancellation-neighbor answers are explicit stand-ins; this is not a new live-model or live-Telegram proof.
Decision: followup-deliver-1022-wake | Reuse the existing single coalesced wake for an empty-poll delivery pass; prevent lost delivery opportunities without a queue, timer or new send identity. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/followup-deliver-1022-PROGRESS.md
Decision: followup-deliver-1022-linux-fixture | The scheduler regression uses a test-only bash/thread-aware transport census on Linux; production limits are unchanged and native host conformance is not claimed. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/followup-deliver-1022-PROGRESS.md

Register publication: generated artifacts are mechanically regenerated from the pushed source commit so lint and register checks bind the current launcher. Owner manifest rehash reported zero changes; no declaration or authority was changed.

Verification: the added launcher case first failed with zero sendMessage calls after two successful empty polls while recorded work was in flight. With the scheduling repair it delivered the recorded result once and did not send it again after restart. Existing owed-delivery, requested-report-live and dispatch-now tests exercise source authorization, withdrawal, stop, reply/call caps, secrets, peer loss, backoff, uncertain sends and replay. Tests use injected latency, never artificial CPU load. Live proof-room acceptance remains the desk's gate; the prior D1b/D2/D1c failures are not relabeled passed here.

Test boundary: on Linux only, the fixture loader selects bash for the existing transport limit script and counts threads with ps -L, reserving 32 thread slots instead of the macOS process headroom. This supplies a portable physical adapter for the scheduling test. The exact bridge still checks identity, records sends and seals receipts; CPU, handles, elapsed time and a finite process ceiling remain applied. This test does not establish native Linux transport conformance.

## Closing block

simplestRobustRoute: this is the simplest robust route: use the already-implemented ordinary lane's one pending wake after a successful quiet poll. It prevents an observed lost wake while preserving existing start, end-state and limit guards. No new store, timer, model call or delivery authority. The unattended recorded-output launcher replay establishes this scheduling repair; actual live-room completion is not claimed.
80/20: a single scheduling expression changes; focused regression and existing floor tests cover it. No adjacent host portability or model-classification repair is included.
VERDICT: author submission; independent desk review pending
