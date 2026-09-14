# R1 — Instar 1.x: judgment mechanisms and their limits

**Status: research evidence, awaiting design review. Governed.**

**Value — research posture.** This is a source audit dated 2026-09-13, not a
production wisdom evaluation. SOURCE below means inspected implementation;
INFERENCE means a consequence argued from it; UNKNOWN means missing evidence.
The question is how knowledge should shape behavior, including the costs of
sharing, withholding, and actions that reveal knowledge indirectly.

## 1. Constitutional and source boundary

**Value — constitutional reading.** The purpose's wisdom Value sets complete
relevant recall as the baseline, with recorded use-or-withhold reasons and later
outcome grading above it. Rules 28/29 require verified principals; 57 permits
narrowing within floors; 58 requires decision provenance and outcome review;
85 preserves corrections; 86 separates signals from authority; 94 treats waivers
as evidence about rules; 95 assigns fail direction by consumer; 108 separates
falsification of conclusion and reason. Rules 24 and 65 prevent a temporary success
or an author's own review from becoming a convergence claim.

The worktree is `design-judgment-of-use`, based on
`808ca242` (abbreviated base supplied by the brief; local Git resolves `808ca24`).
`docs/00-the-purpose.md` and `docs/01-the-rules.md` were read in full. The requested
Part 21 files are absent from this base. The full required section 5 and section 15
were instead read from the sibling `.worktrees/part-twenty-one`, HEAD
`e0ddbd533126648cdb32c442936ab01a271bfc93`. They are dependency drafts, not landed
interfaces in this branch. Section 5 requires filtering before every boundary,
including provider context and metadata; section 15 decision 2 distinguishes
separately permitted private use from onward disclosure. The supplied consequential
effects amendment was read in full, including its user-facing addendum. It is
pending operator approval in the brief; nothing here adopts it as effective law.

**Value — reproducible source identity.** All `src/...:line` references below are
relative to the 1.x agent-home checkout
`/Users/dabombstudio/.instar/agents/echo`, HEAD
`5b36623a99327e74abe5ef04d63019f9aca6b1c5`, inspected on 2026-09-13. This is a working
source audit, not a claim about the installed build. Two cited files have local
changes: `src/core/MessagingToneGate.ts`, SHA-256
`4d5134c4d105cf528f53dcb8c55b677af975b9ec2e7017cc5a071a28982b24d7`, and
`src/monitoring/FeatureMetricsLedger.ts`, SHA-256
`f5b3d86911714620ab6656ab68298b847d74e824c4f5843b41022f224f6987fc`.
Their hashes identify the inspected bytes; they are not attributed to the commit.
No 1.x source, private records, or credentials are copied into this repository.

The authenticated local capability response reported installed version 1.3.1237,
decision quality and benchmark divergence configured with `dryRun:false`, and a
scheduled grading job. Its discovery surface reported response review disabled.
These are configuration observations, not executed path or outcome proofs.

## 2. Mechanism inventory

### 2.1 Tone gate and the actual sycophancy signal

**Value — SOURCE.** `src/core/MessagingToneGate.ts:529` classifies its enumerated
rules; `:586` gives per-rule blocking/advisory disposition; `:617` describes the
advisory migration and the deterministic credential guard at the route seam.
The stop-related exceptions begin at `:640`. `:1078` is the review entry and `:1652`
renders the model prompt. This is a send/revise/hold judgment about a candidate
message, artifact signals, conversation, recipient class and standing context,
not a per-fact sensitivity assessment. A bounded candidate context builder starts
at `:199`; body capture is opt-in (`:1004`). Overrides/compliance are evidence
at the self-report rung, not independent approval (`:636`). Availability behavior
is configurable and recipient-sensitive (`:1143`, `:1212`, `:1263`); a universal
description such as “always fails closed” would be false.

The explicit named sycophancy detector is separate:
`src/core/ConvergenceChecker.ts:73` uses a regular expression for emphatic agreement,
praise and apologies; `:109` returns category/detail signals.
`src/core/reviewers/conversational-tone.ts:51` instead prompts against technical
implementation details with narrow exceptions. Neither the current tone-gate enum
nor that reviewer contains a named semantic sycophancy test. Calling all three
“the tone gate” hides their different evidence and enforcement surfaces.

**Value — INFERENCE / learning limit.** Recorded disagreement can feed later
grading, but a regex does not learn and a prompt is not a measured outcome loop.
A deserved apology can trigger the sycophancy signal; a quiet reversal of a correct
position can evade it. Removing a forbidden phrase improves a style score without
improving honesty. Candidate hashes establish identity, not sufficient context for
later judging the costs to people.

### 2.2 Pre-action coherence gate

**Value — SOURCE.** The public `/coherence/check` and `/coherence/reflect` routes
delegate to `ScopeVerifier`, not the similarly named response-review class
(`src/server/routes.ts:7823`, `:7839`). `src/core/ScopeVerifier.ts:99` checks working
directory, remote, topic binding, target, path scope and identity. `:132` reduces
checks to proceed/warn/block; `:153` generates the reflection prompt. The returned
record contains expected/actual values, severities and time (`:27`). The check
method itself returns that record; it does not persist a judgment/outcome pair.
Topic bindings are mutable configuration (`:237`).

**Value — INFERENCE / learning limit.** This guards project confusion. It has no
learning loop in the inspected check path and does not judge whether a permitted
message harms someone, whether silence breaks a commitment, or whether the
proposed action implicitly reveals a fact. A valid project match is necessary
context, not evidence of wise behavior. The running server checks its configured
project directory, so a worktree must also be verified explicitly.

### 2.3 Outbound response-review pipeline

**Value — SOURCE.** `src/core/CoherenceGate.ts:380` serializes reviews per session.
Its pipeline applies the policy enforcement layer first, even in observe-only
mode (`:435`), resolves the recipient (`:468`), loads tool/value/canonical context,
and fans out reviewers. It records pass, warning, observe-only, retry, queue and
availability outcomes (`:772–923`). A high-stakes hold and exhausted ordinary
retry are distinct. The full result is richer than a Boolean.

The disclosure reviewer skips `primary-user` recipients
(`src/core/reviewers/information-leakage.ts:23`), otherwise judging the message
against recipient type and broad trust bands (`:38`). It intentionally receives
less contextual information than other reviewers. `src/core/CoherenceGate.ts:1526`
records recipient, violations and note in a bounded in-memory history; `:1571`
writes durable outcome metadata plus only 200 scrubbed message characters.
`src/core/ResponseReviewDecisionLog.ts:50` contains write failures and `:66`
rotates to one archive, replacing the previous archive.

**Value — INFERENCE / learning limit.** There is review telemetry, counterfactual
re-review and canary support (`src/core/CoherenceGate.ts:1154`), but these do not
establish long-horizon wisdom. A primary user may receive another person's private
information; primary-user status alone cannot authorize that disclosure. The
restricted reviewer lacks the complete source-specific policy needed to adjudicate
such a case. An output check is too late to protect information already sent to
a model provider. Truncated/rotated records cannot reconstruct every judgment or
guarantee that nothing important is silently lost. Source presence does not prove
the currently disabled discovery feature is enforcing live traffic.

### 2.4 External-operation gate and adaptive trust

**Value — SOURCE.** `src/core/ExternalOperationGate.ts:28` defines mutability,
reversibility, scope, risk and action enums. `:164` computes the risk matrix:
unknown mutability is critical, but recognized reads are always low (`:192`).
Evaluation applies service blocks and allowed-operation floors before model
consultation (`:308–402`). The model can escalate to approval, not relax the
configuration floor; even a model “block” is mapped to approval on that branch.
The normal evaluation tail logs classification, action and timestamp (`:463`).
Early configuration refusals return before that logging tail. The log interface
also permits approval and success fields (`:118`), but their existence is not
proof every execution reports an outcome.

The model sees operation metadata and the user request, deliberately not the
underlying content (`:478`). A supplied authorization on an irreversible operation
must be an anchored artifact (`:302`); this conditional check is not proof that
every irreversible action requires one in this method. Adaptive trust stores
per-service/per-operation levels with source and history
(`src/core/AdaptiveTrust.ts:28–86`), records successes (`:198`) and derives elevation
suggestions from streaks (`:426`). Explicit levels and a maximum automatic level
constrain those suggestions. Whether every consumer honors the entire chain is
UNKNOWN in this audit.

**Value — INFERENCE / learning limit.** Reading can disclose a private query to a
service or expose retrieved content to a provider without modifying a remote row.
A reversible write can irreversibly change what another person knows. Therefore
database mutability is not a disclosure-risk classifier. Operation success and
absence of a reported incident are weak proxies for sound information use; a
streak cannot grant a recipient access to a new person's confidential history.

### 2.5 Mandates

**Value — SOURCE.** `src/coordination/MandateGate.ts:85` checks mandate existence,
authorship, expiry, revocation, named caller, matching action/bounds and objective
conditions. Both allow and deny are audited (`:69`, `:77`).
`src/coordination/MandateStore.ts:45` canonicalizes authored fields for signing;
`src/coordination/CrossMachineMandate.ts:62` verifies an issuance signature against
the expected trusted issuer. This is a deterministic authorization floor, not a
model learning permission from favorable reactions.

**Value — INFERENCE / learning limit.** There is no wisdom learning in the gate.
Its `paramsSatisfyBounds` checks only named bounds and permits extra keys
(`src/coordination/MandateGate.ts:42`). Consequently, a broad action grant is not
automatically an exact content-and-recipient authorization. That protection exists
only if the owner puts the relevant parameters in the bound contract and the
consumer enforces them. Audit rows shown here name action and condition result,
not a complete per-fact use decision.

### 2.6 Preferences and corrections

**Value — SOURCE.** `src/monitoring/CorrectionAnalyzer.ts:35` defaults to four
qualifying occurrences, multiple days and, for preferences, multiple sessions.
Code-determined occurrence weight controls admission; model confidence alone does
not (`:155`). Complete-link token similarity groups records (`:109`).
`src/monitoring/CorrectionLoopDriver.ts:169` routes preferences, policy-relaxation
suspicions to attention, and infrastructure gaps to proposals/feedback. Its
declared dependencies exclude mandate or authority mutation (`:12–36`).
`src/core/PreferencesManager.ts:154` wraps injected preferences explicitly as
signals; `:310` is the writer, with provenance, timestamps, confidence and recurrence.
An upsert raises confidence using `max(old,new)` (`:336`).

**Value — INFERENCE / learning limit.** This is real local adaptation, with a
useful signal/authority separation. Yet repeated corrections from one source are
not independent outcome evidence, lexical similarity is not semantic identity,
and a maximum-only confidence update does not itself downgrade a refuted lesson.
The policy-keyword check routes a suspected relaxation for review; it cannot prove
that all paraphrased constitutional conflicts are excluded. Source labels and
deterministic weights are not a verified human grader's scope of standing. Fleet
feedback proposals are not fleet constitutional approval.

### 2.7 Decision journal

**Value — SOURCE.** `src/core/DecisionJournal.ts:158` validates agent-authored
submissions: session, decision and principle are required; unknown fields are
refused; confidence must be numeric. The canonical `log` writer requires evidence
(`:295`), optionally promotes to semantic memory, and appends a JSONL entry
(`:324–365`). Optional semantic-memory wiring is explicitly described at `:256`.
Statistics expose principled versus unprincipled entries (`:434`). The principle
requirement belongs to the validated submission boundary; it should not be
mistaken for a universally enforced invariant of every internal writer call.

**Value — INFERENCE / learning limit.** A decision and its stated guiding
principle survive, which is a good starting point. A nonempty principle string
does not establish that a constitutional pillar entails the decision. The journal
does not itself evaluate outcomes or make the conclusion and rationale separately
revisable claims. Logging a rationale is also not proof that it caused the choice.

### 2.8 LLM-decision quality meter

**Value — SOURCE.** `src/core/decisionQualityTypes.ts:3` distinguishes always-on
correlation from opt-in decision-context enrollment; `:155` allows no recorder in
contexts without the server. `src/core/DecisionQualityRecorderImpl.ts:366`
validates right/wrong/unknown, derives the evidence rung from a registered rule,
and verifies its owning component (`:388`).
`src/monitoring/FeatureMetricsLedger.ts:372` distinguishes deterministic ground
truth, recurrence, LLM interpreter and self-report; evidence strength separately
distinguishes proof, negative evidence, recurrence proxy and self-report (`:379`).
Its canonical winning-grade view ranks those rungs, then wrong before unknown
before right, then time (`:775`). The scheduled grading pass is deterministic
only; the interpreter rung has no implementation there
(`src/core/decisionGradingPass.ts:5`). Matured evidence-absent windows become
unknown, never success by silence (`:214`).

**Value — INFERENCE / learning limit.** This is the strongest reusable grading
substrate. Registered component ownership is still narrower than human standing:
who can judge confidentiality for which subject, relationship and effect. The
winner ordering does not implement “later outcomes outrank immediate reactions”
as a general rule; earlier stronger-rung evidence or a wrong grade can dominate a
later right grade. A distinct supersession/re-derivation contract is needed before
adopting that principle. Outcome quality and reason quality are not independent
grade axes here. Measurement is not automatic policy improvement.

### 2.9 Benchmark-divergence detector

**Value — SOURCE.** `src/monitoring/BenchmarkDivergenceAnalyzer.ts:5` compares
pool-merged matured grade aggregates with mirrored benchmark pass rates and writes
advisory findings. It is observe-only, with separate dry-run behavior.
`src/core/benchmarkDivergenceCore.ts:11` enumerates divergence, insufficient evidence,
missing baseline, failed preconditions and partial coverage. Prompt identity and
mirror freshness constrain comparisons; sample size and unknown share gate them
(`:268`), and Wilson uncertainty enters the difference threshold (`:273`).
Repeated inability to conclude has its own chronic counter (`:81`).

**Value — INFERENCE / learning limit.** This can detect a benchmark ceasing to
predict observed grades; it does not validate the graders, choose constitutional
values or make correlated cases independent. Agreement between a biased benchmark
and equally biased production grades is not wisdom. Nor does a lower unknown rate
prove better outcomes if the system merely pressures graders into certainty.

## 3. Findings for the next research stages

**Value — synthesis, not design approval.** Preserve the separation among
authorization, deliberation, outcome observation and learning promotion. The
following distinctions are necessary questions for R4/R5, not implemented claims:

| Evidence carried forward | Remaining judgment-of-use gap |
|---|---|
| Signed mandates and narrowing-only configuration floors | Source-specific permission for private use, provider disclosure, final recipient and inferred disclosure |
| Candidate identity, decision journal and context enrollment | Complete permitted decision inputs, withholding alternative, rationale claim and outcome hook |
| Evidence rungs and unknown outcomes | Verified grader standing, reason refutation, late evidence and explicit supersession |
| Local preference proposals and recurrence | Harm-sensitive local learning; independent fleet cases under a pillar with human approval |
| Divergence and canary machinery | Frozen real-case labels, blinded independent review and resistance to optimizing for approval |

**Value — honest limits.** No new private-traffic experiments, deployed-path proofs,
grader agreement study or wisdom benchmark were run for R1. These findings do not
claim Rule 65 convergence; Echo's later design review remains the review boundary.
The amendment's money threshold and policy markings remain operator-owned. A
constitutional conflict is a candidate gap, never a license to train the judge
to approve the agent's preferred behavior.
