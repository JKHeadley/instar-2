# Change review — answer after a failed tool-assisted model turn

Subject base: 9e04f28e9ef5d7c623e43e3197fde4620d8bd5c8
Review state: open
Reviewed content: none
Outcome: a failed model invocation after recorded tool results settles through the existing unique failure-notice path, instead of leaving the operator without an answer; no tools or uncertain effects are replayed and the requested task is explicitly unverified.
Affected rules: 4, 26, 34, 36, 42, 49, 55, 60, 63, 70, 74, 77, 89, 95, 101, 102, 113, 116
Affected floors: secrets — the notice contains only a bounded count, never tool inputs, results or error strings; spend cap — original reservations stay charged and no recovery model call is added; stop — stop and existing admission checks precede recovery and all sends; no duplicate sends — existing durable intent/receipt path sends at most once, including unknown sends and restart; durable intake — the original request, trace and uncertain model outcome remain recorded.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: changes failure settlement on the operator reply path, with no new execution or delivery authority.
Side effects: a rejected or uncertain tool-assisted turn with complete paired results and no children now carries a bounded tool-check count into the existing uncertainty notice. A shell error does not itself trigger recovery when the model answers. A missing trace result, child work, admission refusal or stop does not enter this path. Failures without tool results retain their old behavior.
Undo and recovery: revert the two runtime-file edits. The additive optional count does not change the journal format version; older readers ignore it and retain the existing generic unknown-answer notice. No retry, budget refund, new queue or send route is introduced.
Multi-machine posture: the current conversation owner records the result and uses the existing ownership-gated journal send. Tool execution evidence is machine-local and retained in that owner's journal; no new cross-machine state or replay authority is introduced.
Layer below: inspected the native Codex provider's nonzero terminal handling, the conversation-session owner's no-replay guards, runToolTurn cleanup and durable trace, and the journal's unknown-answer intent and receipt path. Inspected 1.x SessionManager process-exit classification and DeliveryFailureSentinel (now src/monitoring/delivery-failure-sentinel.ts) with its recovery-policy module. Reused their distinction between incomplete work and completion, bounded settlement and no replay on ambiguous effects. Their tmux respawn and Telegram retry engines do not fit a failed model answer and are not transplanted.
Bug class: integration
Bug evidence: reproducer=tests/preview/tool-failure-answer.test.ts
Validation: 21 focused cases cover the recorded failed invocation, actual captured model shapes, ambiguous send and restart, stop, incomplete traces, successful answers after individual tool errors, and both ends of the durable count bound. Existing unknown-answer notice tests pass 7/7.
Hook bypass: none
Convergence: none
Decision: t4-failure-notice | use the existing durable uncertainty notice after complete tool traces, with a bounded result count, instead of replaying a failed model turn or inventing a Mac handoff | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/t4-tool-failure-answer-1027-PROGRESS.md
Prompt review: no model prompt changes. Real T4 update 46040734's prompt, six admitted tool inputs/results, null answer and exit 1 are replayed. The capture does not include native terminal stdout: the exit is injected at the local invocation boundary, not represented as a full provider-stream replay. Recorded summary-writer 715672480, uncertain summary 715672483, Jev undecided 715672482, Jev unsure 969389570, reply-review 969389923, delivered reply 715672479 and empty candidate 715672550 exercise unchanged completed-output or uncertain-output handling. The empty candidate is not claimed to be a delivered empty bubble. Isolated offline tests only; no live agent mutation or Telegram probe.


Prompt finding: 4106b49fff07 | quoted-evidence | Unchanged text-only obligation guidance is copied in the topic-awareness regression to compare text-only and tool-routed packets. It describes the route's actual lack of external attempts, not a keyword verdict or an expected answer to the operator.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged deterministic empty-memory projection and its history classification. The test pins the renderer's literal output; this text does not decide user intent or substitute for model judgment.
Prompt finding: 85544c20941f | protocol-literal | Unchanged generated login-outage notice and exact notice validator. The regression pins that public protocol text; it does not supply an answer to a model judge.
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged provenance instruction names the packet's sourceLabel field. The fixture pins citation guidance rather than using a phrase as authority to accept or refuse a reply.

simplestRobustRoute: This is the simplest route: reuse the journal's existing failure notice and unique-send guards after the tool runner records paired attempts. The only new durable fact is a bounded count needed for an honest report of what was attempted; no task facts are inferred from raw results. Existing stop, admission, byte/count, ownership, durable-intent and receipt guards remain. A continuation would add another paid call and require evidence that every outward effect was absent; this repair makes no such unsupported assumption. Shipped-path unattended live completion is not claimed; the desk owns live acceptance.
80/20: repair the observed silent failure with a small change, replay the recorded case and nearest safety neighbours, and leave unrelated retry machinery unchanged.
VERDICT: author submission; independent convergence is not claimed
