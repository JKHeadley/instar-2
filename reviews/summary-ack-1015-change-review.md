# Change review — bounded reaction receipt wait

Subject base: c458547406d4ad8f3c7988f8247befb73775f618
Review state: open
Reviewed content: none
Outcome: Let a slow successful reaction response settle as accepted; retain explicit-failure text fallback and ambiguous-outcome non-replay. Summary repair is blocked on the recorded-call export size limit and is not part of this partial commit.
Affected rules: 13, 26, 36, 42, 55, 60, 63, 74, 87, 101, 102, 113, 116
Affected floors: secrets — existing bridge scan retained; spend cap — unchanged admission and accounting; stop — existing checks before dispatch and fallback retained, physical wait remains bounded; no duplicate sends — ambiguous reaction still forbids text fallback; durable intake — journal and dispatch claim unchanged
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One transport timeout with real loopback response and failure tests; no new authority or state.
Side effects: A synchronous reaction call can occupy its caller for up to ten seconds instead of half a second; a truly failed slow call can delay text fallback. It never declares success without the matching successful API response.
Undo and recovery: Revert this commit to restore the half-second bound; no persistent schema or state migration. Do not replay previously unknown reactions.
Multi-machine posture: Existing conversation-owner admission remains the single sender. The timeout is machine-local and introduces no shared state or new retry.
Layer below: Inspected the bridge AbortSignal timeout, noticeInvoke forwarding, and journal-agent dispatch/stop/ownership checks. Both file API read/download handlers reject the entire recorded export above maxFileSize and provide no bounded-read option.
Bug class: integration
Bug evidence: reproducer=tests/preview/telegram-acknowledgement-bridge.test.ts
Hook bypass: none
Convergence: none
Prompt review: No model-facing prompt, parser, routing or judgment changes. Only the physical reaction timeout changes; existing real recorded-shape acknowledgement tests pass.
Decision: summary-ack-1015-D1 | Use a finite ten-second reaction receipt allowance, conservatively covering the recorded 7–8 second intake-to-reaction observations without calling them transport latencies; preserve explicit failure and ambiguity semantics. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/summary-ack-1015-PROGRESS.md
Decision: summary-ack-1015-D2 | Keep summary behavior unchanged until the actual malformed outputs can be read; summary counts alone cannot establish a prompt/parser cause or justify removal. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/summary-ack-1015-PROGRESS.md

Subject (4 paths): tests/preview/telegram-acknowledgement.mjs, tests/preview/telegram-acknowledgement.test.ts, tests/preview/telegram-acknowledgement-bridge.test.ts, tests/preview/journal-poll-endpoint.mjs

## Closing block

simplestRobustRoute: This is the simplest route: adjust the existing bounded call so its actual response can settle, without adding a reconciliation service or retries. Existing admission, ownership, stop, receipt classification and transport deadline remain the guards. No unattended live success claim; no Telegram call was made.
80/20: Targeted unit, journal and real loopback bridge tests cover success after the old deadline, definite rejection with text fallback, and ambiguity without fallback. The desk owns independent review and live acceptance; summary work remains incomplete for missing recorded bytes.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
