# Change review — missing login custody on a verified running session

Subject base: a82cdeac28e30f18a6f3dfee9335ae71ca31b890
Review state: open
Reviewed content: none
Outcome: A verified live worker whose admitted harness login has disappeared contributes one plain next-answer reminder and a missing-login status count and slot; identity drift alone never raises that reminder. Existing fixed-expiry escalation remains intact.
Affected rules: 4, 9, 26, 30, 34, 36, 49, 52, 63, 74, 76, 80, 87, 88, 100, 101, 102, 105, 113, 116
Affected floors: secrets — read only through existing custody validation and retain no value, identity, path or error in observations; spend cap — no new model call or allowance; stop — observer cannot launch, stop or gate a worker and existing send admission holds; no duplicate sends — existing durable notice keys consume sent and unknown intents; durable intake — no intake changes.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: Advisory host observation and fixed reply text only; no change to custody admission, session admission, worker ceiling, send authority, model protocol, gates or durable formats. Existing critical send and custody floors remain exercised.
Side effects: Each live activity callback performs one existing custody read for its exact admitted profile. The driver already isolates advisory callback failures. The bounded per-profile map replaces its sample and shares the existing status/dashboard and one-notice-per-answer path. It neither treats a provider identity mismatch as disappearance nor claims that locally present custody proves provider authentication. Unknown, future and stale samples cannot notify. A notice may compete with other due notices under the existing one-line bound.
Undo and recovery: Revert this change. No new store, migration or persistent format exists. Previously recorded credential-prefixed notice keys remain valid and spent in old journal readers. Restart rebuilds observations from fresh live worker checks; stable machine/profile/lifetime keys prevent replay of prior sent or uncertain reminders.
Multi-machine posture: Custody availability is deliberately machine-local. Notice keys bind owner machine plus admitted profile reference and activation reference; another machine's missing login is a distinct subject. Only the existing conversation owner sends through the existing replication/fence path. No secret or new shared store is introduced.
Layer below: Read purpose and rules in full and verified equality to origin/main; read D17 section 3 and carryover row 30. The production driver's activity callback follows loadSession, alive and verifyLive, before advisory activity publication. readHarnessLogin validates custody and binding and preserves native ENOENT for missing objects; other failures remain unknown. openReplyNotices and validAnswerNotices already support credential keys and consume unknown send intents. The current reply-only grant permits next-answer reminders, not an unsolicited new send.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: LE-1016-observation | Join the existing verified-live activity callback to the exact admitted login's custody read; only ENOENT is missing, all other failures are unknown. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/login-expiry-1016-PROGRESS.md
Decision: LE-1016-delivery | Reuse one-line next-answer notices and durable machine/profile/lifetime keys, with a 30-second freshness bound and the existing status/dashboard route. No new service, store or unsolicited send authority. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/login-expiry-1016-PROGRESS.md
Prompt review: No model prompt, parser, acceptance or refusal criterion changes. Fixed notice output is added; replay uses recorded real worker panes plus summary-writer, uncertain summary, Jev undecided/unsure, reply review, delivered reply and empty historical reply shapes. Synthetic missing-custody faults are explicitly labelled rather than represented as live captures. Existing credential-label and doorway-notice replay tests remain part of the direct consumer checks.

simplestRobustRoute: Extend installed-harness-logins and credential-reminders through the existing verified worker observer, bounded sample map, status and durable one-line reply path. This is the simplest robust route; no new watcher, model call, send path or store. Exact live worker verification and custody lookup are start guards; freshness, current ownership, stop, disclosure and existing unique-send rules remain limits. Offline recorded-shape proof is not an unattended live deployment claim; the desk's isolated proof-room case is required to call this live.
80/20: Targeted positive and negative tests cover the new join, missing versus drift/unreadable, freshness, machine and lifetime scope, recorded worker bytes, one reminder, restart and unknown sends. Existing expiry scheduling and consumer suites remain covered. The desk owns independent review and the full host lane.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
