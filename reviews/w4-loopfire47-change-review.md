# Change review — w4-loopfire47: a scheduled step's own JSON answer is read, not refused (plan #477)

Subject base: faf6b69cb82308d1f1bf1d90da1ce7d8c9a2adac
Review state: open
Reviewed content: none
Outcome: On live cint-L47 (4aae6c18, room two, group D, 15-minute root proofroom2-dshort15-20261004-022507) D1b, D2 and D1c failed although the d1 deferral was scheduled. Read-only decode of a copy of that journal: the deferral's commitment:3 step started at 02:43:47 (row 112, slot 02:43:42 = source 02:28:42 + 15 min) and the model answered in 11.6 s (row 114), but its output was one line of prose followed by {"outcome":"continue","note":...}, the JSON the step question asks for ("Return only JSON. ... {"outcome":...}"), not inside the Decision envelope the system prompt puts around a runner task's JSON. The launcher (journal-agent invokeSubscription) requires a Decision, so it recorded answer/decision/malformed/prose-wrapped-wrong-fields (model-json-shapes.json, 2 counts) and the step settled failed (row 116). Failed work is rescheduled one revisit after it (02:59:01); at 02:55:55 nothing was in flight or waiting, and nextWorkAt 02:57:19 was commitment:1 (the "— K" reply commitment, failed at 02:42:19 and again 02:57:45 for the same reason and, at 02:42, for a {reply, fulfilled} conclusion). The deferral's second step (02:59:35, row 197) returned a Decision and reported. A sweep of every preview root's obligation steps (decoded from copies): 14 of 26 had this unenveloped shape and every one was refused, including cint-L45/46's deferral twice (root 20261004-001216), each a finished report. w4-answerfail's repair (early close, floor field absence) does not cover it: this output parses, it is just not a Decision. Fix: for a canonical obligation step id only, the one object is read as the step's conclusion when it names an outcome and is no Decision attempt (no type, conclusion or floor field); its absent floor reads as the local floor exactly as decisionWithinFloor already reads a Decision with no floor, and the floor has one action. obligationDecision keeps every field check. Replayed: the 20 distinct recorded outputs verbatim; the 10 unenveloped ones now carry the model's own outcome (9 report, 1 continue), the other 10 read exactly as recorded.
Affected rules: 8, 22, 92, 97, 102 (deferred work finished on its revisit is held for the next message instead of settling failed), 95, 77 and 15 (the step's output is reviewed with the next reply before it reaches the operator, so its fail direction is toward the work the model did), 57 (no floor is defined, widened or chosen by absence), 42 (no refusal is converted: a Decision with the wrong conclusion and any non-task object still fail), 106 and 36 (tests replay the recorded outputs verbatim, with the journal path), 34 and 37 (both sides tested; 112 touched preview files green), 74 (this record), 101 (plain commits), 116 (one narrow reading at the one launcher parse site; no prompt, scheduler or frame change)
Affected floors: secrets — unchanged (only the model's own object is read; text around it is discarded as before, and obligationDecision redacts); spend cap — unchanged (fewer wasted steps; the obligation capacity and allowance still gate every step); stop — unchanged; no duplicate sends — unchanged (a report is still held for the operator's next message under the reply-only grant); durable intake — unchanged
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: it changes which model outputs the launcher accepts, for scheduled obligation steps only; answers, reviews and every gate keep their reading.
Side effects: model-json-shapes.json counts the newly read outputs as tolerated task-<shape> (for example task-prose-wrapped). An unenveloped step records no Decision reason.
Undo and recovery: revert these commits and this record; no journal frame or file format changed.
Multi-machine posture: machine-local, unchanged.
Layer below: parseModelJson and decisionWithinFloor (unchanged), obligationTaskAnswer (new, model-call-boundary.ts), invokeSubscription in journal-agent.mjs (the one launcher parse site for answers, tool-turn answers and work steps), obligationDecision in journal.ts (unchanged).
Bug class: none
Bug evidence: none
Hook bypass: none
Deferral: tests/preview/fixtures/obligation-step-outputs-live-2026-10-04.json:44 | not-a-deferral=a recorded live model output replayed verbatim as test data, not work this change defers
Deferral: tests/preview/fixtures/obligation-step-outputs-live-2026-10-04.json:62 | not-a-deferral=a recorded live model output replayed verbatim as test data, not work this change defers
Deferral: tests/preview/fixtures/obligation-step-outputs-live-2026-10-04.json:80 | not-a-deferral=a recorded live model output replayed verbatim as test data, not work this change defers
Deferral: tests/preview/obligation-task-answer-live.test.ts:136 | not-a-deferral=a test assertion on the product's fixed follow-up wording, not work this change defers
Convergence: none
Decision: loopfire47-task-json-obligation-only | the unenveloped reading is limited to canonical obligation step ids, whose question names the JSON and whose report is reviewed with the next reply; answers and gates keep the Decision requirement | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-loopfire47-PROGRESS.md
Decision: loopfire47-no-prompt-change | the step question's "Return only JSON" wording is left as it is: the acceptance fix is proven on every recorded output, while a prompt change could only be shown with new real-model calls; the model's continue on a deferral (live 02:43) is reported as a residual | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-loopfire47-PROGRESS.md
Prompt review: no prompt text changed. Model-facing acceptance changed: replayed every obligation step output recorded in every preview root (20 distinct, tests/preview/fixtures/obligation-step-outputs-live-2026-10-04.json), including cint-L47 commitment:3 slots 1791107022571 and 1791107941154 and cint-L45/46 root 20261004-001216 commitment:3; each unenveloped one now yields the model's own outcome, and no previously read output changed.

Subject (5 paths): reviews/w4-loopfire47-change-review.md, tests/preview/fixtures/obligation-step-outputs-live-2026-10-04.json, tests/preview/journal-agent.mjs, tests/preview/model-call-boundary.ts, tests/preview/obligation-task-answer-live.test.ts

## Closing block

simplestRobustRoute: the work ran and the model answered in the shape its own question asked for; the one launcher parse site now reads that object for scheduled steps, with no prompt, scheduler or frame change.
80/20: 0 must-fix, 0 notes.
VERDICT: author submission; the independent verdict is recorded as a pass
