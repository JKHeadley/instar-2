# Change review — a turn stays open while the harness reports background work

Subject base: 5a5fdc9176676196fca2735740f19388ea2ef40b
Review state: open
Reviewed content: none
Outcome: when a session's turn ends with helpers or background shells still running and no result written, the runner keeps waiting for the session's later turns and delivers the result once it is written. When the work ends with no result, the existing unknown-answer path applies. Live case: operator update 969390684, where the agent finished the job and the runner had already sent "Completion of your request is unconfirmed".
Affected rules: 26, 30, 34, 37, 43, 49, 55, 62, 70, 74, 76, 77, 114, 116
Affected floors: secrets — the receipt gains one integer; task descriptions and commands stay out of it; spend cap — no model call or reservation changes, and helpers still pass the same checkpoint; stop — stop authority is checked before this code and still ends the wait; no duplicate sends — one reply per turn end through the unchanged cursor, shown by the exactly-once test; durable intake — the input stays accepted and durable throughout the wait.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: it changes what ends a conversation turn on the live reply path, in a small diff using an existing receipt.
Side effects: a turn with no result now stays open while background work runs, so later messages in that conversation queue behind it as they do behind any long turn. A background shell that never ends, with no result written, holds the turn until the existing deadline, which ends in the safety-limit notice and halts that conversation instead of the earlier immediate unknown-answer notice. The independent deadline watchdog no longer treats a Stop that names running work as a close. Delegated session steps use the same driver and gain the same wait.
Undo and recovery: revert the commit. Receipts with the extra field are read as before by the old driver, and the journal's backgroundStop field is ignored. No migration is needed in either direction.
Multi-machine posture: machine-local, deliberately. The Stop receipt and session journal already live on the machine running the worker; this adds one field to each and no replicated state.
Layer below: read the real payloads of Claude Code 2.1.280, the pinned harness, and 2.1.319 with a logging hook: the Stop event carries background_tasks, each finished task wakes the session for another turn, and the last Stop lists none. Also read the admission gate, which closes a default-background Agent edge at launch because the call's input omits run_in_background; recorded below as residue.
Bug class: live-path
Bug evidence: reproducer=tests/assembly/production-conversation-session.test.ts; other=tests/integration/session-stop-hook.test.ts
Hook bypass: none
Convergence: none
Decision: stb-harness-signal | Use the harness's own background_tasks list on the Stop event, which covers helpers and shells and is true at the moment of Stop. Rejected parsing the agent's words (Rule 10), and SubagentStop tracking, which covers helpers only and leaves a race between the last helper ending and the old Stop. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/session-turn-background-1107-PROGRESS.md
Decision: stb-result-ends-wait | A result with a Stop closes the turn even with work still running, keeping today's delivery for an agent that answered and left a task going. A result first seen under a Stop already held belongs to a turn still running, so the driver waits for that turn's own Stop. Pane idle cannot decide this: the 2.1.280 pane is not idle while tasks run. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/session-turn-background-1107-PROGRESS.md
Decision: stb-existing-deadline | The wait adds no timer of its own; the existing turn and worker deadlines bound it, as the brief requires. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/session-turn-background-1107-PROGRESS.md
Decision: stb-codex-unchanged | No Codex change. Codex reports its turn through the app-server reader, its async children already hold an open edge, and the brief forbids inventing a mechanism where the harness reports none. The field is Claude-specific data read only in the Stop hook, so no harness name is compared outside its adapter. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/session-turn-background-1107-PROGRESS.md
Decision: stb-gate-edge-unchanged | Leave the admission gate's edge handling alone. Holding those edges open would make the existing 'turn ended with pending child work' check retire a worker that answered, and the outcome does not need it. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/session-turn-background-1107-PROGRESS.md
Prompt review: no model instruction, prompt or output parsing changes. The new tests only touch a test file that already pins shipped guidance, which raises the two findings below.
Prompt finding: 0725f0150c56 | protocol-literal | existing conversation-prompt wording, unchanged by this change — fixture-phrase src/assembly/production-conversation-session.ts <- tests/assembly/production-conversation-session.test.ts: "use them to answer and act within that role; a tool refusal remains a refusal."
Prompt finding: 27d7720e7977 | protocol-literal | existing conversation-prompt wording, unchanged by this change — fixture-phrase src/assembly/production-conversation-session.ts <- tests/assembly/production-conversation-session.test.ts: "this memory and work record"

Verification: nine tests fail on the base source and pass with the fix, including the incident sequence. Targeted files, typecheck and the real path were run on the Laptop: real tmux, real Claude Code 2.1.280, real stop.mjs and the real driver, unconfined, on both sides. Not run: the admitted gate with a live model, the live Telegram surface and the full suite.
Residue: gate-edge-record | medium | a default-background Agent call is recorded as complete at launch because its input omits run_in_background; the turn no longer relies on that record, but the record is still false.
Residue: start-delay | low | the five-minute gap before the session started was not traced to a cause, because the live journal is not reachable from the Laptop.

## Closing block

simplestRobustRoute: the outcome is that a turn is not over while the harness says work is running. The simplest route is to read the harness's own statement, which already arrives at the existing Stop hook, carry one count on the existing receipt, and skip the close in the existing driver branch. This proposal is that route. The one added field, backgroundStop, prevents a named failure: during a multi-helper wait the last Stop is stale when a later turn writes its result, so without it the runner could read the result before that turn finishes. Pane idle cannot do that job on the pinned harness. Limit guard: the existing deadlines. End state: the Stop reporting no work left, or a result with its Stop.
80/20: both sides are proven by tests and by the real harness through the real driver; what remains is the gate host's full suite and live proof.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
