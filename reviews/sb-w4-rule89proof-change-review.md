# Change review — sb-w4-rule89proof

Subject base: 1e323ff6ad0ff122a14e7044bb07eed70be99b8f
Review state: open
Reviewed content: none
Outcome: Ordinary merge of reviewed unit 25ef171cb1041b75090006b856af00e5e56cd9d5 onto the exact live head. The merge fast-forwarded without conflicts. The existing reply-review test now proves agent versus infrastructure speaker counts, accepted holding delivery, and no duplicate delivery after journal replay. Unit evidence: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-rule89proof-PROGRESS.md. No runtime, model-facing or governed-document change.
Affected rules: 26, 34, 70, 89 (delivery and signed-provenance projection assertions); 35 (isolated journals); 37 (targeted verification); 49, 74, 111 (this record and the underlying signing, holding and projection path); 101, 112 (ordinary merge and commits preserve history without bypass); 102 (reported decisions); 32, 113 (machine-local test artifacts); 116 (reuse the existing test).
Affected floors: secrets — existing secret-refusal neighbor remains; spend cap — existing cap neighbor remains and tests spend nothing; stop — runtime stop path unchanged; no duplicate sends — reopened journal must deliver no second reply; durable intake — real isolated journal persists and replays the accepted turn
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test assertions only; no production behavior or authority changes.
Side effects: Future speaker-accounting or duplicate-send regressions fail the existing test. No new model calls, transport, stores, public surfaces or runtime machinery. Historical live evidence in the unit report is distinct from this machine's current isolated execution.
Undo and recovery: Revert the test-only unit commit and this review record. No runtime migration or production recovery is needed.
Multi-machine posture: Deliberately machine-local test journals and evidence. Distributed ownership, replication and forwarding are untouched; no peer is required.
Layer below: Inspected tests/preview/journal.ts holding substitution assigning infrastructure, signed intent creation before dispatch, accepted sent receipt, and projection of row.provenance.speaker. The fixture uses the real worker and journal with supplied model verdicts and captured transport. The unit report records historical live update 715673071; this build makes no new live-channel claim.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: sb-w4-rule89proof-unit | Merge exact unit 25ef171c by ordinary fast-forward from live 1e323ff6, preserving its test bytes and report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-rule89proof-PROGRESS.md | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-rule89proof-PROGRESS.md
Decision: sb-w4-rule89proof-desk | No source or generated file changed, so the task's conditional repin and register replay chain is unnecessary; compile and verify the existing register plus its end-to-end test | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-rule89proof-PROGRESS.md
Decision: sb-w4-rule89proof-scope | Run the changed test, default-context-floor and register end-to-end test with one worker; no runtime changes require model-shape replay or macOS-only tests, and the gate host owns the full suite | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-rule89proof-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: merge the reviewed extension of the existing test and check its consumers. No machinery is added. Start guards are an isolated journal and bounded fake model/send ports; end state is one accepted infrastructure holding reply with persistent counts and no repeat, beside an ordinary agent reply. Existing secret, spend, stop and intake floors remain. This is isolated worker evidence, not a new unattended live exchange.
80/20: Verify the changed assertions, unchanged context guard and register, then submit the pushed tree to the independent pipeline gate without expanding into a full suite.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
