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
| Organizational intent / session context / response review | `src/core/OrgIntentManager.ts` parses `.instar/ORG-INTENT.md` into constraints, goals, values and an ordered tradeoff hierarchy (bullets or a chained order). Its formatter feeds `GET /intent/org/session-context` and the session-start hook. `src/core/CoherenceGate.ts:1377–1395` supplies those buckets and legacy flat `orgValues` to reviewers; `src/core/reviewers/value-alignment.ts` asks for constraint blocks, goal warnings/blocks and value-drift warnings | Retain raw policy, parsed buckets/order and attributable review findings as evidence in Two's custody. Replace file-to-session injection with S/Part 21 permitted current-policy context captured by J/Seven; replace structured and flat-blob response-review consumers with Seven review under the current One floor and Eight's exact-effect checks. One owns verified authority; the operator or a currently verified scoped delegate owns deployment policy, registered through Three. A local file is not that authority |
| Organizational tradeoff resolution | `src/core/TradeoffResolver.ts:89–210` consumes two values and the parsed hierarchy through `POST /intent/tradeoff-resolve` (`src/server/routes.ts`). Pair-pattern matches precede substring/list-order matches; a sole matched value wins, while neither match or an undeciding same-entry match returns no-match or tie. Callers receive the winner, basis, indices and explanation | Retain source order, requested pair and any recorded resolution as evidence. Retire the text-matching resolver as a policy authority; replace its callers with Seven's recorded choice using current One-verified, Three-registered policy and S's permitted inputs. Unknown, tied or conflicting priorities stay unresolved under the declared floor/default and go to O for the policy owner's review; no substring result establishes pillar placement or a universal competing-harm priority |
| Organizational proposed-action tester | `src/core/IntentTestHarness.ts` consumes a proposed action and parsed constraints/goals/values; `POST /intent/org/test-action` in `src/server/routes.ts` returns separate refusal and endorsement findings. With `monitoring.orgIntentLlmJudge.enabled` and a provider, a refusal keyword miss invokes one bounded `judgeRefusal` semantic call; a failed/malformed call retains the heuristic and `judgeUnavailable: true`. Endorsement remains a separate keyword result. The `canGovern()` status used by `instar intent validate` only reports whether constraints exist | Retain available action/policy evidence, both findings, reasons, method, uncertainty and judge configuration in D/Two. Replace the proposed-action caller and optional judge through J/Seven's recorded advisory judgment using S's permitted inputs and current One-verified, Three-registered policy; O owns its permitted public/HTTP and CLI presentation. Retire the harness/route and legacy `canGovern` presentation only after NF-21i/21f replacement acceptance. Neither a keyword miss, semantic judgment, endorsement nor `canGovern` proves permission or a live holder; Eight still owns exact-effect checks |
| Organizational drift review | `src/core/OrgIntentDriftAnalyzer.ts` consume parsed org intent plus timestamped CoherenceGate review verdicts and violations. `GET /intent/org/drift` reads the bounded review-history window; block/hold rates, chronological half-window comparison and first-20-character bucket matches produce advisory findings. The opt-in weekly org-intent drift audit consumes the digest; absent intent and insufficient data have explicit states | Retain policy version, available review history, window/limits, thresholds, findings and pending follow-up as evidence through Two. Replace the digest consumer with Nine's review/correction work, Twenty's bounded measurement and O's permitted views; replace any enabled weekly job with W's registered cadence, preserving disabled state. Nine admits any subsequent Grade only with owner-verified standing; One remains the policy-authority owner. A heuristic drift count neither verifies harm/wisdom nor changes policy |
| ExternalOperationGate and adaptive trust | Mutability/reversibility matrix, scoped floors and model narrowing; success evidence and trust suggestions | Reads can disclose a private query; a reversible write can change what someone knows; no success streak grants new source permission |
| AdaptiveTrust incident response / TrustRecovery | `src/core/AdaptiveTrust.ts:225–248` records an incident and last-incident time, resets the success streak, forwards the incident to recovery and tightens the operation trust level only when the configured drop is more restrictive. `src/core/TrustRecovery.ts:87–185` tracks prior/dropped levels, reason, successes and offered/recovered/dismissed state | Preserve incident history, currently tightened restrictions and pending recovery separately from success/elevation evidence. Recovery suggestions are not grants or verified wisdom; never restore a more permissive level merely by importing a record |
| MandateGate / signed mandates | Current author, caller, expiry, revocation and named parameter bounds | Preserve real authorization; broad parameter bounds are not exact content, recipient and linked-target approval |
| CorrectionAnalyzer / CorrectionLoopDriver / PreferencesManager | Durable correction/preference signals, recurrence and routing to review/proposals | Preserve each correction and local adaptation; recurrence is not independence, and maximum-only confidence is not causal downgrade |
| Outbound self-violation correction signal | `src/monitoring/SelfViolationDetector.ts:80–114` matches stored preference patterns against a bounded outbound-text prefix; `src/server/routes.ts:3554–3597` records a scrubbed correction when both correction-learning flags and the ledger are enabled. Detector errors do not block delivery. `src/core/PreferencesReplicatedStore.ts:36–40` excludes `violationPattern` from replicated envelopes | Preserve the enabled correction trigger, pattern and signal-only behavior in local custody, and retain recorded corrections. Disabled/missing/malformed patterns remain non-blocking. A pattern hit is advisory correction evidence, not verified harm, wisdom or authority |
| DecisionJournal | Attributable decision/evidence and required principle at validated submission | Migrate references into Seven; a nonempty principle is not pillar entailment or independently falsifiable reason grading |
| Decision-journal drift/alignment consumers | `src/core/IntentDriftDetector.ts` reads journal history to compare current/previous windows and compute weighted alignment from one measurable-confidence cohort. `GET /intent/drift` consumes the window analysis; `GET /intent/alignment` consumes the score, assessability, population, exclusions and coverage. `src/commands/intent.ts` uses both in `instar intent drift`; `intent reflect` reads decisions and journal statistics | D/Two retains available source entries/references and analysis evidence; J/Seven owns migrated decision records. M/Part 20 owns replacement bounded journal analysis and population accounting, with O's permitted public/HTTP and CLI views replacing these consumers after NF-21h/21f acceptance. Preserve unassessed periods and confidence exclusions. The legacy weighted alignment score and letter label remain explicitly a heuristic, never a wisdom Grade; V/Nine alone owns independently supported Grades |
| DecisionQualityRecorder / FeatureMetricsLedger / grading pass | Registered evidence rungs, right/wrong/unknown, deterministic mature-window grading | Preserve evidence and unknowns; component identity is not human standing and winner ordering is not late-evidence re-derivation |
| BenchmarkDivergenceAnalyzer | Compatibility/coverage-aware advisory difference and insufficient-evidence states | Preserve bounded drift findings; agreement with a biased grader cannot certify wisdom |

**Rule — migration preserves evidence and does not upgrade its meaning.**
**Checks: P23-NF-18/21.** Migrate the named mechanisms through an inventory of
source identity, custody, pending work, producer/consumer, expected target,
loss detector and evidence limitations. Retain original decisions, corrections,
legacy grade labels, organizational policy text/order and review/drift history,
contrary cases and outstanding follow-up. Assign missing
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
| P23-NF-21g organizational priority and drift | Positive: import synthetic policy with a nondisclosure constraint, a timely-help goal, trust/speed values and “trust > speed,” plus attributable review history and a drift finding. Separately supply a current One-verified operator/delegate policy decision, scope and Three registration for that same order. S/Part 21 session context and Seven response review receive the permitted current policy; Seven records the supported in-scope priority choice, and Eight preserves the nondisclosure floor. Nine retains the drift finding as advisory evidence and its pending review; O exposes permitted status and an enabled W cadence actually runs. Unknown neighbor: absent/template-only policy, no-match, a sole substring match or unverified/revoked authority retains evidence but grants no priority. Tie neighbor: “trust and speed” in one entry with no owner-resolved ordering leaves the choice unresolved under the declared default. Conflicting-policy neighbor: opposite source orders or a legacy order contradicting current policy retains both variants and the conflict; only independently resolved current policy may govern, never first-match, last-import or majority. A constraint cannot be overridden by a priority winner. Missing history/insufficient data remains unknown; repeated heuristic drift, a matching local file or stable digest never becomes verified wisdom. Run all neighbors across update, restart and duplicate import; preserve one pending review, original text/findings and cadence enablement without reinstating retired consumers |
| P23-NF-21h decision-journal analysis consumers | Exercise M's replacement analysis through O's public/HTTP and CLI surfaces: empty population; nonempty but wholly unmeasurable population (missing/invalid confidence); partially measurable population; fully measurable population, including a poor assessed result. Preserve source references, window bounds, current/previous counts, missing comparison, confidence sample sizes and unmeasurable signals. Assert total population = measured cohort + excluded entries, exclusion reasons sum to exclusions, coverage matches that cohort, and every alignment component uses the same cohort. Empty/unmeasurable or non-finite-component results display “N/A, not assessed” with the reason; placeholder zero is neither a measurement nor a failing grade. Partially measurable output exposes its exclusions instead of claiming whole-population support. Measurable scores retain the legacy heuristic label and component basis; no result becomes a wisdom Grade. Run every population through fresh initialization, existing-agent update, restart and duplicate import; reconcile entries, analysis evidence and consumer output before retiring `IntentDriftDetector`, `/intent/drift`, `/intent/alignment` and the journal-analysis paths of `intent drift`/`intent reflect` |
| P23-NF-21i proposed-action policy testing | Through Seven's replacement advisory judgment and O's public/HTTP and CLI views, test a permitted goal-aligned proposal and a forbidden keyword match against separately verified current policy; retain separate refusal/endorsement findings, matched policy and reasons. Test a semantic violation missed by keywords: “present estimates as confirmed numbers” against “never present unverified work as completed”; enabled bounded semantic review records its actual method and uncertainty while preserving the separate keyword endorsement, including disagreement. Disabled review makes no semantic call. Requested but unavailable review (absent provider, timeout/error) or malformed review retains available heuristic findings with explicit unavailable/unknown semantic status, never a fabricated parsed judgment. Missing policy stays missing. A heuristic miss, endorsement or `canGovern` constraint-presence flag never becomes verified permission or a live-holder claim; even semantic non-refusal remains advisory and cannot authorize dispatch. Run these cases through fresh initialization, update, restart and duplicate import; preserve enabled/disabled state, timeout bound, original findings and unknown historical method/availability, and verify the retired harness/route cannot remain an alternate authority path |

Before legacy retirement, D/S retain pattern custody and configuration; J/E compose
the advisory outbound observation; V/Nine receives its correction; O exposes
permitted incident/recovery status. Current restrictions remain with One/Eight’s
authority/effect consumers, while Two retains incident/recovery evidence. The
21a/21b inventory and restart reconciliation must prove all those fields and
consumers survive; an unmapped field or unavailable owner keeps migration pending.
No import, success count or pending recovery recommendation creates permission.

For 21g, D/Two retain the source policy and available review-history records with
source identity, custody and import cursors; missing historical versions remain
unknown rather than being inferred from today's file. Current policy authority
is resolved by One for the operator or its verified scoped delegate and registered
through Three; source/provider restrictions remain with S and exact-effect
permission with Eight. Retire the session-start file injection, structured/flat
response-review policy reads, text-matching tradeoff caller and legacy drift
endpoint/job only after their named replacement consumers and loss detectors pass
21g/21f. Reconcile policy versions, review counts/window truncation, pending drift
review and scheduled work before retirement; missing mappings keep migration
pending. Neither importing policy nor a drift finding changes the purpose or
settles section 13's pending competing-harm policy.

For 21h, D/Two retains available journal source evidence and prior analysis with
its source identity and period; J/Seven retains decision links. M/Part 20 replaces
the detector's analysis, and O replaces the drift/alignment HTTP and intent CLI
consumers, including reflection's journal read. Preserve total population,
common measured cohort, missing/invalid-confidence exclusions, coverage,
assessability and summary, alongside drift windows, principle counts and signals.
Missing historical inputs remain unknown. The legacy alignment calculation
weights conflict freedom 30%, reported confidence 25%, principle consistency 25%
and logging regularity 20%; preserve that basis wherever its heuristic score or
letter label is displayed. Never translate it into Nine's wisdom Grade. A
zero placeholder or absent previous window cannot establish failure or stability.
Retire each named consumer only after 21h/21f reconciles its source/target
population and output through the update path; missing mappings keep it pending.

For 21i, D/Two retains available proposed action, policy version, separate refusal
and endorsement evidence, method and uncertainty; J/Seven owns the replacement
advisory review and its bounded optional semantic judgment through the existing
judgment doorway. S resolves permitted inputs; One verifies the current policy
owner and Three registers its policy; Eight retains dispatch permission. O
exposes both findings and review availability without presenting a constraint
count as authority. Preserve `monitoring.orgIntentLlmJudge.enabled` and its
timeout setting (the legacy default is 8000 ms); disabled stays disabled. The
legacy disabled/no-provider path may lack method or availability fields: retain
that absence as unknown historical evidence, not proof of a completed review.
Reconcile caller inventory, available findings and configuration before retiring
`IntentTestHarness`, `judgeRefusal`, `/intent/org/test-action` and the CLI's
`canGovern` presentation after 21i/21f acceptance. Missing owners or evidence
mappings keep migration pending; testing a proposal never applies it.

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
