## 5. Execution gates and supervision

**Rule — preflight is an ordinary recorded step.** Rules 1, 4, 42, 57, 66 and 67;
**checks: P15-NF-05/40/41**. A zero-token preflight invokes a registered programmatic capability
through the normal run and effect boundaries. Both preflight and later script execution use Part
Eight's granted `process-control` payload with an exact action-time executable and ordered-argument
identity. Part Ten's granted confined process driver accepts only that decoded payload and the
current Part Six one-use claim. Its inputs, output, exit meaning, duration and evidence are recorded
as a RunStep Result. A valid no-work finding is the business-step outcome with zero items, not a
closure instruction. The original immutable exit test must accept that exact no-work evidence. If
learning is `required`, Part Five keeps the Run open until section 5's learning step has an accepted
lawful disposition; only then may Part Five evaluate the exit test and accept a `completed` RunExit.
Inability to inspect is Refused or failed according to the operation contract. Free-form shell text,
command-prefix classification, nonzero-means-no-work convention, and an unattributed local file
cannot serve as the gate contract. P15-NF-40/41 are non-executable until both
`seam-response-effects-payloads.md` and `seam-response-assembly-followup.md` land and pass their
process-operation and confined-driver acceptance evidence.

**Rule — supervision levels select registered part-seven plans.** Rules 34, 38, 56, 57, 66 and
90; **checks: P15-NF-11/42/43**. The manifest chooses one of three package-level levels, each
resolved to an approved judgment plan and model floor. `tier0` permits only deterministic,
non-critical steps whose holder map contains no mind-held boundary. `tier1` places a bounded light
model supervisor after every declared critical programmatic step and before its next consequential
step. `tier2` uses a capable model for the job's reasoning and still records independent required
supervisor or verification boundaries. The strings are manifest choices, not a new core type.

**Rule — missing supervision is not affirmative validation.** Rules 38, 42, 43, 56 and 95;
**checks: P15-NF-42/43/44**. Each critical step records the matching JudgmentRequest, attempt,
receipt, resolution and exact step digest. A missing provider, timeout, insufficient floor,
unavailable capture, malformed answer, or absent resolution follows the job's declared failure
direction and remains visible. It cannot downgrade to `tier0`, use keywords as judgment, or treat
model fluency as proof. The deterministic bootstrap that admits the supervisor call is finite and
cannot ask another model to approve its own invocation. The first provider call is not yet an
executable Eight-governed effect on this source head. P15-NF-42/44 are non-executable until ledger
#23's GRANTED `seam-response-effects-followup.md` and `seam-response-judgment.md` land together and
their joint first-call preparation, effect observation, receipt and settlement evidence passes.

**Rule — opted-in post-completion learning is owned work.** Rules 8, 41, 46, 58 and 68;
**checks: P15-NF-42/44/45/50**. The manifest's post-completion learning mode is `off` or
`required`. `off` creates no reflection and cannot report that learning occurred. `required` adds
a bounded RunStep after the business outcome and before the package's closure condition. It uses
part seven to consolidate a reflection, part nine to assess the result, and registered package
operations to derive reusable blocker knowledge. The learning Result cites the still-open Run, the
accepted business-step outcome, exact output capture, reflection, pattern analysis, derived
knowledge and all failures. Part five first accepts that learning disposition, then evaluates the
declared exit test and closes the Run if it passes. A business outcome alone cannot bypass a
required learning step, and a learning receipt alone cannot close the Run. The model-backed
learning arm of P15-NF-45 is likewise non-executable until ledger #23's GRANTED
`seam-response-effects-followup.md` and `seam-response-judgment.md` land with that joint first-call
evidence.

A **same-job learning hold** is an inhibition on the next otherwise-ready admission for the same
stable job id and learning-policy generation. It never delays another job, another family, the
minimal plane, diagnosis or repair. Its durable counter has that same key. A counted event is a
failed business occurrence whose required learning evaluation produces no accepted learning Result
when its same-job successor would otherwise admit. An accepted learning Result for that key resets
the counter to zero. Success for another job does not reset it. Restart reconstructs the hold and
counter from signed facts.

The learning attempt has a finite timeout, attempt budget and ceiling of three consecutive
same-job holds. Each of the first three counted events inhibits that job's successor until an
accepted learning Result or the attempt timeout. A timeout releases that successor with a visible
unavailable/Refused learning Result. At the fourth counted event, the ceiling releases the successor
immediately and leaves the counter at its ceiling until that job records accepted learning. Timeout
and ceiling release preserve a separate owned follow-up obligation; neither is reported as captured
learning or rewrites the business outcome. The scheduler package owns this admission hold, not the
learning verdict.

Compatibility import maps the default 1.x server composition—where `IntegrationGate` is injected—
to `required` when `livingSkills.enabled` is true and `integrationGate` is absent or true. It maps an
explicit false gate to `off`. The default's timeout release and per-slug fourth-block release map to
the rules above. Disabled living skills map to `off` only in that IntegrationGate-enabled
composition.

The optional 1.x composition with no `IntegrationGate` but with intelligence is reported as
compatibility residue. In 1.x it starts standalone reflection for every completed job regardless of
`livingSkills.enabled`, proceeds with the global queue immediately, records any reflection in run
history, and may deliver it to the job topic. Part fifteen deliberately does not silently map that
composition to `off` or claim it is the default server. The one-way importer preserves its source
bytes, marks the job inhibited, and requires an explicit package choice of `off` or `required`
before activation. P15-NF-45/51 separately fixture the default IntegrationGate composition and this
no-gate residue. They also cover two jobs, restart, timeout release, the fourth counted failure and
the still-open follow-up obligation.

**Rule — workers execute runs; sessions do not own them.** Rules 41, 46, 68 and 92;
**checks: P15-NF-21/45**. A session, subprocess, or remote agent receives one leased RunStep with
grounding, bounds, predecessor facts, exit test and result destination. Worker death leaves the Run
and its obligations durable. A completion marker or transport receipt proves only the named stage.
Part five decides progression and closure from accepted results. Handoff prose is a claim to
re-resolve against signed history, never the source of current schedule, authority or completion.

---
