# Change review — w3-sendstall: an uncertain Telegram send keeps the bridge's failure stage in its recorded reason

Subject base: 9224874095fa0f5453f7488b0c75d303831bb25d
Review state: open
Reviewed content: none
Outcome: In the 17:38 canary copy of cint-L12 92248740, update 969389787 was answered in 11 s and passed the Jev reply check; its signed intent was dispatched at 17:39:17.507 and the real Telegram bridge child returned an uncertain transport result 650 ms later. The runner recorded send-outcome {outcome:"unknown", reason:"transport transport"} and, by Rule 42 and the no-duplicate-send floor, never retried, so no reply was delivered before SIGTERM. The reply check, reply review, ownership, stop and lease were all clear; the Telegram call itself failed once (a getMe through the same bridge passed 34 s later). The defect fixed here is that classifyTelegramSend discarded the bridge's closed stage name, so the lost send cannot be told apart as a connection never opened, a child that died or a body that never arrived. The reason now reads "transport <limitation> at <stage>" for the bridge's nine closed stage names and drops anything else. A desk-side switch fix (separate, in the lanes) moves the browser-lock wait before pausing live, which was the 15:12 copy's 18-minute delay.
Affected rules: 42 (one closed send classification; unknown stays unknown, never retried, now with its stage), 37 (source fix at the one classifier), 74 (this record), 116 (one string field kept; no retry, no new state, no new port)
Affected floors: secrets — unchanged (only closed stage names are recorded; free text from a reply is dropped); spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged (no retry added; the custodian contract sendMessage:HTML:hiddenRetries=0 holds); durable intake — unchanged
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: only the recorded reason string of an already-unknown send changes; classification kinds, send path and retries are untouched
Side effects: the regression test loads the untyped production transport module dynamically (typed at the call site); new send-outcome rows carry " at <stage>" after "transport <limitation>"; old rows replay unchanged
Undo and recovery: revert this commit; no persistent shape changes (the reason is free text already)
Multi-machine posture: none; per-journal classification, the same on every host
Layer below: src/assembly/telegram-bot-api-bridge.mjs uncertain() stage names and scripts/production-boot-io.mjs settle (unchanged)
Bug class: live-path
Bug evidence: reproducer=tests/preview/journal-send-outcome.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-sendstall-evidence/timeline.txt
Hook bypass: none
Convergence: none
Prompt review: no prompt text changed

Subject (2 paths): tests/preview/journal-send-outcome.test.ts, tests/preview/telegram-send-outcome.mjs

## Closing block

simplestRobustRoute: keep the stage the bridge already reports in the one classifier's reason; no retry and no new record kind
80/20: 0 must-fix, 1 note (a safe single retry when the bridge proves the request never left the machine needs a closed connect-cause from the bridge and a change to the declared hiddenRetries=0 contract; that is an operator/desk decision, not taken here)
VERDICT: author submission; the independent verdict is recorded as a pass
