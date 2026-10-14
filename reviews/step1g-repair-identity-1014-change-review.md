# Change review — conversation format-repair identity

Subject base: 0a2ee6a8451a9cf7c3ca54c3b0911a5a5086f375
Review state: open
Reviewed content: none
Outcome: The conversation bridge invokes a durably reserved format repair under its own intake-linked child identity; original replay still matches the original request. An unsettled repair reaches the existing honest failure notice rather than disappearing in the invocation exception path.
Affected rules: Rules 1, 4, 26, 29, 34, 36, 42, 46, 49, 55, 57, 68, 70, 74, 75, 77, 88, 95, 101, 102, 111, 113, 116.
Affected floors: Existing secrets, spend cap, stop, durable intake and no duplicate sends remain enforced. The host request digest comparison is unchanged; a repair consumes the existing bounded reservation and conversation allowance.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Repairs a silent missing reply in the shipped continuing-conversation bridge, verified with recorded packets and real host/journal paths.
Side effects: One additional host input identity for the already-authorized single format re-ask. It shares the original conversation, authority, budget and retention. Host failures return uncertainty to the existing journal notice path; neither failed nor unknown tool work is replayed. Unavailable original admission still raises ModelNotStarted. Summary and review paths are unchanged.
Undo and recovery: Revert the bridge change to restore prior behavior; retain all original and child operation records. Never erase unknown operations or replay an uncertain tool input. The existing journal send intent remains the uniqueness authority on restart.
Multi-machine posture: No new store. The existing host-owned conversation queue and journal carry the child identity; their ownership fence serializes writers across host lifetimes. This change grants no second machine dispatch authority.
Layer below: Inspected production-conversation-session.ts request hashing, durable queue admission, outcome/cursor atomic persistence and restart refusal to replay dispatched unknown work; journal.ts format-retry reservation, unknown-answer notice and send intent/receipt projection.
Bug class: live-path
Bug evidence: reproducer=tests/preview/journal-conversation-session.test.ts; live=tests/preview/fixtures/repair-identity-copy-walk-2026-10-14.json
Hook bypass: none; core.hooksPath is unset; the common hooks directory contains sample hooks only.
Convergence: none
Prompt review: No prompt wording or parser changes. The recorded copy-walk packets for updates 840342703, 840342709 and 840342711 are replayed through the shipped bridge and real host. Existing real-output and format-retry fixtures remain exercised. Live Telegram delivery of the changed build is reserved for the desk; this unit sends nothing.
Decision: step1g-child | Derive the child identity from the existing durable format-retry reservation and exact prepared packet, retaining the parent intake identity for outbound delivery. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1g-repair-identity-1014-PROGRESS.md
Decision: step1g-notice | Return uncertain host repair outcomes to the existing honest-failure notice and unique send path; never re-dispatch unknown tool work. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1g-repair-identity-1014-PROGRESS.md
Decision: step1g-timing | Measure available copy-walk status and pane evidence without changing timing behavior; identify unseparated model/tool time explicitly. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1g-repair-identity-1014-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: reuse the journal's existing one-repair reservation, suffix its operation identity, preserve the host digest check, and reuse the honest-failure/send-intent path. A new queue, retry scheduler or digest exception is unnecessary. The named failure is altered repair text being refused under the original identity and its exception leaving no terminal answer. Existing admission, authority, stop and cap guards precede dispatch; existing outcome and send receipts govern settlement. Recorded-packet tests prove host acceptance and replay behavior; no unattended live-send acceptance of this changed build is claimed.
80/20: Targeted bridge, host, repair and recorded-shape tests, typecheck, architecture, lint, register and pinned-text checks. No full suite, live walk or deliberate load.
VERDICT: author submission for desk review; no independent convergence claimed
