# Change review — cint-L4 repair of the live canary: the Telegram long poll no longer freezes concurrent provider launches

Subject base: 9bb8bfdb92b17fb13bd58a586ddd02e31937a387
Review state: open
Reviewed content: none
Outcome: Live 2026-09-29 06:28 canary on a copy of the live journal: the probe got the held "lost my answer" notice after 48 s. Cause: the runner's getUpdates long poll ran as a synchronous child (spawnSync) and froze the event loop for its whole wait (~5 s per empty poll) while replies were drafted in the background. cint-L4's host resource owner needs several event-loop turns per launch (start-evidence query, durable ledger, gate, close), so the provider's 5 s version/auth preflight, its 2 s ps queries and the 2 s Jev abort all expired during a freeze before their finished children or responses were observed: the answer, review and retrospective calls went uncertain with no call-outcome row, Jev failed, the census failed. runner-frozen20 launched in one turn and mostly escaped the same race. Fix at the source: the transport gains poll(), the same limit-shimmed bounded child awaited asynchronously, and the poll cycle awaits it; short sends stay synchronous. The doorway map now observes only the model command, not the version/auth preflights (each successful preflight used to mark the model unavailable as error-frame). The self-host composition conformance is re-declared after re-running its contract (8/8).
Affected rules: 26, 37, 56, 60, 61, 70, 74, 116
Affected floors: secrets — unchanged, the credential still reaches the bridge only on stdin; spend cap — unchanged, no launch or reservation logic changed; stop — unchanged, the loop re-checks stop and signals right after the awaited poll as before; no duplicate sends — unchanged, sends and their journal intents are untouched and one poll is in flight at a time; durable intake — unchanged, updates are intaken exactly as before after the poll returns
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: changes the live runner's poll path and the physical Telegram transport every preview message crosses
Side effects: while a long poll waits, background drains, sends and acknowledgements can now run (previously frozen); a send may therefore overlap an in-flight getUpdates, which Telegram allows; the doorway map no longer flips to unavailable on each preflight and records a preflight failure as no observation
Undo and recovery: revert 30a3621e and ad1e0412, then regenerate the register; no durable format changed
Multi-machine posture: machine-local single runner per journal, unchanged
Layer below: docs/00-the-purpose.md and docs/01-the-rules.md; scripts/resource-owner.mjs run()/admit() timers and gate; src/assembly/production-provider.ts subscription preflight (5 s version and auth commands) and model timeout; tests/preview/doorway-map.ts subscriptionExchange/observeExchange; tests/preview/call-diagnostics.mjs observedSubscriptionIO; the copy status /tmp/l4-copy-status.json and the copy's resources.json and owned-launches.json
Bug class: integration
Bug evidence: reproducer=tests/integration/telegram-poll-concurrency.test.ts
Hook bypass: none
Convergence: none
Prompt review: no system prompt, provider policy or invocationPolicyDigest changed
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (11 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, scripts/production-boot-io.mjs, src/assembly/harness.declarations.json, tests/integration/telegram-poll-concurrency.test.ts, tests/preview/journal-agent.mjs

## Closing block

simplestRobustRoute: one asynchronous variant of the existing bounded transport child used only by the long poll, and one args check at the doorway observer; no timer heuristics, lag compensation or new subsystem (Rule 116).
80/20: the live composition is reproduced offline on both sides (async poll: the concurrent launch completes; the old synchronous transport: the same launch is judged timed out); tsc, lint, register:check and the touched runner and transport tests pass here, and the full gate and the desk canary rerun next.
VERDICT: author submission; the independent verdict is recorded as a pass
