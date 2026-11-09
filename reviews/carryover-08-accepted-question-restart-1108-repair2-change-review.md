# Change review — Carryover 08 repair 2: a never-dispatched requeue clears the old claim's replay marker

Subject base: 1992d7e0d12e5e545129ac2fe00f62731fdc051a
Review state: open
Reviewed content: none
Outcome: Repairs the round-2 unit-review must-fix. The unsent requeue branch in recover() now clears rerunFor in the same save, as the ordinary replay branch already did. Before this, a replacement dispatch kept the previous claim's marker, so after it accepted the question and the host was cut before any tool, the next restart could neither record fresh eligibility (rerunFor already set) nor honour the old one (bound to another claim), and the question settled uncertain. It now completes with exactly two deliveries. Row 08 stays OPEN for the desk's live restart proof.
Affected rules: 2, 46, 68, 101, 102, 105, 116; architecture R105.
Affected floors: secrets — no new content, credential or outbound surface; spend cap — unchanged: re-run still requires spent < maxCalls under the original allowance and parent lifetime; stop — unchanged guard precedes replacement and dispatch; no duplicate sends — the requeue branch already required positive notDispatched evidence, and the fresh claim's eligibility is still recorded only for a settled process with an unchanged tool count, under three attempts, with recovery allowed; the claim comparison is kept; durable intake — the field is cleared in the same existing snapshot write that requeues the input.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes which durable evidence permits re-running accepted work after a host restart.
Side effects: None beyond the field value: the existing unsent-requeue save now also writes rerunFor: null. No added write, timer, store or service. Generated register outputs replayed to the repair source commit. The native Darwin conformance certificate is stale for the new composition bytes (R105) and needs the desk's Studio re-pin.
Undo and recovery: Revert the repair commits and replay the register; the stale-marker stranding returns.
Multi-machine posture: Machine-local, as before: the field lives in the owning host's conversation snapshot under the existing ownership fence and is read only by the owning host's recover().
Layer below: Read docs/00-the-purpose.md and docs/01-the-rules.md. 1.x JKHeadley/instar at c2300451e37c98e592ea8d2c260c56fb7b1c901a (v1.3.1402): src/messaging/stuckMessageRecovery.ts recoverStuckMessages calls MessageProcessingLedger.reclaimStuck, whose UPDATE (MessageProcessingLedger.ts:204-205) re-stamps reply_epoch and processing_started_at at the current epoch on every re-claim, so no earlier holder's replay state survives a requeue; this repair applies the same rule to the 2.0 unsent requeue branch, matching the ordinary replay branch. Inspected recover(), the two requeue branches and the reviewer's reproducer patch.
Bug class: unit
Bug evidence: reproducer=tests/assembly/production-conversation-session.test.ts
Hook bypass: none; no bypass flag was passed.
Convergence: none
Decision: C08-1108-R2-CLEAR-MARKER-ON-UNSENT | Clear rerunFor inside the existing unsent requeue save rather than relaxing the eligibility filter or the claim comparison, so every input re-entering the queue starts without a marker and the claim binding stays strict. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-08-accepted-question-restart-1108-repair-140620-PROGRESS.md
Prompt review: No prompt text, parser or model verdict changed; the requeued input renders through the unchanged conversationSessionPrompt.
Prompt finding: 0725f0150c56 | protocol-literal | Unchanged role/refusal prologue asserted by the existing briefing test; this repair edits no prompt text.
Prompt finding: 27d7720e7977 | protocol-literal | Unchanged memory-record boundary delimiter and fixture assertion; not a semantic classifier.
Deferral: generated/register.json:1 | not-a-deferral=mechanically replayed register descriptions introduce no deferred work

Subject (9 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, src/assembly/production-conversation-session.ts, tests/assembly/production-conversation-session.test.ts

## Verification

New test 'review: non-dispatch transfer must not retain a previous claim replay marker' (the reviewer's reproducer): fails with the fix removed ('uncertain' instead of 'complete'), passes with it. production-conversation-session.test.ts 218/218. Importers production-session-driver, socket-drop-replay, codex-conversation-worker, journal-conversation-session, topic-worker-capacity and pool-quota-live: 350 passed, 1 skipped. tsc clean; register check and register wiring pass; architecture check's only finding is R105 (Studio re-pin).

## Closing block

simplestRobustRoute: One field cleared in an existing save, matching the other requeue branch; no new mechanism.
80/20: One must-fix closed with a one-line change and the reviewer's regression; live restart proof remains with the desk.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
