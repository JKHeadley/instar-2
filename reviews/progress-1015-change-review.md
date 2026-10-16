# Change review — activity-backed progress during an operator answer

Subject base: a1b59d03faad205e33fc33dc6915825abfecb635
Review state: open
Reviewed content: none
Outcome: Send bounded truthful progress from a live continuing conversation's current admitted tool at about 2, 5 and 10 minutes after durable intake, then every 10 minutes; stop before final reply dispatch. Reuse the journal send path, agent provenance and retrospective review.
Affected rules: 1, 2, 4, 32, 33, 34, 36, 37, 41, 49, 52, 55, 57, 58, 60, 61, 63, 68, 70, 74, 75, 84, 87, 89, 90, 91, 101, 102, 105, 111, 112, 113, 116
Affected floors: secrets still pass checkOutbound; no extra model call or widened spend allowance; stop and expiry fence progress; durable signed unique intents precede sends; UNKNOWN never retries; durable intake unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: user-visible asynchronous send path with durable replay, cancellation and existing send-budget integration.
Side effects: progress uses the same HTML body encoding as answers, with the signature bound to encoded bytes and retrospective text kept plain; progress consumes the ordinary reply allowance, leaving one slot for an answer; it appears as signed agent speech and in retrospective cases. A small runtime guidance field tells the working agent how its descriptions may be quoted. No invocation prompt policy, credential, activation or harness selection changes. The native macOS self-host composition certificate requires the desk's contract run.
Undo and recovery: revert the runtime change together; retain the new journal row readers for any journal that has recorded workingProgress. Current restarts retain cadence/unknown outcomes and require fresh activity before sending; no uncertain send is replayed. No deployed files or Studio state changed by this unit.
Multi-machine posture: send intents, cadence and receipts live in the existing encrypted replicated journal under the current conversation owner. Activity observations are deliberately process-local, expire after ten seconds and disappear at turn end; a successor must observe its own live worker. Ownership loss uses the existing send fence.
Layer below: full purpose and rule book; durable journal held-notice intents and send-outcome projection; signed speaker counting; send current/admit checks through ownership and replication; continuing conversation adapter exit/pause/turn-end observations; existing bounded tool admission log and retrospective population.
Bug class: integration
Bug evidence: reproducer=tests/preview/working-progress.test.ts
Hook bypass: none
Convergence: none
Prompt review: the latest self-written tool description remains available between steps, explicitly labelled as the latest step so timer alignment with a short completed tool does not silently suppress useful progress. Runtime guidance describes the actual automatic path and requests truthful tool descriptions; no copied test phrase decides meaning. Existing recorded summary, uncertain writer, Jev uncertain/undecided, reply review and delivered/empty-context shapes are replayed through the progress path. Empty context is explicitly not claimed as an actually delivered empty Telegram bubble.
Decision: progress-existing-path | Reuse held-notice signed intents, outcomes and retrospective population with indexed working-progress slots independent of acknowledgement and final reply. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/progress-1015-PROGRESS.md
Decision: progress-real-activity | Quote current admitted tool description or tool and target, or explicitly label the latest self-written description between tools, only after a fresh live adapter observation; no guessed status or extra model call. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/progress-1015-PROGRESS.md
Decision: progress-cadence | Anchor 2/5/10-minute deadlines to intake, then ten-minute spacing, one send per step, no catch-up burst; final dispatch cancels and drains progress sends. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/progress-1015-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: observe the existing session lifecycle and tool-admission record, then reuse the journal's send and retrospective review paths. A cadence timer is necessary to speak during a slow in-flight tool; its activity predicate prevents timer-only invented status. Distinct durable ordinal slots prevent duplicate progress after restart; cancellation and awaiting admitted sends prevent a status arriving after the answer. No new model, sentinel daemon, authority or store is introduced. Start guards are admitted operator intake plus an actually live working session and current tool; end guards are answer dispatch, session completion/failure, stop, expiry and ownership loss; limits are one line per tool, bounded spacing, 280 characters and existing reply allowance. No unattended live proof is claimed: the desk owns proof-room validation.
80/20: 245 targeted tests passed with one host-dependent skip, including recorded-byte replay. The final launcher gate exposed an import above the shebang; the import now follows it and node --check passes; final gate outputs are recorded in the builder report. Independent landing review pending.
VERDICT: author submission; independent review pending
