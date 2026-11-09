# Change review — Carryover 08 repair: keep the re-run disposition across a cut after retirement

Subject base: 760d5ddea0afcbff0fc9f7733bb5ded5265ca4ba
Review state: open
Reviewed content: none
Outcome: Repairs the two round-1 unit-review must-fixes. (1) The re-run eligibility for an accepted no-tool question is recorded durably on the input (rerunFor, bound to the retiring claim) before retire() durably clears the claim, so a host cut right after retirement no longer strands the question uncertain; after confirmed closure the claim binding, three-attempt bound, unchanged tool count, recovery permission and remaining allowance are rechecked before requeue. (2) The supported native Darwin conformance declaration is renewed from an actual passing native contract run on the changed composition. Row 08 stays OPEN for the desk's live restart proof.
Affected rules: 2, 14, 26, 42, 46, 63, 68, 70, 74, 101, 102, 105, 111, 113, 115, 116; architecture R105.
Affected floors: secrets — no new content, credential or outbound surface; spend cap — requeue still requires spent < maxCalls and uses only the original allowance and parent lifetime; stop — unchanged guard precedes replacement and dispatch, a stopped host never drains the requeued input; no duplicate sends — the recorded disposition only carries the claim-bound evidence (settled process, no open child) across the cut, and the post-retirement tool-count, attempts and contextRecoveryAllowed checks still refuse a re-run with any tool or unknown send; a disposition bound to another claim is refused; durable intake — the original request remains in the encrypted conversation snapshot and the disposition is written in the same store before retirement.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes the durable evidence that permits re-running accepted work after a host restart, and renews native conformance evidence.
Side effects: One additional conversation snapshot write in recover() when, and only when, an input is eligible for re-run (before retirement). The input gains an optional rerunFor field, set to null on requeue. The native self-host declaration digest moves from sha256:3139c2adcf49290756f3f0d2c29cbe2b8cf28f487c8c335fa97fb7bfe98c537f to sha256:2f31b1a2c3513c49ed836d0f4b2cad02712310da0c8d15ca2e19d88fd2ffb889 (276 files, Node 24.14.1) via the desk's evidence-checked renewal. Generated register outputs are replayed to the repair source commit. No timer, store or service added.
Undo and recovery: Revert the repair commits and regenerate publication; the older reader ignores rerunFor and the narrower stranding gap returns. The old certificate cannot certify the current bytes.
Multi-machine posture: Machine-local, as before: the disposition lives in the owning host's conversation snapshot under the existing ownership fence and is consumed only by the owning host's recover() after confirmed retirement. The certificate binds only the exact Darwin runtime and composition measured on the Studio.
Layer below: Read docs/00-the-purpose.md and docs/01-the-rules.md. 1.x JKHeadley/instar src/messaging/stuckMessageRecovery.ts recoverStuckMessages and MessageProcessingLedger keep the claim on the ledger row until the replay disposition is written; this repair applies the same ordering (durable disposition before identity is discarded). Inspected 2.0 retire(), recover(), processSettled() and the reviewer's reproducer patch, and the desk pipeline/merge-live-conformance.mjs renewal tool.
Bug class: unit
Bug evidence: reproducer=tests/assembly/production-conversation-session.test.ts
Hook bypass: none; no bypass flag was passed.
Convergence: none
Decision: C08-1108-R1-DURABLE-DISPOSITION | Record the claim-bound re-run eligibility on the input before retirement rather than folding the requeue into retire()'s save, so the post-retirement notDispatched priority, tool-count recheck and allowance checks keep their existing order. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-08-accepted-question-restart-1108-PROGRESS.md
Prompt review: No prompt text, parser or model verdict changed; the requeued input renders through the unchanged conversationSessionPrompt.
Prompt finding: 0725f0150c56 | protocol-literal | Unchanged role/refusal prologue asserted by the existing briefing test; this repair edits no prompt text.
Prompt finding: 27d7720e7977 | protocol-literal | Unchanged memory-record boundary delimiter and fixture assertion; not a semantic classifier.
Deferral: generated/register.json:1 | not-a-deferral=mechanically replayed register descriptions introduce no deferred work

## Verification

New test 'carryover 08 re-run survives a host cut after durable retirement only with its recorded evidence' (none / not-allowed / other-claim / tool-count): the positive case completes with exactly two deliveries; three refusal neighbours stay uncertain with one delivery. With the pre-retirement persist disabled all four fail. production-conversation-session.test.ts 217/217. Native contract: 9/10 before (only the stale certificate), 10/10 after renewal. Architecture checks, lint and register check pass.

## Closing block

simplestRobustRoute: One optional field on the existing input record, written through the existing persist before retirement, reusing the existing recovery path; no new service or timer. Every existing stop, authority, effect, allowance and lifetime check is preserved and the tool-count check now runs after confirmed closure.
80/20: Two must-fixes closed with one durable field, one regression with refusal neighbours, and an evidence-backed certificate renewal; live restart proof remains with the desk.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
