# Change review — continuing conversation session component

Subject base: ac3bd4d8874495f8b66b571837a1380995113d7a
Review state: open
Reviewed content: none
Outcome: Wire the opt-in continuing conversation through the existing admitted session driver, as step 1 of actual-agent-plan-1013. The journal retains intake, records, review and sends until their named later steps. Real proof-room acceptance belongs to the desk.
Affected rules: Rules 2, 4, 5, 29, 34, 49, 60, 74, 83, 96, 101, 102, 111, 113, 114, 116.
Affected floors: secrets — no outbound sender added and existing custody remains the host's; spend cap — one durable cumulative reservation across turns, no replenishment; stop — checked before admission/delivery and while polling, closes the admitted child; no duplicate sends — this component never sends and refuses repeated input identities; durable intake — host must admit before invoking, driver retains exact deliveries.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Off-by-default proof-room route under existing reviewed session authority. The default route is unchanged; no live launch or authority grant is made.
Side effects: A continuing child holds resources between turns. Whole-session deadlines/caps can end it before a later message. Cleanup waits for bounded host admission to finish so a late lease cannot escape. Subscription token accounting remains unavailable; the checkpoint and transcript call counts enforce the reserved call ceiling.
Undo and recovery: Turn off --conversation-session or revert this component, wiring, tests and documentation. No live state or stored schema was changed; no migration is required. The host owns restart recovery and must not replay uncertain intake.
Multi-machine posture: Machine-local admitted conversation owner and launch. Existing host ownership fencing remains required; this component creates no cross-machine authority or transfer path.
Layer below: Read production-session-driver.ts, production-session-work.ts, provider activation/custody, production-conversation-host.ts and production-composition.ts. The driver already supports multiple distinct deliveries on one live process. Scheduled work stops after each result. Installed conversation currently requires provider-answer acceptance and shared signed owner composition; the preview journal is not that composition. No substitution of preview records for foundation authority is made.
Bug class: integration
Bug evidence: reproducer=tests/assembly/production-conversation-session.test.ts
Hook bypass: none; core.hooksPath is unset and the shared hooks directory contains sample hooks only.
Convergence: none
Decision: session-mouth-copy-1013-cumulative | Use one durable session edge, admission and cumulative call allowance across turns, instead of refreshing the allowance when a message arrives. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/session-mouth-copy-1013-PROGRESS.md
Decision: session-mouth-copy-1013-close | Wait for pending resource admission before closing the edge, and require turn closure as well as a stable result before accepting an answer. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/session-mouth-copy-1013-PROGRESS.md
Decision: session-mouth-copy-1013-foundation | Follow the newer step-1 plan: wire only the conversation worker now; journal intake/send/review remain explicitly named dependencies for steps 2 and 6. Never label preview records foundation authority. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/session-mouth-copy-1013-PROGRESS.md

Decision: session-mouth-copy-1013-activation | Bind the continuing prompt and whole-conversation limits to their own policy digest within the existing session activation protocol; reject scheduled-work activation and keep the option off by default. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/session-mouth-copy-1013-PROGRESS.md
Decision: session-mouth-copy-1013-decoder | Pass returned session bytes through the existing answer decoder; replay real updates 6233124 and 6233129 so reasoning stays internal and dated obligations remain structured. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/session-mouth-copy-1013-PROGRESS.md
Decision: session-mouth-copy-1013-recovery | Refuse busy and duplicate intake; reconnect only between completed turns with the same cumulative reservation, reconstruct from journal history when needed, and never replay uncertain input. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/session-mouth-copy-1013-PROGRESS.md
Decision: session-mouth-copy-1013-idle | Use the existing host work tick to close an idle expired session, and close the same port during host shutdown. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/session-mouth-copy-1013-PROGRESS.md

Subject: src/assembly/production-conversation-session.ts, src/assembly/production-provider.ts, src/assembly/README.md, tests/assembly/production-conversation-session.test.ts, tests/assembly/production-provider-subscription.test.ts, tests/preview/journal-agent.mjs, tests/preview/journal-conversation-session.test.ts, tests/preview/group-carry-requests.test.ts, tests/preview/fixtures/conversation-session-userwalk-2026-10-13.json

## Closing block

simplestRobustRoute: Reuse the current admitted session driver and session-work physical/resource contracts, retain one child across messages and keep its total allowance fixed. This is the simplest robust route for the component. The new lifecycle prevents two named failures the fresh-step wrapper cannot: loss of conversation between messages and replenishment of call allowance per message. Reuse the existing session activation, resource and tool checkpoints. It does not claim the later foundation intake/effect/review migration or unattended completion.
80/20: Verify repeated deliveries, current memory, cumulative accounting, stop, bounded results and cleanup races. Do not move the large preview journal into src or claim that typed callbacks alone establish the requested send protections.
VERDICT: author submission; no independent review or completed experiment is asserted
