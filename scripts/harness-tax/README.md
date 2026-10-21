# Harness tax measurement

This tool compares twelve sanitized adaptations of recorded conversations: eight
continuity tasks and four short tasks. It measures correctness and trust alongside
cost. A stub pass proves the runner works; it says nothing about model performance.
The task catalog includes expected outcomes, grading rules, source message/update
IDs, and the changes made for privacy and repeatability. Echo topic-history cases
are operator requests; the journal reminder and directive cases are recorded
proof-room conversations, explicitly identified as such rather than attributed
to spontaneous operator requests. No private conversation is sent to a model.

Run the safe demonstration, from the repository root:

```sh
node scripts/harness-tax/runner.mjs init /absolute/new/scratch/run /absolute/config.json
node scripts/harness-tax/runner.mjs run /absolute/new/scratch/run 0
node scripts/harness-tax/runner.mjs report /absolute/new/scratch/run
```

The config for that demonstration is:

```json
{
  "mode": "stub",
  "model": "claude-opus-5-5",
  "start": "2026-10-23T09:00:00-07:00",
  "timezone": "America/Los_Angeles",
  "maxCalls": 100,
  "timeoutMs": 30000,
  "taskIds": ["lookup"],
  "off": []
}
```

Use an absolute path under the desk's lanes directory for desk configurations,
reports and evidence. Nothing under `.instar/` belongs in git. Dependencies are
already available; this tool needs only Node built-ins. Tests:
`nice -n 10 npx vitest run --maxWorkers 1 tests/harness-tax/runner.test.ts`.

## Staged experiment

Omit `taskIds` to select all twelve. Day 0 establishes decisions and promises and
runs the short tasks. Day 1 cancels a reminder. Day 2 crosses restart, topic,
compaction and machine boundaries, including observing due reminders without a
prompt. Day 4 checks a standing directive again. Invoke `run ROOT DAY` on each
date; the command finishes, keeping no background waiter. Live mode refuses a
day before its scheduled date and requires the stage-day gap to have elapsed
since the preceding stage’s durable intent timestamp for that task and setup.
A late start shifts subsequent stages; back-to-back catch-up is refused before
recording a new intent, so it can be invoked again when actually due. The desk arranges the noon reminder windows in
the configured timezone and supplies complete observations; a window missed by
the runner cannot be counted as a pass. The planned dates are October 23, 24, 25
and 27, 2026 (use these ISO dates rather than the inconsistent weekday labels in
the original brief).

The per-stage ledger is machine-local deliberately. Moving the measurement
runner means copying the complete experiment directory, verifying its digest,
and keeping one writer. Moving an *agent* is a different operation: the adapter
requires actual source/destination responder evidence, not a placement label.
Scratch state may persist within a task. Every task and every A/B arm needs a
fresh isolated target namespace; never let an A/B arm inherit another arm's
answers. Do not feed future stages, expected answers, or grading rubrics to the
agent. Bare Claude gets its scratch files, but no harness-injected recap or
artificial reminder scheduler; unsupported continuity is a measured outcome.

## Connecting the three setups

No Claude login is used by initialization, stub mode or reporting. Live mode is
for the desk's separately provisioned test accounts. It requires `driverModule`
and `graderModule` absolute module paths and three `targets`, keyed `bare`,
`instar1`, `instar2`. Every target names `root`, `login`, exact `model`,
`disposable: true`, `isolationReceipt`, `floorReceipt`; the two agents also name
their own `bot` and demo `channel`. Roots, logins and bots must differ. Serving
accounts and the explicitly excluded accounts are refused. Config fields are
references, never credentials. All target work stays inside the already
provisioned isolated host; changing a JSON label is not proof of isolation.

The exported `createDriver(host)` in `adapters.mjs` implements the three recipes:

* **Bare:** `claude -p PROMPT --model EXACT_MODEL --output-format json` in a
  scratch directory with an isolated home and a separately installed test login.
* **1.x:** `instar init --dir SCRATCH --framework claude-code`, then user-role
  messages through its demo channel. Initializing files alone is not running an
  agent; the host's prepare receipt must include successful agent startup.
* **2.0:** a proof-room style copy of a desk-provided, sanitized root snapshot,
  with its own bot and login. The host returns copy lineage and the actual
  ablation manifest. Never copy a serving root or credentials through this tool.

The desk driver module exports the adapter using its existing isolated host:

```js
import { createDriver } from '/absolute/repository/scripts/harness-tax/adapters.mjs';
import { host } from '/absolute/desk/provisioned-measurement-host.mjs';
export const execute = createDriver(host).execute;
```

The provisioned host is an explicit integration dependency, not included account
configuration. No live integration is claimed by the stub proof. Its ports are:

| Port | Required behavior/evidence |
|---|---|
| `inspect(target, request)` | Read actual model, root, login, demo bot/channel, machine and epoch. Return `disposable`, `live:false`, `receipt`, and all five `floors` booleans: `secrets`, `spendCap`, `stop`, `uniqueSend`, `durableIntake`. Check standing against the actual installation, not target labels. |
| `prepare({request,target,recipe})` | Initialize once per task/arm, write only the current stage's fixtures, start that isolated agent using existing lifecycle tools. Return `requestId`, `model`, `receipt`; 2.0 also `copyLineage`, `ablated`. No raw root or credential cloning. |
| `boundary(name,{request,target})` | Fresh/new-session/restart/compact/move-machine through existing bounded controls. Return `receipt`, `actual:true`; restart has distinct before/after epochs, move has distinct machines, compaction has distinct context IDs. Unsupported capability returns `state:"unsupported", actual:false, reason, receipt` without dispatching that boundary. The adapter skips prompt dispatch/collection, meters preparation and boundary costs, and captures and grades an unsupported result; it cannot pass correctness. Missing evidence or an ambiguous boundary still stops the run. |
| `executeBounded(...)` | Bare CLI through existing physical resource and credential boundaries. Capture effective model, actual usage and tools/artifacts. Honour `deadlineMs`, `remainingCalls`, abort signal and stop. Record exact child PIDs and retire only owned processes. No inherited serving credentials or unrestricted shell. |
| `sendAsDemoUser(...)` | Existing 1.x user-role sender (or 2.0 proof-room sender), durable idempotency key `request.id`; return `messageId`, `receipt`. Never send as the tested bot or to the live channel. |
| `awaitReply(...)` | Return `inReplyTo` matching the sent message, `model`, `state`, `responderMachine`, reply, artifacts and evidence. Earlier/unrelated replies cannot satisfy it. |
| `collectMessages(...)` | Observe without sending; return all outbound messages for the due window and `completeWindow:true` only for a complete read. A bounded paginated miss remains unknown. |
| `meter(...)` | All preparation, boundary, model, tool and extra-call costs plus breaches, including unsuccessful calls. Return `totals:{tokens,calls}` and `costs:[{id,part,tokens,calls,wallMs,evidence}]`. |

The host must enforce remaining-call/spend limits before **each** call, and
finite process lifetimes independently of the runner. Runner cancellation alone
is not containment. Each model call records the observed effective model; no
quiet fallback is allowed. Model settings include the same thinking/output
settings at host provisioning, bound into the isolation receipts. Distinct
accounts prevent concurrent harnesses contaminating one another's session cache.

These ports reuse the 1.x `LiveTestHarness`, `RealChannelDriver`,
`TelegramLiveSender` and `LiveTestRunner` pattern: inspect the demo channel before
sending, correlate after the sent message, require observed seat movement and
retain unsupported/uncertain evidence. The isolated-home and explicit boundary
pattern comes from `tests/e2e/compaction-harness.ts`. Large 1.x modules and their
live configuration are not transplanted. No proof-room launcher is modified.

## Grading, cost and judgments

The independent grader module exports `grade({task,result,requestId,history,finalStage,remainingCalls}, {signal})`. A person
or a separately metered model reads the rubric, full observations, artifacts,
prior-stage evidence and actual delivery/boundary receipts. It returns:

```json
{
  "reviewer": "independent-reviewer-reference",
  "resultDigest": "sha256-of-JSON-result",
  "correctness": "pass",
  "trust": {
    "consistentAnswers": "pass",
    "decisionRecall": "pass",
    "constraintsHonoured": "pass",
    "noFalseDone": "pass",
    "promisesKept": "unknown",
    "honestLimits": "pass"
  },
  "reason": "Separately falsifiable explanation of observed behavior.",
  "evidence": ["artifact-or-delivery-receipt"],
  "cost": {"tokens": 0, "calls": 0, "wallMs": 0, "evidence": "human review"}
}
```

Compute `resultDigest` using exported `digest(result)`. Only the task's relevant
trust dimensions are mandatory; irrelevant dimensions display `n/a`. Missing
evidence gets `unknown`, never an implicit pass. Grade actual actions and claims
by meaning, not presence of a keyword. A correct claim of inability can pass
honest-limits while the requested task fails. Empty delivered bubbles fail
correctness; an empty memory candidate is not an empty delivered bubble.
Uncertain/undecided Jev or review output is evidence of uncertainty, never a
successful task verdict. Recorded observations retain exact bytes and hashes.

Interim grades may remain unknown while a promise is not due. Final-stage grading
receives every earlier stage's observations and judges the whole task. Cut
eligibility compares these complete-task scores; all interim stages must still
have complete captured execution and metering. The grader must honour the
remaining call budget, deadline and cancellation; its full input is saved before
it runs, without exposing it to the target agent.

Each cost names a catalog part, classified infrastructure or compensating.
Charge each input, output, cache-read and cache-write token once, and each actual
model call once. Attribute shared prompt costs with a documented tokenizer or
allocation method in `evidence`; do not charge the whole call to every prompt
line. Attribute boundary/extra calls to the part that caused them. Sequential
wall-time allocations reconcile against the runner's monotonic wall time;
unallocated host time is explicitly `harness-runtime`. Overlapping spans need
an allocation, not double counting. Missing metering is `null`, never zero.
Grading cost appears separately in the same table. A missing call meter stops
further dispatch because remaining liability is unknown.

Use `partVerdict(partId, baselineRows, ablatedRows, judgment)` to validate and
record an independent `keeps-its-cost` / `cut` / `change` judgment with separate
reason and evidence. A cut requires matched live 2.0 rows for every stage of all
twelve tasks, the same model, complete metering, no breaches, no unknown scores,
and no correctness/trust regression. A lower cost alone does not decide a cut;
the reviewer must explain useful savings and confidence, including run order and
repeat variability. Infrastructure is never cut just for costing time/tokens.
Without live paired evidence the disposition is `change` with reason
`measurement needed`, not a claim that a part harms the model.

The report includes a variant and part-judgment column. After independent review,
write an array of `{part,verdict,reason,evidence}` objects to a desk JSON file and
run `node scripts/harness-tax/runner.mjs compare BASE_ROOT OFF_ROOT JUDGMENTS.json`.
It validates the paired judgments and renders one combined table. Unjudged parts
remain `change (collect paired live evidence)`, an outstanding measurement rather
than an instruction to remove infrastructure.

## Correction tags and A/B switches

`parts` in `catalog.mjs` lists three independently removable coaching parts with
their failure, exact source and switch. `ablate(copy, part, receipt)` performs
one switch on an explicitly marked disposable source copy and saves original
bytes plus hashes. The copy needs `harness-tax-copy.json` exactly equal to
`{root,disposable:true,sourceDigest}` from its provisioner. Rebuild the copy and
use its normal checks/activation process before starting it. The host attests
that the running copy matches the ablation manifest. A/B runs have identical
fixtures, model and limits and fresh state, changing exactly one part. Rollback
means discarding the test copy and making another from the recorded seed.

Record a correction in JSONL with this shape (one record per correction version):

```json
{
  "tag": "copy-coaching",
  "kind": "compensating",
  "failure": "Literal copying drifted through paraphrases.",
  "source": "tests/preview/briefing.ts#LITERAL_COPY_INSTRUCTIONS",
  "introducedBy": "commit-or-recorded-finding",
  "switchOff": {"tool": "ablate", "part": "copy-coaching"},
  "floorsRetained": ["secrets", "spend cap", "stop", "no duplicate sends", "durable intake"],
  "baselineRun": "experiment-reference",
  "offRun": "experiment-reference",
  "verdict": "change",
  "reason": "Paired live evidence not yet collected.",
  "evidence": ["run-reference"]
}
```

Packet transport, answer JSON grammar, stored certainty/provenance, required
mind-rule delivery and delivery enforcement are infrastructure dependencies,
not removable coaching lines. Their cost is still measured. The historical
instruction to put all reasoning in output is a corrected compensating part;
this runner does not reintroduce it to produce a baseline. A proposal to remove
binding rule delivery would require constitutional change, outside this task.

## Failure and recovery

Intents are fsynced before dispatch, captures before grading, final rows before
advancing. An ambiguous send is never automatically retried. On interruption,
the desk reconciles the intent with host receipts and may finish grading the
existing capture; it must not resend to obtain cleaner evidence. A crash lock
names the exact owning PID. Remove it only after checking that process is gone
and reconciling open intents. A `STOP` file prevents new dispatch; the host owns
in-flight stop. Private target/grader errors are not printed. Local artifacts
use owner-only permissions and remain under desk custody. No raw reply text is
rendered in the comparison table. No load test, serving login or live message
is part of verification.
