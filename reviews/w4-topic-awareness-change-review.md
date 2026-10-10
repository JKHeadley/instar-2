# Change review — Forum packet topic awareness

Subject base: afa6be392876eb17c2789651090fa90b83a81f92
Review state: open
Reviewed content: none
Outcome: Identify the current forum topic explicitly and attribute shared dated/pending memory to its originating topic while keeping private-chat packet bytes unchanged.
Affected rules: 1, 7, 12, 28, 33, 34, 36, 49, 58, 62, 70, 74, 84, 89, 96, 101, 102, 106, 111, 113, 116
Affected floors: secrets — existing redaction and group disclosure remain; spend cap — no added call or reservation; stop — unchanged admission; no duplicate sends — unchanged intent and settlement; durable intake — no schema change or journal rewrite
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: This changes model-facing context used for a user-visible answer.
Side effects: Forum provenance says General instead of main chat, including retained General renames. Forum dated/pending entries and local summary/preference candidates gain provenance fields, consuming bounded packet space; existing byte selection remains in force. Recall and existing labels use the same naming function. Private mode keeps its prior bytes. No routing, authority, storage or memory-selection policy changes. Generated register publications replay source commit 10f1b57b45a562e21baeae984e8aad606bbc15cc in shape-only mode; this is evidence wiring, not runtime authority.
Undo and recovery: Revert this source change and replay the generated register before deployment rollback. Old journals need no migration: names and sources derive from retained intake. No send or provider effect is replayed by rollback.
Multi-machine posture: Deterministic projection from the existing journal on each serving host. No new state, cross-machine dependency or ownership mechanism; existing replication/writer fencing remains authoritative.
Layer below: Durable bot/chat/topic normalization, authenticated service-name capture, source turn lookup and labels, packet byte selection, topic-specific groundingHistory and send destinations, journal replay validators.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/topic-awareness.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-topic-awareness-PROGRESS.md
Hook bypass: none
Convergence: none
Decision: topic-awareness-projection | Reuse audience.conversation and sourceLabel; add forum-only projections instead of partitioning shared memory or adding state | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-topic-awareness-PROGRESS.md
Decision: topic-awareness-general-name | Normalize General only for forum display and retain its authenticated name under canonical topic 1; preserve private rendering | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-topic-awareness-PROGRESS.md
Decision: topic-awareness-evidence | Replay recorded proof-room rows under a clearly synthetic forum projection; classify the inaccessible current live CEDAR journal and real-answer proof as BLOCKED rather than treating packet assertions as a model result | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-topic-awareness-PROGRESS.md
Prompt review: Generic provenance instructions identify audience.conversation as the current destination and require shared facts to cite their source topic. No CEDAR text, fixture answer or keyword decision enters the prompt. The recorded proof-room rows 715672479–715672500 replay unchanged through their original genesis before a read-only synthetic forum projection; uncertain/undecided and reply-review states survive. The parent packet hash is a measured byte comparison, not a fabricated baseline. Current live forum proof and a captured empty bubble are unavailable and explicitly not claimed.
Prompt finding: 849db3a6296a | protocol-literal | existing fixed protocol wording unchanged by this fix
Prompt finding: bd01de21286a | protocol-literal | existing provenance instruction unchanged by this fix
Prompt finding: fb5fa7e706c8 | protocol-literal | existing evidence instruction unchanged by this fix

## Closing block

simplestRobustRoute: This is the simplest robust route: populate the existing audience and source-label fields from retained topic identity. Named failure: an unlabeled shared pending message is mistaken for the current conversation. No new store, guard, provider call, prompt classifier or scheduler is needed. Existing admission, disclosure, stop, spend and byte bounds remain. Packet, delivery-route and recorded-row tests are evidence at their stated tiers; no unattended live completion is claimed.
80/20: Targeted verification and generated register replay precede the desk gate. The live-root limitation is reported as blocked evidence, with no claim of READY or independent convergence.
VERDICT: author submission; independent desk review remains required
