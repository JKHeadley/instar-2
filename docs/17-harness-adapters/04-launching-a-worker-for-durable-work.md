## 4. Launching a worker for durable work

**Rule — the run exists before its harness worker.** Rules 31, 63, 68, 69 and 96; **checks:
P13-NF-14/15/17**. Part Five first records the `Run`, but it does not append a pending step before
grounding. The assembly derives and decodes the candidate ordinary `RunStep` so its stable id can
correlate the loading launch without yet admitting it. It then persists the `HarnessLaunchSpec`.
Part Eight records the loading-only launch intent and Part Six records the current `Lease`,
`FenceToken`, one-use `AdmissionReservation`, and consumed claim. Only then does the guarded Ten
executor invoke `HarnessAdapterPort.launch` exactly once. After that invocation, Ten persists the
resulting `HarnessObservation`, including an `uncertain` phase when the answer or receipt is lost.
The assembly then calls Five's `ground()`. Inside that call, and only through its injected
`GroundingReadPort.read`, the system samples the fresh clock and current history and derives the
exact immutable bytes. It next has Eight prepare and admit the exact delivery operation and Six
issue its current fence-bound one-use claim. Preparation and admission do not invoke the adapter.
Only after those identities exist does Ten append and resolve the immutable current-context
delivery specification granted by the dated 08:48Z addendum in
`seam-response-assembly-followup.md`, recorded as GRANTED in `SEAM-LEDGER.md` row 45; that
specification binds the exact bytes, admitted Eight operation, and Six claim. The guarded driver
then invokes `HarnessAdapterPort.deliver` once with that specification, observes claim consumption,
and re-resolves its resulting delivery and `context-consumed` observations. The reader returns only
after that delivery witness exists. Five validates the
returned grounding while its clock still falls inside the `ground()` call and durably appends a
separate `SessionGrounding` fact. It next submits the ordinary `start` transition. Five
re-resolves and revalidates that admitted grounding fact, then
durably appends the `RunTransition` containing the ordinary `RunStep` and grounding reference. No
`HarnessObservation` is fabricated before launch. A cut between any two records leaves the
original launch or delivery identity and maximum exposure pending for observation; it never
authorizes a second invocation. A cut after delivery admission or claim but before Ten appends the
specification resumes setup around those same identities; it cannot mint a second claim. A cut
after specification append but before invocation retains that same unconsumed claim, while a cut
after invocation observes the original operation and claim before any further action. A cut after
`ground()` appends grounding but before `start`
commits leaves no pending ordinary step; recovery re-resolves that grounding and current history
before retrying the same transition. The typed-payload half is non-executable
until `seam-response-effects-payloads.md` lands. The harness-operation doorway half is
non-executable until `seam-response-effects-followup.md` lands. Production consumption validation
is non-executable until the dated 06:33Z addendum in `seam-response-rungraph-followup.md`,
recorded as GRANTED in `SEAM-LEDGER.md` row 38, lands. The worker has only loading and
observation capabilities before grounding. The clock-contained current-context path is separately
   non-executable until the dated 08:48Z addenda in `seam-response-assembly-followup.md` and
   `seam-response-rungraph-followup.md`, recorded as GRANTED in `SEAM-LEDGER.md` row 45, land. A process id,
terminal name, provider conversation id, or resume token is never the durable run identity.

**Rule — launch success is narrow.** Rules 26, 62, 68 and 95; **checks: P13-NF-14/15/29/33**.
Launched means the exact admitted process incarnation produced fresh runtime evidence under the
expected artifact and working scope. It does not mean context was consumed, the worker is ready
for ordinary action, a model request began, useful progress occurred, or the run succeeded. An
uncertain spawn answer remains an unresolved launch attempt. Recovery observes that attempt before
requesting another launch. Process-id reuse, an old terminal, or a sibling runtime cannot satisfy
the observation.

**Rule — actual-start grounding precedes ordinary action.** Rules 47, 68, 96 and 110; **checks:
P13-NF-14/16/17/18/23**. After actual launch, Part Five calls `ground()`. Inside the
`GroundingReadPort.read` operation invoked by that call, the reader takes the fresh history, clock,
binding, directive, register, pending-operation, child, and receipt read required by
`SessionGrounding`, derives the exact immutable context bytes, obtains the exact Eight delivery
admission and Six one-use claim, and only then appends and resolves Ten's specification binding
those values. Admission remains distinct from invocation: the driver next delivers once, observes
claim consumption and the actual model-context boundary, and re-resolves all references before the
read returns. The grounding clock is the clock
actually sampled during that read. A read or consumption witness completed before `ground()` began
is refused; its timestamp is never rewritten. Only a matching `context-consumed` observation makes
grounding eligible.

Five's granted additive consumer re-resolves the signed Ten fact and decodes the
   `HarnessObservation` under its `body.record`. The dated 08:48Z addendum in
   `seam-response-rungraph-followup.md`, recorded as GRANTED in `SEAM-LEDGER.md` row 45, refines
   the production arm granted in row 38 and follows the observation's
Ten-owned context-delivery reference. It uses the immutable `HarnessLaunchSpec` to prove the
original process, run, harness, artifact, machine, and incarnation, while it checks the current
candidate step, intake/input, register generation, full ordered context digests, required briefing
classes, and worker/execution context against the new immutable context-delivery specification and
the fresh grounding read. Thus neither later input nor changed compaction bytes mutate the launch.
An observation must be admitted, untainted, unconflicted, fresh, causally include both records, and
be in the `context-consumed` phase with resolvable boundary evidence. Adapter-local assertions and
the flat test-only consumption fact do not qualify. The production-consumption arms of
P13-NF-14/16/17/18/23 and their governed live tuple cells are non-executable until the dated 06:33Z
addendum in `seam-response-rungraph-followup.md`, recorded as GRANTED in `SEAM-LEDGER.md` row 38,
lands. Their clock-contained same-incarnation context path is separately non-executable until
   the dated 08:48Z addenda in `seam-response-assembly-followup.md` and
   `seam-response-rungraph-followup.md`, recorded as GRANTED in `SEAM-LEDGER.md` row 45, land.

After the witness passes, `ground()` durably appends `SessionGrounding`. The separate landed
`transition(start)` call re-resolves that fact, repeats grounding, ownership, freshness, policy,
and new-inbound checks, and only then appends the transition containing the previously decoded
ordinary step. Until that transition commits, the candidate is neither pending nor executable,
and the worker may use only loading and observation paths. Its provider calls, tools, messages,
writes, and other ordinary effects remain blocked at the public doors. A cut after grounding but
before the start transition leaves the grounding fact durable and the step unadmitted. Recovery
must re-resolve current history and may retry the same start transition; it cannot dispatch the
candidate or construct a second step. If the launch answer or consumption observation is
uncertain, Eight retains the launch effect and Six's `RecoveryRecord` queries that original launch
identity; no second launch or pre-grounding step is created.

**Rule — the working scope and hidden paths are confined before launch.** Rules 30, 41, 60, 63
and 75; **checks: P13-NF-05/14/18/47**. The adapter realizes the exact work directory, file
scope, environment allowlist, resource handles, network posture, tool route, model route, and
process identity from `HarnessLaunchSpec`. Built-in provider, shell, tool, MCP, connector, auto-
update, retry, and credential discovery paths are disabled or mediated through the existing
doors. Hook prose is not confinement. If the runtime cannot close a required hidden path, the
affected governed mode is unsupported before live credentials or work are supplied.

---
