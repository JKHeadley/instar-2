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
114; **checks:** `tests/assembly/production-provider-tools.test.ts` (no delegating tool in the
preview's tool launch) and P15-NF-21. Every delegated session or agent, including one started inside
a turn, has the Rule 114 durable parent-child edge. Ordinary subprocesses remain owned by their
enclosing execution. Durable work survives disposable turns and resumes only under current scope,
ownership and resource authority. The preview's tool turn delegates nothing: its launch removes every
subagent and workflow tool, so the commands it runs are ordinary subprocesses of that turn's launch.

**Rule — long and scheduled work runs as a delegated session, and the result file is its exit
test.** Rules 60, 61, 68, 102 and 114; **checks:**
`tests/assembly/production-session-work.test.ts`, `tests/e2e/session-work-tmux.test.ts`,
`tests/e2e/session-work-live.test.ts` and P15-NF-21. A due work step may run as a full harness
session instead of one bounded model call. Its Rule 114 edge is recorded durably BEFORE the child
session exists, naming the scope, the owner, the grant this step runs under, its budget, its exit
test, its placement, its transport and its result destination; every path out of the step — a
result, a failure, an interruption, a launch that never happened — stops the child by its exact
identity, releases its process tree and only then writes exactly one close for that edge, so a
delegation is never a session nobody owns and a close is never written over a child still running.
A stop or release that cannot be confirmed leaves the step uncertain. Each step is its own fresh
session, named from its operation, so a later step never depends on continuing an earlier one. The
destination file is the exit test, not a terminal heuristic, and it is the only way a step
completes: a result is taken only when it is non-empty, within the declared byte bound and
unchanged across two reads one poll apart. It is read physically bounded to one byte past that
bound, so an oversized result is refused without being loaded; a leftover at the destination that
cannot be removed refuses the step before any launch. An idle-prompt classifier is per-harness —
one real session harness keeps placeholder text on its prompt line throughout a turn — so a closed
turn only shortens the wait for a result and never bypasses the two-read test. A step that cannot
be observed, is interrupted, or ends without a result is uncertain, never reported as done.

**Rule — a delegated session runs only under its own reviewed grant and the execution floors.**
Rules 26, 60, 61, 75, 103 and 114; **checks:** `tests/assembly/production-codex-provider.test.ts`,
`tests/assembly/production-provider-subscription.test.ts`, `tests/assembly/session-work-host.test.ts`
and `tests/assembly/production-session-work.test.ts`. The path exists only when the operator has
approved an activation record for the doorway's own session framing, resolved from the same sealed
authority as every other activation. That record binds the exact session policy — the harness's
unconfined launch flags on the exact model, the step limits, the exit test and the task wording —
and states in writing that the operator accepts the child is unconfined. The harness, its
executable, its home and its login home come from the doorway and the login profile, never from a
separate setting. Before every step the grant is re-checked and the login home's live sign-in is
confirmed to be the subscription the profile names; an API-key sign-in, no sign-in, or an
observation the host cannot make refuses the step. Changing or removing the grant, the answer
activation, the journal stop, ownership loss or the trial's end stops an open step's child. The
host's one resource owner admits each step before its session exists and holds the session's
process tree under the same memory, process and CPU ceilings as every other launch, reclaiming it
when the step ends; because the session is started by tmux rather than by the owner, those
per-tree ceilings are enforced on sampled observation rather than kernel limits, and the record
says so.

**Value — a session step's effects are not classified, and enabling the path is the operator's
call.** On this HEAD the effect doorway is not on the live path, so a delegated session's effects
are not tested against the four consequential-effect tests in `docs/00-the-purpose.md`: a step can
produce an effect no doorway classified, and the instruction not to send is an instruction, not a
gate. The grant's written acceptance of the unconfined residual makes that the operator's
deliberate decision rather than an inference from a source comment. Wiring the effect doorway onto
the live path is separate work.

**Rule — a session step's spend bound is a reserved and metered call liability.** Rules 60, 61 and
75; **checks:** the same cases. One step at a time runs under a finite wall-clock deadline, a
finite result-size bound and a finite per-launch step ceiling. Its edge reserves the step's whole
model-call liability against the journal's call allowance before the child exists, and the route is
taken only when the allowance can hold that liability on top of the obligation's own start; the
reservation is retained, as a tool turn's is. The child's model calls are counted from its own
transcript once per poll, and the step ends when the count reaches the reserved ceiling; a
transcript that cannot be read is unknown and ends the step, never counted as zero. The meter is
sampled, so a step can overrun by the calls made within one poll interval. A subscription session
reports no token meter, so the recorded budget states its token bound as absent rather than
inventing one; no surface may present a session step's usage as measured.

---
