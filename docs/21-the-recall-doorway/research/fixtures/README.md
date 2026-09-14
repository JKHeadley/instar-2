# Synthetic research fixtures

These are round-two evaluation inputs and recorded baseline observations, not a production
implementation or a completed model benchmark. Every person, exchange and private-looking
detail in the synthetic files is invented. Dawn's private code and conversations are excluded.
The source identities, primary benchmark citations and full decision protocol are in
[R5](../05-proposals-and-evaluation.md).

## Files and counts

- `installed-baseline-results.json`: the actual three-method installed-package run, with
  synthetic collaborators and no provider inference. This is an observation, not a proposed result.
- `synthetic-seeds.jsonl`: 20 seed histories, each with original records, two principal triggers,
  support references, expected/prohibited behavior, a scope policy and one supplementary probe.
- `synthetic-cases.jsonl`: 200 primary cases referencing those seeds: 20 × two cue forms × five
  evidence conditions. All have `modelRunExecuted:false`.

There are 12 development seeds (120 variants) and eight evaluation-reserved seeds (80 variants).
Every setting has three development and two evaluation seeds; every benchmark family appears in
evaluation. The 20 supplementary boundary probes are outside the 200-case count. This is a public
planning split, not a claim that the authors have never seen the evaluation examples. Freeze
dataset hashes and selection rules before tuning; expand independent held-out histories for
strong claims, and use independent custody if the next experiment needs a secret evaluation set.

## Deterministic assembly

1. Load the referenced seed and retain its source record IDs and evidence kinds. The current
   time is synthetic; the Monday snapshot is 2025-09-15. Records are ordered by event time.
2. Expand the distractor recipe into exactly 240 messages, replacing both occurrences of `{n}`
   with the integer 1 through 240. Start one minute after the latest included source record,
   increasing by one minute. Use its specified author and current conversation. The trigger
   follows the distractors. This keeps old same-topic records outside a recent-message window.
3. Resolve `SCENARIO_AUDIENCE` to the seed's current audience. Apply private record restrictions
   before retrieval, derived-context construction, cache reuse and model submission. The separate
   identity/standing fixture supplies owner state; a recalled sentence does not grant permission.
4. Select the explicit or ordinary trigger from the case. Apply its controlled fault to the
   designated stage without changing the retained original history or desired healthy behavior.
   Preserve independent experiment logs of intended versus actual input.
5. Apply the unavailable-source case's calibrated behavior rubric instead of requiring the
   agent to know unreachable history. For oracle cases, force only the permitted support spans
   into actual submitted input alongside the labeled unsupported guess. The oracle is not a
   license to reveal private evidence. Verify that injection in the provider input capture.
6. Evaluate expected/prohibited behavior and the R5 metrics. Do not score exact quote matching
   as a substitute for correct action, speaker, time and scope.

`expectedSupport` identifies a sufficient original-evidence packet for oracle injection, not
an obligation to retrieve every redundant reference. Score retrieval against the cue-specific
`acceptableSupportPaths`; `@trigger` denotes evidence supplied by the current intake itself.
This prevents a correctly understood current approval cue from being miscounted as forgotten
merely because the same older approval message was absent. Behavioral correctness remains
independently judged, and alternate valid evidence paths can be adjudicated under the frozen rubric.

For supplementary probes, apply `sourceSnapshot`, `currentAudience` and `ownerStateOverride`
where supplied before assembly. Hypothetical probe questions test their stated condition; they
do not mutate the primary case. A temporal question about earlier state may inspect later
history when the rubric asks for historical reasoning; the pre-cue and tentative-handoff probes
explicitly remove later source records to prevent future-evidence leakage.

## Experimental limits

The seed recipe separates meaningful originals from mechanically generated distractors. It
does not reproduce the vocabulary distribution or social complexity of a real long conversation.
Longer and more natural independently authored histories are a later expansion, not hidden claims
about this pilot. Exact/raw, lexical, dense and full-history controls should all receive the same
expanded material and permitted source frontier.

The injected omission alternates candidate-selection and rendering faults across seeds. It tests
diagnostic attribution as well as user outcomes. The oracle condition tests whether correct evidence
is used, not whether a retriever independently found it. Counterfactual approvals and handoffs
remain simulated: standing permits preparation only, never real dispatch or world modification.

Correlated variants do not increase the independent-history sample size from 20 to 200. Model
repeats likewise do not create new people or incidents. The installed-method result measures
three failure mechanisms, and the corpus currently has zero model-performance observations.

Validation performed in this research round: JSON parsing; unique seed/case IDs; case-to-seed and
support references; 20/200 counts and 120/80 split; all family/setting combinations; expected
private-evidence exclusions; bounded distractor expansion and future-cue probe snapshots.
The README's assembly procedure has been checked against the data; a production runner remains
outside this documentation-only research scope.
