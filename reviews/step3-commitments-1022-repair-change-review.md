# Change review — Consume unchanged due wakes

Subject base: d4fb29d6d798a3467e4b9b54584583c5e925f310
Review state: open
Reviewed content: none
Outcome: an unchanged overdue promise gets one disposable wake; completion refresh after pre-start refusal cannot create an immediate retry loop. The ordinary cycle can still retry and advance the promise.
Affected rules: 5, 8, 32, 49, 55, 61, 70, 74, 83, 101, 102, 111, 113, 115, 116
Affected floors: secrets — existing redaction and journal custody; spend cap — existing reservations unchanged; stop — lane admission unchanged; no duplicate sends — original durable delivery identities unchanged; durable intake — journal append and projection unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: a narrow scheduling repair with recorded-worker integration evidence, changing neither model judgment nor authority.
Side effects: no-progress work waits for the existing periodic cycle instead of repeatedly waking itself. Same-instant replacement work may also wait for that cycle. Changed deadlines get new wakes. Early clocks and stale callbacks retain their existing checks.
Undo and recovery: revert this repair and replay the register; no journal format or durable state changes. Restart reconstructs the disposable wake from the journal.
Multi-machine posture: consumed deadlines are deliberately machine-local timer hints. Ownership, stop and peer durability remain enforced by the existing lane. No timer grants authority.
Layer below: inspected nextObligationAt, workObligations packet fit and prepareModel before obligation-start, ordinary lane completion refresh and host workCycle catch, plus the purpose and all rules from origin/main. Pre-start refusal has no durable attempt, so the lane alone cannot brake completion-triggered retries.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/astra-promise-wake-repro.test.ts; live=tests/preview/fixtures/requested-report-proofroom4-2026-10-17.json
Hook bypass: none
Convergence: none
Decision: consume-due-deadline | retain the fired deadline before requesting work so unchanged completion refresh is inert; reuse the periodic cycle for retries rather than adding a retry service | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step3-commitments-1022-repair-012824-PROGRESS.md


Pin maintenance: the delegated desk repin updates the existing grounding inventory hashes for inherited rungraph/index.ts and transport/index.ts and its checker digest. Owner-reference hashes required no changes. Register outputs are replayed from committed source. The retry change also affects the byte-bound native composition under Rule 115. The earlier Laptop handoff left its certificate stale; a handoff exception is not current conformance evidence. The round-2 Studio repair renews that evidence through the existing native contract and digest procedure; see reviews/step3-commitments-1022-native-conformance-change-review.md.
Register replay source: 797cff149881bfec23693553a9310f22ea1a4dc1. Generated artifacts contain the committed wake repair and grounding pins.

Review maintenance: repair the original unit record's missing prompt review/dispositions and action-literal deferral disposition, and restore its closing fields to the final three lines. No prompt, fixture or product behavior changes in this maintenance.

simplestRobustRoute: retain the existing durable journal, worker and lane, remembering the fired deadline in the existing armed field. This is the simplest robust route: no queue, service or additional durable state. The named failure is the reproduced unbounded 1-ms preparation-refusal feedback loop. Start guards remain owner, peer, stop and capacity; changed deadlines rearm; unchanged refused work remains open for periodic retry. Replay of update 46040219 proves the no-progress brake and recovery, alongside existing restart and delivered-result replay. This is offline evidence, not new live acceptance or D18 holder activation.
80/20: seven targeted tests pass; the reviewer reproduction fails before the source change with twenty attempts and passes afterward. Pipeline owns full-suite and fresh live acceptance; no independent verdict is claimed.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
