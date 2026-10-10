# Change review — Live-state ability briefing

Subject base: 9d8089a6db175d9ed72ae30a7f8347b158301ffe
Review state: open
Reviewed content: none
Outcome: The answer capability source reports the current tool route, its covering grant, channel mode and scheduled-session availability from existing launcher state. A grant alone no longer makes a text-only route's note claim tools. Tools on names file reads/edits, commands, web fetch/search and subagents, alongside the existing generated reminders, recurring requests, summaries and limits. The current text/caption-only media boundary is explicit.
Affected rules: 1, 26, 34, 36, 49, 74, 78, 84, 101, 103, 113, 116
Affected floors: secrets — unchanged custody and redaction, no secret reads; spend cap — unchanged route/attempt guards and briefing cap; stop — unchanged activation and stop guards; no duplicate sends — delivery untouched; durable intake — journal and intake untouched
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes a source delivered to the answer model and aligns it with the existing tool-route constraint projection.
Side effects: Live capability-source bytes and digest change. The packet cache key includes the existing launch facts and limits, so a changed fact rebuilds the note. All generated feature descriptions remain. Offline callers without resolved launch facts keep the existing projection. Read-only inspect without launch authority still has no authoritative live state. The missing-register fallback limits its no-tools statement to this turn, preserving separately resolved scheduled sessions. No model policy, authorization, output parser or route predicate behavior changes.
Undo and recovery: Revert the source changes and generated pins together; no durable schema, journal record or grant migration is introduced. Earlier journals and captured fixtures remain byte-identical.
Multi-machine posture: Machine-local projection, deliberately. Each owning runner briefs its own resolved route, configured forum genesis and available session-work port. The existing conversation owner remains the sole sender. No new store or cross-machine authority.
Layer below: The launcher's toolsActive grant resolver, identityRefusal and toolPacketFits checks; the worker toolRoute consumer that constructs previewCapabilities/governingConstraints; generated feature declarations; sourcePacket and its provenance hash; sessionWork.port.available; the journal's text/caption intake and unreadable media placeholder.
Bug class: integration
Bug evidence: reproducer=tests/preview/selfdesc-live.test.ts
Hook bypass: none
Convergence: none
Decision: selfdesc-live-one-route | Reuse the existing resolved toolRoute predicate for both capability-note and packet constraints, distinguishing a covering grant from a currently available route. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-selfdesc-live-PROGRESS.md
Decision: selfdesc-live-runtime | Project forum genesis and scheduled-session availability per turn through the existing note; generated descriptions remain the source for reminders, repeating requests and summaries. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-selfdesc-live-PROGRESS.md
Decision: selfdesc-live-replay | Keep real captured bytes unchanged and replay source construction on their answer/review packets; this supplies offline regression evidence but cannot substitute for the mandatory fresh live-model and journal replay. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-selfdesc-live-PROGRESS.md
Prompt review: The new prose describes resolved runtime facts, not keyword-based intent or refusals. selfdesc-live.test.ts checks both sides and the real launcher's persisted model packet with physical provider/Telegram/macOS harness fixtures. Recorded prompts 6232224/6232229 and K11a 6232231 answer/review packets are read unchanged from fixtures/selfdesc-2026-10-04, and their capability source rebuilt for on/off. This is not a new model verdict. Observer 106's fresh live/proof-room journal replay, including uncertain summary/Jev, undecided review and empty delivered replies, is BLOCKED because the assigned Mama PC has no access to those roots. No READY or live-fix claim is made.

## Closing block

simplestRobustRoute: This is the simplest robust route: project the same live values the launcher already uses into its existing capability source, share its tool-route predicate, and retain generated feature descriptions. No new capability state, registry, lookup, model call, retry or gate. The credible failure addressed is contradictory self-description from a granted-but-unavailable route and missing launch-specific facts. Start guard: existing grant resolution; end-state guard: persisted model-packet assertions; limit guard: unchanged context budget measured with live facts included. Unattended live-user result remains unverified and is explicitly blocked for desk replay.
80/20: The source and launcher tests establish the projection locally. Fresh live-model outcomes and macOS confinement remain desk evidence, not inferred from fixture success. The report carries the missing evidence and any unrelated WSL test failures.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
