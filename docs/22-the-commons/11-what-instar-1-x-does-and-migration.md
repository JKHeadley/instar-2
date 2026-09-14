## 11. What Instar 1.x does and migration

**Rule — distinguish inspected source, recorded incidents and live observation.** **Checks: P22-NF-01/18.**
R1's 1.x pin is the source basis for the inventory below. Its local observation at
2026-09-13T23:39:22Z found the inbox drainer unavailable, zero rows in this machine's canonical
store, and an unavailable operating drain with no live consumer. This is not a present global
fleet count. The remote deploy, inbox population and latest successful fleet fix remain unknown.
No network experiment or full release-to-improvement loop was observed in that research.

Basis: Constraint 3; [R1](research/01-instar-1x-feedback-factory.md), operational evidence and source pin; section 1.

**Rule — keep useful custody and owned-work mechanisms; replace incompatible semantics.** **Checks: P22-NF-18/19/20.**

| 1.x path at the R1 pin | What it does | Disposition |
|---|---|---|
| `src/core/FeedbackManager.ts` and `src/server/routes.ts` | Bounded narrative reports, local persistence, retries; first network attempt precedes local append; any response.ok counts forwarded | Keep local receipts and bounded retries; replace with outbox-before-send, concurrent-safe append, typed stages and closed derived-case schema |
| `src/core/canonicalFeedback.ts`, `src/core/PostUpdateMigrator.ts` | Canonical configurable address; known legacy URL migration preserves custom URLs | Keep same-code operated split and address selection; new destination never inherits consent |
| `src/core/FeedbackManager.ts`, receiver `handlers.ts` | Name-derived pseudonym; initial send contains name and pseudonym, retry differs; receiver stores name/IP; optional HMAC is not per-principal standing | Replace with destination-scoped verified enrollment, independent standing grants and same privacy decoder on every attempt |
| `src/monitoring/FeedbackAnomalyDetector.ts`, receiver `handlers.ts` | Memory-local contributor controls and separate per-IP front limits | Replace resettable limits with durable multi-worker budgets; do not infer unique operators from IPs |
| `feedback-front/src/feedback.ts`, `receiver/BlobInboxStore.ts` | Cloud inbox can persist while operated host is offline; probe/honeypot can acknowledge without storage | Keep decoupled custody; require authenticated durable receipts and protected attachment access |
| `src/feedback-factory/inbox/InboxDrainer.ts` | Append before delete, duplicate handling, quarantine, bounded passes | Preserve ordering and idempotency; add closed schema, export grants and complete semantic custody checks |
| `src/feedback-factory/processor/fingerprint.ts`, `cluster.ts`, `transitions.ts` | Stateful grouping and recurrence; selected transitions check justification length (at least 20 characters) and required dispatch references, not supporting evidence validity | Preserve curated decisions, splits, historical lifecycle labels and owned work; replace justification-length or similarity-as-evidence promotion with owner-validated case/grade/placement gates |
| `src/feedback-factory/processor/verify.ts` | Version-anchored verification accepts 24 hours without reported recurrence; the silence-based path accepts elapsed time against a recurrence-derived wait, with low confidence | Preserve old verification labels/methods as legacy claims; replace time/silence-based promotion with current owner-validated outcome evidence and separate reason/conclusion grades |
| `src/feedback-factory/processing/FeedbackProcessingService.ts` and operating-drain spec | Refresh store before clustering; bounded readiness, fenced outbox and exact-key owned task handoff | Keep accountable handoff; add scenario/proposal/release/install/outcome branches and their loss detectors |
| Shipped/installed feedback skills identified separately in R1 | Narrative report guidance, including original user words; some receipt/auth examples differ from code | Replace export guidance and structural validators together; no skill wording can authorize private export |

Basis: 1.x source at the section 1 pin; `src/core/FeedbackManager.ts:165–227,248–352` and `src/server/routes.ts:20925–21018`.
Basis: 1.x source at the section 1 pin; `src/core/canonicalFeedback.ts:26–31`, `src/core/PostUpdateMigrator.ts:11210–11216`.
Basis: 1.x source at the section 1 pin; `src/core/FeedbackManager.ts:125–159,269–280`, receiver `handlers.ts:100–107,145–157`.
Basis: 1.x source at the section 1 pin; `src/monitoring/FeedbackAnomalyDetector.ts:36–109`, receiver `handlers.ts:74–107`.
Basis: 1.x source at the section 1 pin; `feedback-front/src/feedback.ts:54–110`, `receiver/BlobInboxStore.ts:32–39`.
Basis: 1.x source at the section 1 pin; `src/feedback-factory/inbox/InboxDrainer.ts:113–216`.
Basis: 1.x source at the section 1 pin; `src/feedback-factory/processor/fingerprint.ts:68–73`, `cluster.ts:23–119`, `transitions.ts:28–110`, `verify.ts:76–111`.
Basis: 1.x source at the section 1 pin; `src/feedback-factory/processing/FeedbackProcessingService.ts:88–104` and operating-drain spec.

The recorded 661-unsent-report retry incident and approximately 12,000-report/149-cluster
collection without owned work become permanent regressions. These historical incident counts
are evidence inputs, not newly measured workload or successful 2.0 tests.

Basis: Coherency, trust, constraints 2/3; rules 44/45/58/85/111; R1 detailed source citations and limits.

**Rule — migration preserves evidence without grandfathering permission.** **Checks: P22-NF-18/19.**
Before cutover inventory local reports, unsent queues, canonical store, curated cluster notes,
recurrence/lifecycle, dispatch/task links, signatures, grants, private attachments, source ids,
custom endpoints and consumers. Preserve a verified recovery snapshot under existing custody.
Legacy narrative reports stay restricted `legacy-report` records. They are not real graded
benchmark cases, verified standing or safe default exports merely because an id survived.
Current owner validation may derive a new case linked to the original; no automatic bulk upload.
An imported `verified` state and its original confidence, verifier, timestamps and reason remain
historical claims, never current proof. No absence of reports, elapsed interval or sufficiently
long justification can promote them. F25 pairs faithful legacy import with a refused attempt
to use that label as current support; new owner-validated outcome evidence and a linked current
grade are required for present verification and promotion. Missing later outcomes stay unknown.

Use a restartable import ledger with source ids/digests kept locally, before/after counts,
quarantined failures and one canonical adoption. Replaying the import cannot duplicate work or
reset consent. Preserve curated history exactly; test recorded-corpus parity separately from
order-independent live invariants because similarity grouping can depend on order.
Run shadow read comparison, then switch one fenced writer after verified custody and explicit
consumer readiness. Dual writers cannot dispatch the same task. Keep rollback mapping and
outbox exposure until the destination's receipt is established. Missing snapshots or unresolved
counts hold cutover and expose recovery status.

Basis: Purpose constraint 2; rules 32/33/44/45/69/111; R1 migration/operating-drain evidence; ST/EX seams.

**Rule — existing installations receive the same privacy and behavior contract.** **Checks: P22-NF-18/19/20.**
Update paths install validators, registered emitters, owned-work consumers and awareness guidance
with disabled sharing preserved. Never overwrite custom endpoints or reinterpret an old opt-in
as consent to derived/richer schemas, training, public publication or a different destination.
No old narrative retry bypass survives behind a renamed command. Local loss/review duties remain
available with the front off. A failed update leaves an attributable old version and held new
export, not a mixed-schema optimistic receipt.

Basis: Rules 30/44/49/69/111/113/115; big picture §9; sovereignty and trust; OD-02.
