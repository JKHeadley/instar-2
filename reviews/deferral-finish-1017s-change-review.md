# Change review — Finish deferred answers before waiting for delivery

Subject base: c6a4d7183963ede01f29eab3e7c375f216287d28
Review state: open
Reviewed content: none
Outcome: short deferred answers finish in one scheduled attempt; the existing runner stores completed reports until the next inbound message unless an explicit delivery request already authorizes delivery.
Affected rules: 8, 10, 12, 22, 36, 41, 46, 58, 64, 74, 83, 92, 101, 111, 113, 116
Affected floors: secrets — unchanged provider/outbound custody; spend cap — unchanged reservation and attempt limits, no new call; stop — existing work and send gates; no duplicate sends — existing durable report binding and receipt settlement; durable intake — existing encrypted journal.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: model-facing scheduled-work instruction changes when an owned obligation finishes; deterministic guards and output schemas remain unchanged.
Side effects: the tools and no-tools routes share the clarified distinction between preparation and delivery. Genuine unfinished work still returns continue; a real external dependency still returns waiting. No classifier, scheduler, delivery grant, cadence or parser changes. Captured provider reports contain ordinary model judgments, not independently established new facts.
Undo and recovery: revert the prompt clause and regenerate the register. Existing reports, intents and receipts remain valid; no new persistent shape, migration or retry path. Reverting restores the ambiguous work/delivery instruction.
Multi-machine posture: uses the existing shared owner journal for commitments, work results and delivery state. No new machine-local product state; fixture replay roots are isolated and disposable.
Layer below: read both room-4 journals without writing them. Train-55 frame 142 already declares d1 as openLoops deferral/waitsOn nothing; frame 144 admits it and 157/159 deliver it. The sampled status still had memory correction pending before that answer. Frames 231/241 confused delayed delivery with delayed preparation; train-56 frame 225 returned report using the byte-identical old question. The shared report/receipt path already stores, attaches and settles results correctly.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/deferral-finish.test.ts; live=tests/preview/fixtures/deferral-finish-2026-10-17.json
Hook bypass: none
Convergence: none
Decision: preparation-before-delivery | clarify the existing prompt, preserving model ownership of continue/waiting/report and all delivery grants | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/deferral-finish-1017s-PROGRESS.md
Decision: classification-evidence | retain the classifier: recorded d1 correctly creates a commitment after summary retries; the earlier status was not a completed classification | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/deferral-finish-1017s-PROGRESS.md
Prompt review: clarify the existing work prompt by meaning: returning report stores a finished answer and does not itself send. No fixed user phrase, classifier heuristic or coerced outcome. Two fresh claude-sonnet-5 calls replayed the complete recorded train-55 envelopes with only the task question replaced, tools disabled and a $1 cap each; both returned substantive reports. Fixtures preserve exact provider result bytes and complete supplied envelopes. Worker replay is isolated, not a claim of whole-root or live Telegram acceptance.
Prompt finding: 4106b49fff07 | protocol-literal | Unchanged existing protocol guidance; not a semantic classifier copied from a fixture.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged existing protocol guidance; not a semantic classifier copied from a fixture.
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged existing protocol guidance; not a semantic classifier copied from a fixture.
Deferral: tests/preview/deferral-finish.test.ts:94 | not-a-deferral=Recorded deferred-work evidence or instructions under test; no unfinished builder work.
Deferral: tests/preview/fixtures/deferral-finish-2026-10-17.json:18 | not-a-deferral=Recorded deferred-work evidence or instructions under test; no unfinished builder work.
Deferral: tests/preview/fixtures/deferral-finish-2026-10-17.json:23 | not-a-deferral=Recorded deferred-work evidence or instructions under test; no unfinished builder work.
Deferral: tests/preview/fixtures/deferral-finish-2026-10-17.json:29 | not-a-deferral=Recorded deferred-work evidence or instructions under test; no unfinished builder work.
Deferral: tests/preview/fixtures/deferral-finish-2026-10-17.json:31 | not-a-deferral=Recorded deferred-work evidence or instructions under test; no unfinished builder work.
Deferral: tests/preview/fixtures/deferral-finish-2026-10-17.json:33 | not-a-deferral=Recorded deferred-work evidence or instructions under test; no unfinished builder work.
Deferral: tests/preview/fixtures/deferral-finish-2026-10-17.json:48 | not-a-deferral=Recorded deferred-work evidence or instructions under test; no unfinished builder work.
Deferral: tests/preview/fixtures/deferral-finish-2026-10-17.json:54 | not-a-deferral=Recorded deferred-work evidence or instructions under test; no unfinished builder work.
Deferral: tests/preview/fixtures/deferral-finish-2026-10-17.json:56 | not-a-deferral=Recorded deferred-work evidence or instructions under test; no unfinished builder work.
Deferral: tests/preview/fixtures/deferral-finish-2026-10-17.json:58 | not-a-deferral=Recorded deferred-work evidence or instructions under test; no unfinished builder work.
Deferral: tests/preview/fixtures/deferral-finish-2026-10-17.json:82 | not-a-deferral=Recorded deferred-work evidence or instructions under test; no unfinished builder work.
Deferral: tests/preview/journal.ts:2589 | not-a-deferral=Recorded deferred-work evidence or instructions under test; no unfinished builder work.


## Closing block

simplestRobustRoute: this is the simplest robust route: clarify one existing prompt clause and reuse the owned commitment, scheduled attempt and durable report machinery. No added mechanism. Durable intake starts work, the model reports actual completion, existing authenticated delivery and receipts close it, and secrets/caps/stop/uniqueness remain enforced. Two recorded real provider reruns finish unattended; isolated shipped-worker replay proves storage and next-message delivery. The desk owns fresh live Telegram acceptance.
80/20: target the changed obligation prompt and its direct test consumers, existing recorded-shape replay, and the mandatory pinned gate; the pipeline owns the full suite.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

Register publication: existing replay generator consumed source ad263c4a3ee720f950dcdaff39c4f7022d0b19e1 and produced generation sha256:e71cc6a1c57aa2e79629319bde6e43b1c5432ed3571bb02211778b73bc8b9ada. Seven generated files refresh source/generation metadata only; no owner declaration, certificate or runtime authority changes. Owner-manifest rehash changed zero pins.
