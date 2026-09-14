# R1 — Instar 1.x feedback factory

**Status: research for design review. Governed. No fleet activation or policy approval.**

## Evidence boundary

**Rule — distinguish source behavior, recorded incidents and current observation.**
**Check:** the citations below resolve against the pinned trees; a historical spec is not
reported as a fresh production test. `1x:` means the agent-home Instar repository at
`5b36623a99327e74abe5ef04d63019f9aca6b1c5`; `2x:` means this repository at
`808ca2424d9c6ec5e0920142b62ebd3f4738e5b9`.
Paths and line numbers following those prefixes belong to that tree, not interchangeably to
this worktree. The installed `.claude/skills/feedback/SKILL.md` is a separately identified
local artifact read on 2026-09-13; it is not claimed to be committed at the 1.x pin.
Live observations below are read-only local API observations, not an audit of the remote front.

**Value — the reusable asset is a governed processing pipeline.** The open/operated split
already separates reusable receiver/processor code from a maintainer-operated instance and its
private curated state (`1x:docs/specs/feedback-factory-migration.md:157–162`). The commons can
inherit this posture. The current report format and evidence semantics cannot simply be renamed
fleet learning: they do not supply stage evidence, canonical learning cases or comparable grades.

## From a report to a receipt

**Rule — describe the actual submitting contract.** **Check:**
`1x:src/server/routes.ts:20925–21018` and `1x:src/core/FeedbackManager.ts:102–122,165–227`.
The authenticated local route accepts title, description, optional context and type. Its accepted
types are `bug`, `feature`, `improvement`, `question`, `hallucination`, and `other`; invalid types
become `other`. It enforces 500/10,000/5,000 character ceilings, semantic-content minimums and
recent-title duplicate rejection. The route derives agent name and environment from local
configuration/runtime, rather than trusting a submitted author field. The local receipt is an
id plus `forwarded:boolean`, with local persistence even when upstream forwarding fails normally.

**Rule — do not equate the skill's narrative with the wire schema.** **Check:** compare
`1x:skills/instar-feedback/SKILL.md:49–89,161–231` with the route above and
`1x:src/core/FeedbackManager.ts:168–194`. The shipped skill teaches natural-language bug,
feature and innovation reports, local API submission and retries. It describes `status` and
`forwardedAt`, while the manager records `forwarded` and `submittedAt`; the GET route wraps rows
in `{feedback:[...]}`. The installed `/feedback` skill asks for original user words and error
output (`.claude/skills/feedback/SKILL.md:52–74`). Its curl examples omit authentication.
These are documentation mismatches and privacy-relevant collection instructions, not evidence
that a caller has permission to export private words.

**Rule — name the upstream destination and replacement behavior precisely.** **Check:**
`1x:src/core/canonicalFeedback.ts:26–31`, `1x:src/core/Config.ts:1185`, and
`1x:src/core/PostUpdateMigrator.ts:11210–11216`. The canonical address is
`https://feedback.dawn-tunnel.dev/api/feedback`. The migrator changes known legacy canonical
URLs while preserving custom webhook URLs. Thus self-hosting has a configurable sender address
and reusable code, but still needs a deployed receiver, storage, credentials and an operated
consumer. An address flip alone does not provision a working factory. The sender requires HTTPS
and rejects a list of internal hosts (`FeedbackManager.ts:79–96`); this is not a complete
DNS-resolution or redirect-aware private-network defense.

**Rule — distinguish persistence order from intended durability.** **Check:**
`1x:src/core/FeedbackManager.ts:176–225,322–352`. The initial network attempt happens before
local append, with a ten-second timeout. Local writes use a temporary file and rename. This
reduces torn-file exposure, but is not a transaction spanning the network and local storage.
A process death before append can lose the local receipt; concurrent read-modify-write callers
can still overwrite each other's snapshots. Parse failure returns an empty list, and retention
keeps the last 1,000 items without protecting unsent rows. These are code-derived loss risks,
not observed failures in this research. A durable local outbox before transmission would be a
2.0 requirement candidate under purpose constraint 2, rather than a property to credit to 1.x.

## Identity, consent and the receiving front

**Rule — pseudonymity is not delivered anonymity or authenticated standing.** **Check:**
`1x:src/core/FeedbackManager.ts:25–26,59–76,125–159,182–194,269–280` and
`1x:src/feedback-factory/receiver/handlers.ts:100–107,145–157`.
The pseudonym is `agent-` plus twelve hex digits of SHA-256 over agent name plus a shared
secret, or a fixed default salt. Initial submission includes BOTH agent name and pseudonym;
retry includes the name and omits the pseudonym. The receiver persists agent name and source IP,
and does not copy the pseudonym into its explicit stored-row construction. A stable hash over
an enumerable name with a known salt also permits guessing. Therefore the presence of a
pseudonym is not an anonymization claim.

The sender optionally signs a timestamp and serialized body using HMAC-SHA256. In persistence
mode the receiver records signature verification but accepts unsigned/invalidly signed reports
as unverified. A recognizable User-Agent and a shared key are not per-principal authentication,
let alone proof that an author is an operator or has standing over a decision. The migration
spec explicitly defers per-operator keys (`1x:docs/specs/feedback-factory-migration.md:241–242`).

**Rule — separate the two different rate controls.** **Check:**
`1x:src/monitoring/FeedbackAnomalyDetector.ts:36–40,53–109`;
`1x:src/server/routes.ts:20956–20983`;
`1x:src/feedback-factory/receiver/handlers.ts:74–107`;
`1x:feedback-front/src/feedback.ts:38–42`.
The local detector tracks each pseudonym in memory, defaults to 20/hour, 50/day and five seconds
between submissions, and records accepted submissions. Its state resets at restart. The front
has a different per-IP limiter, fingerprint check, honeypot, non-blocking signature check,
validation and idempotency lookup. Its limiter is scoped to each warm function instance.
Neither mechanism proves unique fleet membership or prevents coordinated identities from
manufacturing apparent consensus.

**Rule — a 2xx result is weaker than durable custody.** **Check:**
`1x:feedback-front/src/feedback.ts:54–110`,
`1x:src/feedback-factory/receiver/handlers.ts:94–98,140–159`, and
`1x:src/core/feedbackBackoff.ts:65–73`.
With a Blob token, the front awaits persistence before normal acknowledgment. Without that
token its signed probe mode returns 200 while explicitly performing no persistence. Honeypot
paths also return 200 without storing. The sender interprets any `response.ok` as forwarded,
without checking a durable receipt's meaning. These code paths demonstrate why the commons
needs separately evidenced received, stored, admitted, reviewed and promoted states; this
research does not send a probe into production to test them.

**Rule — the existing collection is content-bearing.** **Check:**
`1x:src/feedback-factory/receiver/handlers.ts:145–157` and
`1x:src/feedback-factory/inbox/BlobInboxClient.ts:22–27,116–120`.
The front retains bounded title, description, context, agent name, versions, OS, source IP and
verification flag. It has no content-free derived-case allowlist, contributor consent receipt,
per-field privacy budget or stage-by-stage incident evidence contract in this path. Blob content
is fetched without authentication from random-suffixed URLs; the client describes these as
public but unguessable. Randomness reduces enumeration; it does not protect a leaked URL.
A hostile front can read the report text, correlate IP/name/version/timing and retain copies.
No sensitive body or example taken from actual users is reproduced in this research.

## Inbox, store, clustering and owned work

**Rule — credit the inbox's recovery ordering, within its scope.** **Check:**
`1x:src/feedback-factory/receiver/BlobInboxStore.ts:32–39` and
`1x:src/feedback-factory/inbox/InboxDrainer.ts:113–183,204–216`.
The cloud inbox removes the operated machine from the intake critical path. Its prefix lookup
provides first-pass deduplication. The drainer reads a blob, checks its minimal shape, commits
an unseen feedback id to the canonical store, then deletes the blob. Failure leaves the blob
for retry; redelivery after append is deduplicated by the canonical store. Malformed objects
are copied to quarantine before inbox deletion. The minimal validator checks id/title/description,
not a closed learning-case schema or evidence authorization. Re-listing the first page avoids
skipping records when deletes shift pagination; the pass stops on no progress and has a batch cap.
These are source-backed recovery mechanisms, not proof against every storage failure.

**Rule — clustering preserves several distinct kinds of judgment.** **Check:**
`1x:src/feedback-factory/processor/fingerprint.ts:68–73`,
`1x:src/feedback-factory/processor/cluster.ts:23–25,58–119`,
`1x:src/feedback-factory/processor/transitions.ts:28–54,74–110`, and
`1x:docs/specs/feedback-factory-migration.md:114–145,195–205`.
The normalizer collapses versions/hashes/integers for fingerprints; similarity clustering uses
title plus description and raises the match threshold for fixed/resolved clusters (0.35 to
0.55). Matching fixed clusters can signal regression; the processor also has reopen/cycling and
lifecycle partition logic. Terminal transitions require evidence for named statuses; dispatch
transitions require a dispatch reference. The migration spec treats curated notes, recurrence
and lifecycle decisions as irreplaceable history, not a projection to regenerate from raw text.
It requires recorded-corpus parity and distinct live order-independent invariant checks because
stateful grouping is order-dependent. Those are specified migration gates, not newly executed
parity results here.

**Rule — classification, readiness, handoff and product success are separate.** **Check:**
`1x:src/feedback-factory/processing/FeedbackProcessingService.ts:88–104` and
`1x:docs/specs/feedback-factory-operating-drain.md:100–125,145–186`.
Processing ingested rows and forming clusters does not establish that anyone owns corrective
work. The operating-drain design adds a registered, bounded readiness authority, separate
`collecting/ready/queued/held` state, a fenced SQLite outbox and a consumer that creates and reads
back an exact-key Initiative task. Completion proves that handoff only. Product fixed/resolved
remains another authority's evidence-backed claim. The default readiness reviewer is an
operator-registered frontier-model agent, with human escalation; this does not repeal the
migration spec's human approval gate for factory evolution proposals
(`feedback-factory-migration.md:226–228`).

**Rule — the return path cannot be credited from intake success.** **Check:**
`1x:docs/specs/feedback-factory-migration.md:109–112,226–232` and
`1x:docs/specs/feedback-factory-operating-drain.md:57–63,174–186`.
Dispatch create/list and update delivery are the existing return mechanisms. The drain's first
terminal artifact is owned development work, not automatically published fleet guidance or a
verified fix. End-to-end success would need evidence that the artifact was implemented, tested,
released, installed and improved an outcome. No such full-cycle observation was obtained here.

## Operational evidence and limits

**Rule — retain the negative operating evidence as well as mechanisms that helped.**
**Check:** the following ledger distinguishes documented incidents, fresh local observation
and static inference.

| Evidence class | Finding and source | What it establishes |
|---|---|---|
| Recorded incident | `1x:src/core/feedbackBackoff.ts:4–12`: 661 unsent reports repeatedly POSTed into rate limiting; 2,384 429s recorded in the source account | An accepted report loop can amplify failure rather than learn; not a fresh count |
| Source-backed repair | `feedbackBackoff.ts:60–114`, `FeedbackManager.ts:248–315`: stop the batch on 429/503, exponential 60-second to one-hour backoff or capped numeric Retry-After | Concrete mitigation; date-form Retry-After is unsupported, restart loses the backoff, other errors still traverse the batch |
| Recorded integration failure | `1x:docs/specs/feedback-factory-operating-drain.md:31–46,343`: roughly 12k reports/149 clusters and zero owned work; another install dark | Collection and clustering alone did not close the loop in that incident |
| Source-backed repair | `FeedbackProcessingService.ts:88–97`: synchronize external appends before clustering | Avoids treating a boot-time store snapshot as the current inbox |
| Fresh local observation, 2026-09-13T23:39:22Z | Authenticated `GET /feedback-inbox/status`: 503, drainer disabled or missing Blob token | This machine cannot prove inbox ingestion; exact configuration cause not isolated |
| Same observation | `GET /feedback-factory/stats`: total 0, clusterCount 0, dispatchCount 0, lastWriteAt null | Empty local canonical view, not an empty worldwide inbox |
| Same observation | `GET /feedback-factory/drain/status`: `unavailable`, `enabled-missing-operated-host-owner`, restorePending true, consumerLive false, lastRun null | No operating local work drain; HTTP 200 alone is not readiness |
| Unknown | Remote inbox population, current canonical deploy contents, latest successful fleet fix and production effectiveness | Not inferred from source comments, localhost counts or the existence of specs |

**Value — carry forward recovery and ownership; replace privacy and evidence assumptions.**
The most useful foundations are one configurable canonical address, reusable front code,
cloud-before-drain custody, idempotent handoff, preserved curated history, bounded retry and
explicit readiness authority. The risks to design against are text export by convention,
name-bearing “pseudonyms,” weak receipt semantics, silent local loss and an impressive collection
without verified improvement. R2 derives an evidence contract; R3 examines external mechanisms.
No policy, fleet consent or implementation is adopted by this research.
