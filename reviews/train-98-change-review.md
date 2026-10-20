# Change review — train-98 signed Telegram markdown integration

Subject base: 39d72c391905038ad7da24c51c6c0e8df5732b0f
Review state: open
Reviewed content: none
Outcome: integrate exactly reviewed md-render-1020 head 4cb4a1ddee5865da41d53d695cc9b54dfc580070 into the exact live base, retaining signed rendered replies and bounded plain fallback after durable definite parse refusal.
Affected rules: 1, 33, 36, 37, 42, 44, 49, 63, 69, 70, 74, 77, 89, 90, 101, 102, 105, 111, 112, 113, 116
Affected floors: secrets — original and both alternatives scanned before signing; spend cap — unchanged; stop — existing stop/expiry/ownership rechecked before fallback; no duplicate sends — one existing claim, no retry of unknown acceptance; durable intake — unchanged, signed preparations and refusal retained by existing journal.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: reviewed integration affects signed outbound bytes and the bounded alternate-send path.
Side effects: exact signed HTML/plain preparations survive restart, compaction and replication; refusal evidence survives successful fallback. Legacy intents retain original bytes. No independent product modification is introduced by this train.
Undo and recovery: revert the member through review and replay register. Retain journals and never repeat uncertain sends. Formatted multipart intents need a reader compatible with the member's retained preparation; do not rewrite signatures for an older reader.
Multi-machine posture: existing ownership and claim retained; both alternatives replicate with the intent and definite refusal replicates before the alternate send. No machine-local state or authority added.
Layer below: exact member diff, member report, signed-body validation, durable journal/refusal projection, Telegram definite-refusal classification, desk inventory/owner-manifest regeneration and generated register. Constitution read in full; checks run on the merged consumer.
Bug class: none
Bug evidence: none — reviewed integration, member durability evidence retained in its existing review.
Hook bypass: none; core.hooksPath unset and common hooks directory contains sample files only.
Convergence: none
Prompt review: no new prompt or verdict parsing. Member tests replay real replies 34501 and 34485 plus Telegram parse refusal; corpus includes summary 715672480, uncertain summary 715672483, Jev undecided 715672482 and unsure 969389570, review 969389923, delivered reply 715672479 and empty bubble 715672550. This train reruns that evidence; it makes no fresh live-delivery claim.
Prompt finding: 4106b49fff07 | protocol-literal | Existing guidance to preserve missing evidence, unchanged by integration.
Prompt finding: 849db3a6296a | protocol-literal | Existing fixed saved-memory answer, unchanged by integration.
Prompt finding: e8708c7fea24 | protocol-literal | Existing source-label and uncertainty guidance, unchanged by integration.
Decision: train-98-merge | Merge exact reviewed 4cb4a1ddee5865da41d53d695cc9b54dfc580070; ordinary merge fast-forwarded. Member report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/md-render-1020-PROGRESS.md read through Studio file API and retained outside checkout. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-98-PROGRESS.md
Decision: train-98-A | Preserve every reviewed member behavior with no new product edits; no overlapping conflict. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-98-PROGRESS.md
Decision: train-98-B | Branch created directly at exact live base 39d72c391905038ad7da24c51c6c0e8df5732b0f; no main merge or newer branch tip. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-98-PROGRESS.md
Decision: train-98-C | No genuine conflict and no head left out; generated output replayed using the desk chain, never hand-merged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-98-PROGRESS.md
Decision: train-98-D | Classify unchanged WSL/Studio-dependent checks separately for the desk; do not change declarations to hide failures. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-98-PROGRESS.md
Decision: train-98-markdown-expectations | Align capability delivery assertions with the reviewed renderer’s bullet glyph; preserve exact pre-send answer/review checks and captured grant-overclaim replay. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-98-PROGRESS.md
Decision: train-98-multipart-fixture | Replace a stale mock-send plain-encoding assertion with verification of the exact signed prepared body and retained shown text, preserving receipt matching, complete ordered delivery and no duplicate sends on recorded update 46040043. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-98-PROGRESS.md
Decision: train-98-desk | Run downloaded repin/build/owner-rehash/register-replay chain and retain the existing context guard constant. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-98-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=Existing declaration descriptions reproduced by register replay, not a new commitment.
Register replay: after both delivery fixture alignments, generated bindings replayed against 5cb5084965a55271ff730afc2cda4cc153bc7646.
Verification: targeted changed/direct-consumer tests and explicitly requested journal/subscription/register checks, pinned READY tests and typecheck/lint/architecture/register/change-review/whitespace checks are reported with their actual outcomes in the handoff.
simplestRobustRoute: This is the simplest robust route: one exact reviewed merge, existing desk regeneration and targeted consumer verification. No new machinery. Exact ancestry guards the start; signed payloads, current ownership and durable refusal guard dispatch; secret custody, spend, stop, unique sends and durable intake remain limit guards. No autonomous live acceptance claimed from offline checks.
80/20: bounded targeted checks only; no full suite, alternate-base checkout, live runner, serving credentials or load tests.
VERDICT: author submission for desk gate, not an independent convergence or live acceptance claim
