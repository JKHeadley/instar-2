# Change review — Codex conversation protocol compatibility

Subject base: ac3bd4d8874495f8b66b571837a1380995113d7a
Review state: open
Reviewed content: none
Outcome: Provide Codex-specific persistent-thread request mapping and bounded identity-bound turn/reply reading, with real CLI protocol captures and an explicit common-host integration contract. This is the brief's permitted partial compatibility delivery, not a production worker or live acceptance claim.
Affected rules: Purpose 2/3/6; Rules 1, 4, 5, 26, 30, 34, 36, 42, 49, 59, 60, 65, 69, 70, 74, 75, 95, 96, 101, 102, 111, 113, 115, 116.
Affected floors: secrets — isolated credential-free local probe, host keeps credential custody and outbound checks; spend cap — existing external checkpoint remains mandatory, cumulative usage is not authority; stop — exact interrupt mapping and host admission-first stop contract; no duplicate sends — deduplicated output items and no dispatch/retry in mapper; durable intake — existing owner retains inputs, attempts and raw captures before projection.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: New parser of model-harness protocol and request mapper, not yet on a registered production path. Desk real walk is the explicit acceptance tier.
Side effects: None in the existing runner: no consumer is switched. A caller could misuse this low-level protocol by treating cumulative usage as per-turn cost or resending an uncertain turn; the output type and host contract make these limits explicit. Exact thread/turn binding prevents another turn's text closing this one. Reply and item bounds preserve an unverifiable result rather than send truncated output.
Undo and recovery: Revert this additive module, its documentation and tests before integration. No durable format or installed root changes. Host raw frames reconstruct reader state; a lost transport does not permit input replay.
Multi-machine posture: Reader state is deliberately machine-local and disposable. Conversation ownership, durable intake, capture replication and send deduplication remain in the common host. Thread cache can be resumed only where available; another machine must reconstruct complete context through the existing owner path.
Layer below: Read both governing documents in full, existing session driver, per-call Codex parser/configuration, adapter first-input bindings and lane A conversation component at 11c40b11. Generated protocol types from installed Codex 0.156.1 and captured actual notifications against an isolated loopback SSE provider. No serving authentication used.
Bug class: integration
Bug evidence: reproducer=tests/harness-adapters/codex-conversation.test.ts
Hook bypass: none; core.hooksPath unset and actual shared hooks directory contains sample hooks only.
Convergence: none
Prompt review: No model instruction added or changed. Tests replay actual outer Codex notifications from a fabricated local provider; text/usage are explicitly synthetic. Production declaration stays unproven. The brief assigns real recorded walk acceptance to the desk and waives recorded-journal replay as a READY precondition.
Decision: codex-worker-1013-protocol | Use a small pure app-server mapping and turn reader inside the Codex adapter boundary, avoiding another terminal scraper or worker journal. Common transport integration stays with the desk's shared contract. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/codex-worker-1013-PROGRESS.md
Decision: codex-worker-1013-evidence | Only exact completed turn evidence exposes final reply text; failures, interruptions, empty bubbles, conflicting/oversized output and transport loss cannot become a successful reply. Cumulative tokens are explicitly not per-call metering. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/codex-worker-1013-PROGRESS.md
Decision: codex-worker-1013-probe | Exercise the installed CLI with an empty private home and loopback fake SSE provider, preserve unchanged outer notifications, and distinguish that real protocol evidence from paid model, tool-hook, connected-account and user-surface acceptance. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/codex-worker-1013-PROGRESS.md
simplestRobustRoute: This is the simplest robust route for the permitted compatibility slice: use native structured thread/turn messages and a small disposable reader. It prevents the credible failure seen in the real probe, where a reply item exists but the turn later fails. No new queue, journal, retry or authority is introduced. Start/limit guards belong to the existing admitted host; the reader bounds output and requires exact terminal evidence. No unattended production completion is claimed; the desk owns the recorded walk.
80/20: Target the new module's direct test and required static/READY checks; no full suite or independent-convergence claim.
VERDICT: author submission; independent review belongs to the desk
