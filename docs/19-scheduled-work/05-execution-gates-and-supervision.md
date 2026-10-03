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
resolved to an approved judgment plan and model floor. The registered pipeline profile derives
whether the pipeline is critical; neither the manifest nor an individual step may declare itself
non-critical to narrow that result. `tier0` is permitted only for a non-critical pipeline whose
holder map contains no mind-held boundary. For a critical pipeline, `tier1` is the minimum: a
bounded model watches and validates every business step after it produces its Result and before
the next consequential step. This includes preparation, interpretation and cleanup steps even
when their individual profiles are non-critical. `tier2` uses a capable model for the job's
reasoning and still supplies the same complete step-by-step validation coverage, with independent
supervision wherever the registered plan requires it. The strings are manifest choices, not a
new core type.

For each pipeline task class, Part Seven's benchmark process selects the most efficient supervising
model route that passes the class's declared quality and safety bars. The selected route cites the
matching current benchmark evaluation. Cost is reduced by that measured model choice, never by
omitting supervision from a business step. If no candidate passes or the supporting evaluation is
stale, supervision is unavailable and the pipeline follows its declared failure direction. This
benchmark-selected route arm of P15-NF-43 is non-executable until ledger #27 and #30's GRANTED
`seam-response-judgment.md` and `seam-response-assembly-followup.md` contracts land with their
current-route, compatibility and measured-support evidence.

**Rule — missing supervision is not affirmative validation.** Rules 38, 42, 43, 56 and 95;
**checks: P15-NF-42/43/44**. Every business step in a critical pipeline records the matching
JudgmentRequest, attempt, receipt, resolution and exact step digest. The holder compares the
pipeline's complete ordered business-step roster with that evidence; a step-level criticality flag
cannot remove a roster member. A missing provider, timeout, insufficient floor,
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

Compatibility import first distinguishes direct-script execution from model-session execution.
For a model-session job in the default 1.x server composition—where `IntegrationGate` is injected—
it maps to `required` when `livingSkills.enabled` is true and `integrationGate` is absent or true.
It maps an explicit false gate to `off`, and disabled living skills to `off`. The default's timeout
release and per-slug fourth-block release map to the rules above.

For a direct script job, 1.x `triggerJob` returns through `runScriptJob`; its success and failure
callbacks never call `notifyJobComplete` or `IntegrationGate.evaluate`. Compatibility import
therefore maps post-completion learning to `off` for scripts while preserving and reporting the
source `livingSkills` and `integrationGate` settings. Selecting `required` for an imported script
is an explicit new package choice, not preserved 1.x behavior. A shared job-definition flag cannot
make the script path appear to have run learning it never invoked.

The optional 1.x model-session composition with no `IntegrationGate` but with intelligence is
reported as compatibility residue. Its `notifyJobComplete` path starts standalone reflection for
every completed model-session job regardless of `livingSkills.enabled`, proceeds with the global
queue immediately, records any reflection in run history, and may deliver it to the job topic.
Direct scripts still bypass that completion method. Part fifteen deliberately does not silently
map the model-session composition to `off` or claim it is the default server. The one-way importer
preserves its source bytes, marks the job inhibited, and requires an explicit package choice of
`off` or `required` before activation. P15-NF-45/51 separately fixture the default IntegrationGate
composition, the direct-script bypass and this no-gate model-session residue. They also cover two
jobs, restart, timeout release, the fourth counted failure and the still-open follow-up obligation.

**Rule — workers execute runs; sessions do not own them.** Rules 41, 46 and 68;
**checks: P15-NF-21/45**. A session, subprocess, or remote agent receives one leased RunStep with
grounding, bounds, predecessor facts, exit test and result destination. Worker death leaves the Run
and its obligations durable. A completion marker or transport receipt proves only the named stage.
Part five decides progression and closure from accepted results. Handoff prose is a claim to
re-resolve against signed history, never the source of current schedule, authority or completion.

**Rule — every delegated session has its run edge; a subprocess has its owner.** Rules 60, 68 and
114; **checks:** `tests/preview/tool-turn.test.ts`, `tests/preview/tool-admission.test.ts`,
`tests/assembly/production-provider-tools.test.ts`, the gated live runs in
`tests/integration/tool-turn-full-live.test.ts`, and P15-NF-21. Every delegated session or agent,
including one started inside a turn, has the Rule 114 durable parent-child edge. Ordinary subprocesses
remain owned by their enclosing execution. Durable work survives disposable turns and resumes only
under current scope, ownership and resource authority. The preview's tool turn may start subagents of
one registered type, in the foreground, each bounded in model turns and sharing the turn's tool-call
count, and a subagent may start its own within the same budget, so the delegation's shape is chosen
for the work; the turn's one reserved budget covers every subagent at any depth. A workflow or a skill
that may start agents whose number or model turns cannot be reserved before dispatch is refused for
budget at the admission hook. The turn's reservation, durable before dispatch, carries the
delegation's authority and its whole budget share. Each child's start and stop are recorded on the
machine before it acts, and the turn's journaled trace carries one edge per child: the parent turn
that owns its reservation, the subagent that started it when not the turn itself, the child, the
authority, the budget, the exit test (its final message returns as the tool result to whoever started it),
the placement (the turn's own harness process on this machine), the transport, the result destination
and the cancellation (the turn's process group). An edge ends returned, or cancelled when the
operator's stop or a withdrawal ended the turn, or unknown; it is never silently dropped. The commands
the turn and its children run are ordinary subprocesses of that turn's launch.

---
