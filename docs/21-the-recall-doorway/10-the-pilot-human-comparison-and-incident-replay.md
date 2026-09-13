## 10. The pilot, human comparison, and incident replay

**Rule — freeze the experiment before reading evaluation outcomes.** Rules 13, 34, 35,
39, 58, 75, 86, 90 and 108; **checks: P21-NF-15/16/17/22**. This is the preregistered
design protocol `P21-PILOT-01`, derived from
[R5 §§8–12](research/05-proposals-and-evaluation.md#8-synthetic-scenarios-adapted-to-five-benchmark-styles).
It specifies comparisons and candidate acceptance thresholds now; execution additionally needs
an immutable run manifest with approved resources and frozen source/model/price identities and
rubric (the written scoring instructions).
No paid run, real email, public post, deployment or transaction is authorized by this draft.

The run manifest must identify corpus (the test material) and expanded-history digests,
the split of seed histories (independently authored starting histories) between development
and reserved evaluation, all arms (methods being compared) and
comparisons with one component removed, reader/provider/model/settings,
index/extractor/embedding/reranker versions, prompt
and renderer digests, permissions, context/resource caps, fixed repeat seeds (recorded settings
for reproducing each execution's random choices), grader contract,
sampling/uncertainty method, stopping rule, price snapshot and total spend admission. A change
after looking at reserved outcomes requires a separately labeled exploratory run and new
independent evaluation material; it cannot silently redefine the preregistered success bar.

**Rule — use paired scenarios and controls that can overturn the proposal.** Rules 13,
34, 58 and 108; **checks: P21-NF-15/16/17/22**. The existing
[fixture corpus](research/fixtures/README.md) has 20 invented seed histories, two cue forms
and five evidence conditions, producing 200 cases: 120 development and 80 evaluation-reserved.
Twenty supplementary boundary probes are outside that primary count. Each seed expands exactly
240 deterministic distractor turns. Family coverage is LongMemEval-style extraction/time/update,
LoCoMo-style arcs/multi-hop, MemBench-style evidence-kind/participation, GroupMemBench-style
speaker/audience and PM-Bench-style intention/cue/cancellation, across all four operator settings.
These are adaptations, not executions of the named benchmarks or secret unseen data.

Every arm receives identical permitted originals, source snapshots, task instructions, reader,
final context cap, simulated action boundary and fault placement. Repeat model execution at least
three times per primary case, using the fixed repeat seeds to measure variation between runs:
600 executions per arm if all 200 cases are run. Admit only
the complete frozen plan affordable under the approved spend cap; do not silently shrink the
evaluation set mid-run. The external experiment logger is outside the reader's context in every
arm, including the baseline without product accounting.

| Arm | Comparison that it decides |
|---|---|
| B0: current recent-context/discretionary search | Honest current baseline; retain its real optional tools and measure whether it uses them |
| B0 + A | Receipt fidelity and overhead independent of answer gains |
| A + exact/raw and tuned lexical B | Benefit of compulsory selection without complex representations |
| A + matched dense/hybrid B | Paraphrase recall versus attribution/displacement/cost at the same envelope |
| A + portfolio B | Add person/temporal/anchor channels singly; add graph/tree/recursive channels singly and justified combinations; leave-one-channel-out attribution |
| Best development-selected B + deterministic final checks | Cheap effect-binding and current-source baseline for C |
| Identical B + selective semantic C | Net repairs, introduced errors, holds and cost caused by C |
| Identical B + retrospective review | Later-episode benefit with a frozen sequential training/evaluation boundary |
| Universal blocking review, offline simulation only | Directly test cost/silence/false-hold objection; no real recipient or production activation |
| Full permitted history and originals selected using the known correct support path | Best-case selection/compression control and correct-evidence-but-unused control; missing custody still limits available evidence |

Conditions are healthy, retained-but-index-lagged, source-unavailable, injected selection/rendering
omission, and correct evidence actually submitted alongside stale/conflicting material. Additional
controlled comparisons examine summary-only with original-plus-summary, enriched keys with replaced values,
warm/cold caches (with/without reusable stored results) and deliberately stale caches,
corrupted derived beliefs, hostile retrieved instructions,
and remembered approval with current revocation. Preserve owner authority in every arm.

Budget sweeps follow R5 §6: 1,000/4,000/8,000 recall tokens; 0.25/1/2 s ordinary retrieval; 5/10/15 s
combined consequential envelope. Sweep on development; freeze the chosen envelopes for reserved
evaluation. Report cold/warm cache, ordinary/burst workload, caught-up/behind indexes, and
available/unavailable dependencies. Missing captures and legitimate permission holds have their
own calibrated rubrics instead of being scored as a requirement to know forbidden history.

**Rule — the verdict includes uncertainty and adverse outcomes.** Rules 13, 58, 86 and
108; **checks: P21-NF-15/16**. The main measured result compares missed recall between methods
on the same ordinary cues with retained, permitted evidence. Explicit-cue performance, each setting,
obsolete recall, unnecessary holds, wrong-audience stages, completion, repetition and lifecycle
cost are additional required results. Report raw identities/counts, the size of each measured difference, uncertainty
and per-setting regressions; do not average away email or other-person failures.

Graders receive permitted originals, time/audience and the frozen rubric, but not arm identity.
Expected evidence is any valid support path, not one obligatory substring. Calibrate model
graders against independent human scoring on a proposed 20% sample drawn from each declared
setting, cue form and evidence-condition group, plus every
audience/authority failure and disputed case. Preserve disagreements. The tested reviewer
cannot grade its own success. Estimate uncertainty by repeatedly resampling independent seed
histories and recomputing the paired difference between methods. Keep each history's cue
variants and repeats together.
Report the resampling method and the assumptions behind its uncertainty interval.

| Candidate promotion gate, subject to OD-03/04 | Result that would reject or limit the proposal |
|---|---|
| A: zero false-success receipts in deterministic substitutions; actual-input fidelity; p95 accounting overhead at most 25 ms | Intended-only logs, erased overflow or false consumption reject A implementation even if answers look good |
| B: target at least 5 percentage points lower missed recall (for example, 20% down to 15%) versus tuned discretionary/simple controls, with interval and per-setting effects | Simple method matches the portfolio at lower cost; ordinary turns slow without benefit; interval is inconclusive; select the simpler rule-11-conforming method or collect more evidence |
| C: positive net reduction of consequential historical errors after introduced errors; unnecessary holds below proposed 1%; within time/cost caps | Review merely repeats B, shifts errors into silence, harms correct drafts, or cannot demonstrate a benefit; retain deterministic plus retrospective policy |
| Boundaries: all negative scope/authority/dispatch fixtures pass | Any unauthorized exposure or unsanctioned effect prevents promotion regardless of average accuracy |

The 80 reserved variants originate in eight seed histories and cannot establish that rare
failures occur less than 1% of the time, or that one method is generally better.
Expand independently authored legitimate-effect histories before rollout.
Zero observed wrong-audience events is not zero risk. Deterministic owner enforcement and wiring
tests remain required independently of empirical rates. All current corpus entries explicitly
say `modelRunExecuted:false`; this design records no model-performance result.

**Rule — beyond-human requires its own comparison.** Rules 13, 26, 58, 77 and 108;
**checks: P21-NF-16/21**. Proposed protocol `P21-HUMAN-01` compares consented humans and
the agent on the same permitted exchanges and later goals over a repeated-interaction horizon.
Report natural unaided human recall separately from tool-assisted human performance. Match
exposure, original-record access, task and time/resource conditions within each comparison;
do not compare an indexed agent to an artificially deprived human and call the result general.

OD-04 proposes a four-week study with separately scored exact episodes, current preferences,
commitments/cancellations, associative use, attribution and audience restraint. Recruit people
with comparable familiarity with the tasks. Estimate how much performance varies between people.
Before collecting comparison results, specify the smallest difference the study must detect and
the largest uncertainty it may leave. Choose enough participants to meet those requirements;
this is the study's precision plan. Record participant differences, including fatigue, unequal
exposure and task expertise, and record dropout and other missing observations separately.
Do not remove missing observations or count them as successes.
People judging the answers must not know which method produced them. Their judgments complement
objective constraint/action scoring; warm style is not memory.
When estimating uncertainty, keep repeated observations from each participant and each history
grouped together rather than counting them as independent evidence. Before collecting results,
fix the required improvement for each claim of better performance. Separately fix the largest
acceptable disadvantage for each dimension claimed to be at least as good. Report tools and
time costs. Any beyond-human statement must name the population,
dimensions, horizon and uncertainty it actually beat. Until then the result is unknown.

**Rule — implementation must accept a named incident replay artifact.** Rules 7, 35,
41, 58, 85, 89, 90 and 108; **checks: P21-NF-15/17/22**. `P21-INCIDENT-REPLAY-v1`
is defined by [its schema](fixtures/incident-replay-v1.schema.json) and
[custody/semantic requirements](fixtures/README.md). It contains original intake/author references,
later trigger and expected behavior, captured/indexed frontiers, candidates/actual submitted
context, scope/permission state, draft/effect/outcome, timestamps, build/hooks/flags, source errors
and charges. The implementation must validate it, resolve only authorized references, and replay
at the decision-time snapshot. Future corrections are labels in a separate grader channel.

The artifact keeps episode, inferred explanation and procedural repair separate, pairs a failure
with a comparable success and unavailable-evidence/legitimate-hold control, and records unknown
fields as explicit unknowns with reasons. It never invents an original from the desired answer.
Private originals remain in authorized custody; only synthetic or explicitly sanitized/exportable
material can enter git. Missing private replay sources yield an unavailable result, not a fabricated
experiment. JavaScript Object Notation (JSON) shape validation is executable now; production replay awaits the listed owner
seams. Dawn's deployed traces, Jamie outcome and the four reported incidents remain **UNKNOWN**.
