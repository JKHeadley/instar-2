## 9. What Instar 1.x does today and what carries forward

**Value — source-grounded baseline, not a deployment claim.** The following
inventory carries R1's source findings and limits. Its inspected 1.x tree and
file hashes are identified there. Additional source paths below are relative to
`/Users/dabombstudio/.instar/agents/echo`, the 1.x tree, not this worktree. Configuration observations do not prove a live
consumer or measured wisdom. No private 1.x or Dawn traffic is copied here.

Basis: Purpose's evidence constraint; [R1](research/01-instar-1x-judgment.md),
[R2](research/02-sensitivity-and-disclosure-models.md).

| 1.x mechanism | What exists in the audit | What carries forward / limit |
|---|---|---|
| MessagingToneGate | Contextual send/rework/hold review with per-rule advisory/blocking and availability behavior | Preserve attributable candidate/context and declared defaults; it is not a per-fact permission or outcome system |
| ConvergenceChecker sycophancy signal | Regex signals for emphatic agreement, praise and apologies | Keep as advisory evidence; a deserved apology can trigger it and a quiet false agreement can evade it |
| ScopeVerifier coherence routes | Checks working directory, project/remote, topic and scope; produces reflection | Preserve scope checks; correct project does not establish a harmless information flow, and the check alone does not persist outcome learning |
| CoherenceGate response-review pipeline | Policy-first candidate review, recipient handling and bounded telemetry | Preserve owner floor and contextual findings; primary-user shortcut does not authorize third-party secrets; provider filtering must happen earlier |
| ExternalOperationGate and adaptive trust | Mutability/reversibility matrix, scoped floors and model narrowing; success evidence and trust suggestions | Reads can disclose a private query; a reversible write can change what someone knows; no success streak grants new source permission |
| AdaptiveTrust incident response / TrustRecovery | `src/core/AdaptiveTrust.ts:225–248` records an incident and last-incident time, resets the success streak, forwards the incident to recovery and tightens the operation trust level only when the configured drop is more restrictive. `src/core/TrustRecovery.ts:87–185` tracks prior/dropped levels, reason, successes and offered/recovered/dismissed state | Preserve incident history, currently tightened restrictions and pending recovery separately from success/elevation evidence. Recovery suggestions are not grants or verified wisdom; never restore a more permissive level merely by importing a record |
| MandateGate / signed mandates | Current author, caller, expiry, revocation and named parameter bounds | Preserve real authorization; broad parameter bounds are not exact content, recipient and linked-target approval |
| CorrectionAnalyzer / CorrectionLoopDriver / PreferencesManager | Durable correction/preference signals, recurrence and routing to review/proposals | Preserve each correction and local adaptation; recurrence is not independence, and maximum-only confidence is not causal downgrade |
| Outbound self-violation correction signal | `src/monitoring/SelfViolationDetector.ts:80–114` matches stored preference patterns against a bounded outbound-text prefix; `src/server/routes.ts:3554–3597` records a scrubbed correction when both correction-learning flags and the ledger are enabled. Detector errors do not block delivery. `src/core/PreferencesReplicatedStore.ts:36–40` excludes `violationPattern` from replicated envelopes | Preserve the enabled correction trigger, pattern and signal-only behavior in local custody, and retain recorded corrections. Disabled/missing/malformed patterns remain non-blocking. A pattern hit is advisory correction evidence, not verified harm, wisdom or authority |
| DecisionJournal | Attributable decision/evidence and required principle at validated submission | Migrate references into Seven; a nonempty principle is not pillar entailment or independently falsifiable reason grading |
| DecisionQualityRecorder / FeatureMetricsLedger / grading pass | Registered evidence rungs, right/wrong/unknown, deterministic mature-window grading | Preserve evidence and unknowns; component identity is not human standing and winner ordering is not late-evidence re-derivation |
| BenchmarkDivergenceAnalyzer | Compatibility/coverage-aware advisory difference and insufficient-evidence states | Preserve bounded drift findings; agreement with a biased grader cannot certify wisdom |

**Rule — migration preserves evidence and does not upgrade its meaning.**
**Checks: P23-NF-18/21.** Migrate the named mechanisms through an inventory of
source identity, custody, pending work, producer/consumer, expected target,
loss detector and evidence limitations. Retain original decisions, corrections,
legacy grade labels, contrary cases and outstanding follow-up. Assign missing
sensitivity/standing/reason fields explicit unknowns; never fabricate old model
inputs, independent standing or mature outcomes. Same logical entry imports once
across restart and machines; incompatible causal variants remain disputed.

Basis: Purpose's coherency and no-silent-loss constraint; rules 7/24/33/44/85/108/113.

| Migration acceptance subcase | Required positive and refused neighbor |
|---|---|
| P23-NF-21a tone/coherence/operations | Attributable findings and current floor survive. Import incident history, last-incident time, reset streak and current tightened per-service/operation restriction with TrustRecovery’s prior/dropped levels, reason, success count and offered/recovered/dismissed state; pending recovery remains pending across restart. A new incident resets the streak and can tighten but never loosen restrictions; a more restrictive existing level stays intact. Import/recovery suggestion, regex or primary-user shortcut cannot become a grant |
| P23-NF-21b corrections/preferences | Direct correction opens retained review before recurrence threshold; duplicate delivery/restart retains one obligation; late refutation lowers support. An enabled outbound preference contradiction records its correction without blocking the message; disabled/no-match/malformed-pattern/error controls remain non-blocking. Preserve local-only detection patterns and enabled configuration through update/restart, exclude patterns from replication/export, and preserve correction identity/lineage without promoting a hit to verified wisdom |
| P23-NF-21c decision journal | Original entry, evidence and stated principle remain; absent actual inputs and unsupported pillar argument stay unknown |
| P23-NF-21d quality meter | Legacy rungs remain labelled; conclusion/reason/outcome separate; missing human standing cannot become a verified Grade |
| P23-NF-21e divergence | Compatible complete sources can compare; biased/self-reported or mismatched sources cannot become independent support |
| P23-NF-21f installed composition | Fresh and existing agents get registered producers, consumers, cadence, capabilities and status; disabled/dry-run/no-op ports cannot pass lifecycle |

Before legacy retirement, D/S retain pattern custody and configuration; J/E compose
the advisory outbound observation; V/Nine receives its correction; O exposes
permitted incident/recovery status. Current restrictions remain with One/Eight’s
authority/effect consumers, while Two retains incident/recovery evidence. The
21a/21b inventory and restart reconciliation must prove all those fields and
consumers survive; an unmapped field or unavailable owner keeps migration pending.
No import, success count or pending recovery recommendation creates permission.

Each subcase uses unit, real public/HTTP integration and actual production
initialization evidence plus restart and current-authority refusal. The scheduled
correction backstop must actually admit and execute successive due occurrences;
manual calls or a plan alone cannot prove recurring behavior. Row 97's correction
review retains both standards and process questions with independent follow-up,
linked-action recovery and no erasure on exhaustion. Its conditional grant is
not the Part 23 specialization grant.

Basis: Rules 34/44/65/69/85/95/113; section 12 V/W dependencies; Part 21 key Z,
`seam-response-recall-doorway-grants.md` row 97 and calendar row 84.

**Rule — additive migration and rollback retain pending duties.**
**Checks: P23-NF-18/21/22.** Backfill with source cursors and causal identity;
reconcile inventory coverage and unresolved link counts before retiring a legacy
producer. Switching consumers never loses unresolved grades, delayed outcomes,
correction work or export obligations. Rollback disables the new consumer while
preserving canonical evidence and required work. Existing-agent update paths and
agent awareness/capability templates must receive the same consumers and honest
inactive/unmeasured states as fresh initialization. No capability is advertised
as working on the strength of this design.

Basis: Purpose's no-silent-loss and evidence constraints; rules 7/44/49/69/113.
