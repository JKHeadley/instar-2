# Change review — Require observed settled effects before idle cleanup

Subject base: f8a3c890a9247f3354da9cc164c40b3342f13d51
Review state: open
Reviewed content: none
Outcome: Idle cleanup requires an explicitly observed zero uncertain-effect count; missing evidence retains the worker.
Affected rules: Rules 1, 26, 37, 49, 68, 70, 74, 95, 101, 102, 111, 113, 116.
Affected floors: secrets — no new outbound content; spend cap — no calls or allowance changes; stop — independent stop paths unchanged; no duplicate sends — existing effect custody retained; durable intake — completed and queued input remain recorded.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: One exact cleanup eligibility condition and its neighboring regression cases; no new protocol or capability restriction.
Side effects: An adapter admission observation omitting uncertainEffects now retains capacity until affirmative settlement is observed. Explicit zero retains existing cleanup behavior; nonzero retains existing protection. Fixtures declaring settled effects now say zero explicitly so child-work tests remain independent.
Undo and recovery: Revert this repair through normal git/update flow; no schema or stored state changes. Retained workers can be reconsidered by the existing owner tick once settlement is observed. Preserve all intake and effect receipts.
Multi-machine posture: Machine-local retirement under the existing owner fence; no new shared state, remote authority or duplicate retirement behavior.
Layer below: Inspected SessionWorkIO optional uncertainEffects contract, production idleStamp checks before and after adapter observation, existing confirmation/grace and control paths, and recorded-shape fixture provenance. The original unit reviewed the unchanged 1.x reaper precedent; this repair changes only the existing checkpoint.
Bug class: unit
Bug evidence: reproducer=tests/assembly/production-conversation-session.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains only sample hooks, inspected before commit.
Convergence: none
Decision: sentinel-reaper-1022-observed-zero | Require explicit zero at the existing idle checkpoint; missing evidence keeps the worker without narrowing its capabilities. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sentinel-reaper-1022-repair-012815-PROGRESS.md
Prompt review: No prompt, semantic parser, model route or model acceptance change. Existing recorded summary/uncertain, Jev undecided/unsure, reply-review, delivered and empty reply bytes are replayed with both missing and nonzero effect observations and then explicit zero. Unchanged prompt pins below remain quoted evidence.
Prompt finding: 0725f0150c56 | quoted-evidence | Unchanged briefing fixture; no prompt changes or new semantic authority — fixture-phrase src/assembly/production-conversation-session.ts <- tests/assembly/production-conversation-session.test.ts: "use them to answer and act within that role; a tool refusal remains a refusal."
Prompt finding: 27d7720e7977 | quoted-evidence | Unchanged briefing fixture; no prompt changes or new semantic authority — fixture-phrase src/assembly/production-conversation-session.ts <- tests/assembly/production-conversation-session.test.ts: "this memory and work record"

Subject (2 paths): src/assembly/production-conversation-session.ts, tests/assembly/production-conversation-session.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: replace the nullish default with an exact zero requirement at the existing cleanup checkpoint. No new timer, gate, queue or protocol is added. Existing positive adapter idleness, completed intake, confirmation/grace, authority, stop and fresh final observation remain the start/end guards. Missing observations retain work under Rules 26/68/95; explicit zero still permits cleanup. No unattended live acceptance is claimed.
80/20: Reproduced the missing/zero/nonzero neighbors before the source fix; run targeted tests including direct importers and recorded-shape replay, typecheck, architecture, register and required pinned checks. Desk owns renewal of the byte-bound native macOS certificate and independent review.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
