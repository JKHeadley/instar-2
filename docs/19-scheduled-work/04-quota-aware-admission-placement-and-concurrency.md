## 4. Quota-aware admission, placement, and concurrency

**Rule — capacity is observed at the admission that spends it.** Rules 13, 26, 39, 40, 60, 63,
75 and 95; **checks: P15-NF-29/30/31**. Each model, session, process, provider and notification
step requests a part-six AdmissionReservation against its ancestor RunBudget. Before that
reservation can dispatch, Part Six's granted `TransportAuthority.reserveResourceSet` must commit
the one `ResourceAllocationSet` covering every applicable resource domain, and
`attachResourceSet` must attach it to the ordinary reservation. The decision cites fresh capacity
Evidence and Measurement for the actual account, framework, assembly, machine and window. A quota
percentage without source, subject, observed time, reset window, freshness bar, or account binding
is unknown. Configured ceilings and expected durations are policies, not measured use. Script or
local steps may bypass model-quota demand only when their own CPU, memory, process, effect and
concurrency demands are still admitted. P15-NF-30 is non-executable until the dated 06:25Z
`seam-response-loop-followup.md` addendum, GRANTED at `SEAM-LEDGER.md` row 36 but unlanded, lands
and passes its Part Six acceptance evidence.

**Rule — the quota brake and placement share one eligibility decision.** Rules 1, 26, 40 and 63;
**checks: P15-NF-30/32/33**. The admission candidate set is the same set the placement adapter
can actually launch on. A brake cannot approve an account that placement rejects, and placement
cannot select an account the brake did not assess. A hard machine preference narrows candidates;
it never bypasses a quota wall, stale evidence, missing capability, standing, isolation or spend
bound. When no eligible candidate remains, the Run records a capacity Result and follows its
approved re-observation policy. The Result may truthfully say the scheduler shed this admission
opportunity, but the Run remains waiting and owned. It does not launch on the least bad machine
merely to appear active.

**Rule — unknown capacity never becomes phantom headroom.** Rules 26, 40, 42, 60 and 95;
**checks: P15-NF-29/31/34**. A model-spending step with missing, stale, corrupt, incomplete, out-of-
range, or framework-inapplicable quota evidence cannot treat the absent value as zero use. Its
capacity-evidence policy declares the affected consumer's direction. The recommended ordinary-job
default inhibits low-priority execution and refuses any account whose known short-window wall
predicts immediate failure. Critical work may use only separately reserved, currently evidenced capacity. A framework
with no provider usage surface stays labelled unobservable and uses its approved finite exposure
cap plus call-time settlement; it is never reported as healthy.

**Rule — rerouting is a new admission decision, not inherited permission.** Rules 28, 32, 56,
57, 63, 75 and 113; **checks: P15-NF-32/35/36**. A reroute preserves the Run, step identity,
floor and remaining budget. Moving an observer or recovery worker preserves the immutable original
attempt, operation identity, input digest and reservation; it can only query that attempt. Changing
provider while retaining the original immutable input digest may propose a fresh part-seven attempt
under the same logical RunStep. The ordered path is:

1. Part nine independently accepts non-occurrence, delayed-execution exclusion and final charge for
   the predecessor.
2. Part eight consumes that current assessment into retry eligibility and settlement.
3. Part six conditionally admits the unchanged request identity, semantic-message identity and
   original `JudgmentRequest` input digest with a new linked reservation and one-use claim.
4. Part seven's granted
   `JudgmentDoorway.judgeFresh(input: FreshJudgmentAttemptInput, fence)` records the next ordinal
   `JudgmentAttemptRecord` whose attempt, input digest and reservation match Six's admission.

Changed input is not a fresh attempt on this path and must refuse before provider dispatch. Work
with changed input is a separately governed proposal. It must name the prior RunStep and settled
attempt as predecessors, receive its own intake and authority disposition, and use an owner-granted
new-work path; this document grants no such shortcut. Changing any logical identity to escape
predecessor checks is likewise refused. A **billing lane** is the recorded
provider account, price policy, quota window and charge-settlement source for one attempt; it is
evidence about the actual route, not authority to use it.

Every destination re-resolves standing, framework compatibility, Part Seven's current runtime
route, capability package, fresh quota, account identity, lease, isolation and capture policy. It
records the actual machine, framework, model, account reference, billing lane and reason. A configured pin or requested model
is never reported as the route that ran. If no compatible destination passes, the Run waits with a
capacity Result. It does not mint another operation merely to appear active. The fresh-invocation
path in P15-NF-23/35 is non-executable until the GRANTED `seam-response-effects-followup.md` and
`seam-response-loop-followup.md`, plus `seam-response-judgment.md`, GRANTED at `SEAM-LEDGER.md`
row 32 but unlanded, land and pass their joint fixtures. The current runtime-route resolution used
here is separately GRANTED at ledger #27 in `seam-response-judgment.md` and remains non-executable
until that grant file lands with its resolver evidence. Ledger #30 is required in addition only
when the selected route is claimed measured or benchmark-supported. It is not the current-route
resolver.

**Rule — concurrency is reserved before launch and released by evidence.** Rules 25, 33, 60, 61
and 63; **checks: P15-NF-30/37/38**. A **job family** is the registered set of job instances that
share one manifest lineage, work entry point and resource policy. Every cap is a reference to a
Six-owned resource domain. Global maps to the registered fleet/global domain. Installation maps to
the installation domain. Framework maps to the installation-and-framework domain. Account maps to
the provider-account domain shared by all job families using that account. Job-family maps to the
manifest-lineage domain. Per-job maps to the stable job-instance domain. The ancestor cap maps to
the exact allocation carried by the owning RunBudget.

The granted Part Six `ResourceAllocationSet` reserves one demand against every applicable domain
before launch. These are independent ceilings, not transferable copies of one credit. Each debit is
prepared under one allocation identity. The set becomes dispatchable only after every debit is
committed by `TransportAuthority.reserveResourceSet` and attached to the ordinary reservation by
`attachResourceSet`. A partial set cannot launch. Recovery completes the same set or returns each
proved-unused debit once. Settlement returns unused capacity once through `closeResourceSet`.
Unknown execution or charge keeps all affected debits reserved. Numeric zero in any applicable
domain means no new admission. Two jobs in different families still compete when they share an
account domain.

A slot is reserved before worker creation and remains charged while execution or settlement is
unknown. Completion evidence, not process disappearance alone, releases it. Durable waiting Runs
are retained obligations, not an in-memory queue, and their historical count may grow.
A **runnable window** is the bounded projection selected for one admission pass: it contains at
most the manifest's item limit and encoded-byte limit, and the pass also has page, duration and
memory limits. Key enumeration, history decoding, hashing, replay and candidate-index update count
against those bounds. Selection consumes bounded candidate batches from the package index and
advances the granted durable Part Six `ScanCursor`. It never loads every waiting Run or replays full
history on every tick. Obligations beyond the window remain owned and selectable by later pages. Part Ten's
`GrowthObservation` records selected count and bytes, retained-backlog count or lower bound,
oldest due age, pages consumed and any overflow or incomplete count at the pinned frontier. Filling
the window ends only that selection pass with a capacity-applied Result. It never drops an
obligation or constructs a business `RunExit`. P15-NF-30/37 are non-executable until the dated
06:25Z `seam-response-loop-followup.md` addendum, GRANTED at `SEAM-LEDGER.md` row 36 but unlanded,
lands. P15-NF-37 is also non-executable until `seam-response-facts-followup.md` and the dated
06:27Z `seam-response-loop-followup.md` addendum, GRANTED at `SEAM-LEDGER.md` row 37 but unlanded,
land.

**Rule — priority chooses order, not truth or authority.** Rules 4, 40, 60 and 63;
**checks: P15-NF-33/37/39**. Priority may order eligible admissions and select an approved
inhibition band. It cannot widen scope, increase a budget, defeat a stop, skip supervision,
ignore uncertainty, steal an existing reservation, or certify stale evidence. The minimal plane,
emergency stop, diagnosis and bounded repair keep their reserved capacity. After those reserves,
the scheduler uses **weighted deficit round robin** across priority classes. In each round, every
active class receives its configured number of admission credits. An admitted reservation costs
one credit. An ineligible candidate costs no credit. The scheduler visits classes in registered
order. Unused credit carries only to the declared finite credit cap. Within a class, **FIFO** means
the earliest eligible scheduled instant or admission clock is considered first. Equal instants are
ordered by canonical occurrence id. Arrival order and Part Two's fold linearization never decide
the tie. **Bounded age
promotion** means an otherwise eligible item waiting at least the declared `promotionAfter`
duration is considered one priority class higher for the next round only. It can rise at most one
class per declared promotion interval and never above critical. Every active class has a finite
configured weight. The maintenance class has a nonzero minimum share. Promotion changes ordering
only and cannot cross a resource, standing, stop or uncertainty gate. The deployment policy states
the fair-round workload, maintenance share and maximum eligibility-to-admission duration for
higher-priority work. Missing values refuse
activation. This fixed mechanism prevents indefinite starvation while preserving explicit caps.

---
