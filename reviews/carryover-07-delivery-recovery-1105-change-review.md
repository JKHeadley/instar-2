# Change review — durable recovery under the original delivery identity

Subject base: b5806d1e015dc650cdc1dee2e0accab05a849d4b
Review state: open
Reviewed content: none
Outcome: Carryover inventory row07: a proved non-delivery or valid Telegram rate-limit refusal retains the signed payload in the existing encrypted journal and resumes at its bounded due time. The original receipt owner settles accepted replies. Lost responses remain UNKNOWN. This is a builder submission, not whole-row acceptance or production delivery evidence.
Affected rules: 1, 26, 31, 32, 34, 36, 42, 46, 49, 52, 55, 61, 63, 70, 74, 87, 88, 89, 101, 102, 113, 116.
Affected floors: secrets — current outbound scan and signed payload checks precede recovery, queued bodies do not enter status; spend cap — no model calls or new reply identity; stop — current gate and installed transport checks; no duplicate sends — UNKNOWN is never re-executed, attempt CAS rejects duplicate/stale claims and outcomes; durable intake — original encrypted journal remains the sole owner and recovery start precedes transport.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Retry admission controls an irreversible physical send across restart and machine ownership changes.
Side effects: send-outcome projection retains an optional signed recovery payload; generation 7 adds non-additive send-recovery and send-reconciled frames. Exact signed subjects bind shared receipts; restart reconciliation consults the existing claim owner and never repeats UNKNOWN sends. The shared claim owner admits a next ordinal only after explicit retryable non-delivery. Legacy terminal outcomes remain terminal. Permanent 4xx refusals remain terminal. Failure notices wait while delivery can recover. The existing per-topic outbound clock bounds recovery to one per 30 seconds.
Undo and recovery: Revert code only after stopping the candidate sender. A previous reader must refuse a root with send-recovery frames: later split receipts depend on their accepted predecessor, so skipping them is not additive. Retain the encrypted journal and authority log and use a matching reader; never delete recovery state or mint replacement send identities. An older authority does not admit consumed claims and therefore does not recover retryable claims.
Multi-machine posture: Shared encrypted journal payload and retry schedule follow existing replication and takeover. Every physical attempt consumes the current authority fence and attempt ordinal. Late results from an earlier attempt cannot settle a newer claim even under the same lease. No new store, scheduler, authority or signer is introduced.
Layer below: 1.x recovery-policy.ts, delivery-failure-sentinel.ts, PendingRelayStore claim CAS/renewal, DeliveryRetryManager and DeliverySinkFailure; current sentinel delegates origin recovery with durable reservation and receipt reconciliation. 2.x journal append/fsync, original receipt projection, automatic outbound signer, conversation authority, lease renewal and replication admission, installed Telegram classifier and host send callback.
Bug class: integration
Bug evidence: reproducer=tests/preview/delivery-recovery.test.ts
Hook bypass: none
Convergence: none
Decision: row07-original-identity | extend the existing journal outcome and canonical claim owner rather than create a queue, writer or send identity; attempt ordinals distinguish stale results from current claims | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-07-port-resume-1105-PROGRESS.md
Decision: row07-proof-bound-retry | only transport-proved not-sent or a validated Telegram 429 retry_after can schedule recovery; permanent refusal and UNKNOWN never confer retry authority | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-07-port-resume-1105-PROGRESS.md
Decision: row07-retained-policy | carry the 1.x nine-step schedule and 24-hour TTL, preserving its attempts>=9 terminal boundary; current ephemeral progress is not replayed after its current() fence expires | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-07-port-resume-1105-PROGRESS.md
Decision: row07-withdrawal | a proved unsent requested reply stays open for withdrawal but occupies its original due occurrence; unsettled operator cancellation holds recovery and confirmed withdrawal cancels it without a failure notice | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-07-port-resume-1105-PROGRESS.md
Decision: row07-receipt-reconciliation | a persisted accepted receipt for the exact signed subject may settle an UNKNOWN original target after takeover; stale owners, mismatched subjects and absent receipts cannot | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-07-port-resume-1105-PROGRESS.md
Decision: row07-evidence-honesty | retained D1c candidate bytes are historical input; loopback refusal/receipt/lost-response cases are isolated test proof, not fabricated historical provider recordings or fresh live acceptance | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-07-port-resume-1105-PROGRESS.md
Prompt review: No prompt wording or semantic classifier changes. The existing request packet retains a proved-unsent requested delivery so the existing cancellation decision can withdraw it. Withdrawal/unsettled controls use the existing structured decision format; D1c recovery replays the recorded candidate. Transport decisions consume exact structured outcomes. Tests replay retained D1c candidate bytes from update 46039703 and independently inject physical endpoint outcomes. The two historical fixtures retain their stated missing-cause/raw-receipt limitations.

## Closing block


Prompt finding: 4106b49fff07 | protocol-literal | Existing topic-awareness evidence instruction; unchanged by recovery. It prevents unsupported claims about attempted avenues.
Prompt finding: 85544c20941f | protocol-literal | Existing fixed hold message; unchanged by recovery. It describes durable intake rather than conferring send authority.
Prompt finding: e8708c7fea24 | protocol-literal | Existing source citation requirement; unchanged by recovery.
Prompt finding: 849db3a6296a | protocol-literal | Existing fixed empty-memory response; unchanged by recovery.

## Row07 source adaptation boundary

Source baseline: Instar 1.x a8af8bff7ffd78dcdb2e032b216d22274141c44e. Raw source/test/design snapshots and hashes are preserved outside the worktree in the report's evidence directories. The 21-line delivery-recovery.ts adapts recovery-policy.ts's nine-step schedule, attempt exhaustion and 24-hour TTL into explicit SendOutcome inputs. HTTP 2xx alone is deliberately not acceptance: telegram-send-outcome.mjs requires an exact receipt, and the isolated accepted-but-lost/mismatched endpoint cases prove UNKNOWN is never sent twice.

PendingRelayStore enqueue/claim/renew/transition behavior is implemented through the existing encrypted journal, its single worker drain, original signed target, replicated journal and conversation-authority claim. A retry ordinal prevents a prior attempt's late result from settling a later claim under the same lease. The existing renewable lease owns machine exclusion. The handoff endpoint test adopts an actual replicated journal, recovers the original payload, and reconciles a separately persisted matching receipt after local collection is lost.

DeliveryFailureSentinel's current recoverOrigin caller enters TelegramOriginRuntime.recoverHeld before the legacy stampede/purge loop. Recovery uses the existing journal work cycle and next-due wake; it does not add another scheduler, SQLite queue, signer, writer or model re-review. Current stopped/expired/owner/disclosure/secret checks remain on each physical attempt. The native bridge test exercises failed connection, reopen, due-time recovery and one physical receipt; long-reply replay uses recorded update 6232050. Ephemeral progress/outage notices are not replayable durable results; failure notices retain at most two proved-not-sent immediate attempts and never recurse into delayed recovery.

Whole-feature gaps remain explicit: the legacy five-failed-escalations/one-hour suspension and authenticated resume/config-rotation behavior has not been adapted or demonstrated as superseded; DeliveryRetryManager's typed inbox ACK deadlines, post-injection watchdog and all its callers have not completed the required 2.x code-and-test parity pass. Receipt reconciliation presently covers signed replies, continuation parts and started recovery targets through the shared claim owner; it does not establish the entire single-machine failed-receipt-storage recovery path of OriginUnrecordedReceipts. These are not missing fresh-live-evidence excuses. This branch must not receive whole-row completion credit until those source behaviors are resolved and reviewed.

Registry update: Generated replay/shape-only register artifacts were rebuilt from committed source 8bf69f92b950445b611e56af1803dbff5c095b18 using the existing generator's explicit --commit input. This refresh changes provenance pins, not runtime authority or a native conformance declaration.

simplestRobustRoute: Retain the payload in the existing journal projection and use its existing drain, signature, send port, receipt projection and replicated claim. An attempt ordinal is necessary because a delayed outcome could otherwise settle a later retry under the same lease. A durable start is necessary because a crash after endpoint acceptance must never become retry permission. Exact valid retry metadata prevents early sends. The original nine-step/24-hour bounds and per-topic rate floor bound resource use. Physical loopback tests exercise recovery unattended; final production acceptance belongs to the desk.
80/20: Builder verification and compliance audit are in progress; whole-row source parity, independent review and fresh installed live proof remain unclaimed.
VERDICT: author submission; independent review required
