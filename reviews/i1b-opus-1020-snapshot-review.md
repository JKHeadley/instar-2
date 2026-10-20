# Change review — Accept answer-token metadata in legacy judgment snapshots

Subject base: 13d9b054ccb4a0a8c894cbef383801b1e619a979
Review state: open
Reviewed content: none
Outcome: Successful provider observations with valid optional answerTokens remain usable through the legacy production judgment adapter. Their durable receipts retain answer usage separately from total output usage.
Affected rules: 13/45 (retain explicit answer quantity through the missed consumer); 36/70 (replay recorded usage and reproduce the refusal before repair); 4/75 (reject malformed data while preserving independently valid accounting); 37 (positive and negative boundary tests); 49/74/111 (record affected consumers and recovery); 101/102 (ordinary commits and reported decision); 113 (stateless machine-local computation); 115 (native composition evidence remains desk-owned); 116 (extend existing snapshot without a new mechanism).
Affected floors: secrets — data descriptors never execute provider getters; spend cap — total output and charge stay intact; stop — existing transport deadline and stop checks unchanged; no duplicate sends — one invocation asserted and no retry changes; durable intake — existing capture and causal persistence unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Repairs an exact numeric provider observation boundary on the existing production judgment path; no prompt, authority, routing or policy changes.
Side effects: Valid optional answerTokens now survives snapshot and receipt encoding. Missing fields preserve legacy encoding; present malformed values produce uncertain observations while retaining independently valid usage.
Undo and recovery: Revert this repair, regenerate owner and register pins, and renew native conformance on the resulting composition. No store migration is needed. Reversion restores the reproduced false refusal.
Multi-machine posture: Stateless machine-local validation is identical on every machine; no shared state, owner transfer, replication demand or peer dependency is introduced.
Layer below: Inspected production-provider-owners forwarding, observationCheck quantity semantics and the real judgment fixture's capture, transport reservation and dispatch path. Tests inspect durable receipts and invocation counts; total output and charge remain accounting quantities.
Bug class: live-path
Bug evidence: reproducer=tests/judgment/repairs.test.ts; live=tests/preview/fixtures/thinking-floor-opus-2026-10-20.json
Hook bypass: none
Convergence: none
Decision: i1b-snapshot-optional | Extend the existing closed data-only snapshot with optional validated answer usage; reject malformed present values and preserve independent totals without adding a new parser or cap. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/i1b-opus-1020-repair-143352-PROGRESS.md
Prompt review: No prompt or semantic decision changes; tests replay numeric usage only. The captured retrospective usage and two CLI probes are paired with the existing valid judgment fixture, not presented as the lost retrospective answer or a live completion.

## Closing block

simplestRobustRoute: Extend the existing snapshot's accepted usage shape and bounded copy. This is the simplest robust route, retaining the existing safe-integer, nonnegative and no-greater-than-total guards, uncertain malformed outcome and all transport floors. No autonomous live-completion claim is made; the combined-build proof remains with the desk.
80/20: Repair the one reproduced consumer mismatch and verify valid, legacy, recorded and malformed neighbors. Full-suite and live completion evidence belong to the Studio pipeline under the supplied brief.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
