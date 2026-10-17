# Change review — liveness during a long foreground tool

Subject base: 4f0467f4eb654625c0c3ef40b16c2f804593285c
Review state: open
Reviewed content: none
Outcome: The existing progress path can send its fixed liveness line during an open admitted tool occurrence longer than ten seconds, while the session is freshly observed. Completed occurrences cannot borrow that freshness.
Affected rules: 26, 34, 36, 49, 52, 63, 70, 74, 76, 87, 89, 101, 102, 107, 111, 113, 116
Affected floors: secrets — tool details remain internal and outbound checks unchanged; spend cap — no model calls or extra allowances; stop — live observation and existing dispatch revalidation required; no duplicate sends — stable occurrence identity, durable intents and UNKNOWN consumption unchanged; durable intake — unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: changes eligibility of a fixed infrastructure liveness line through the existing signed send path.
Side effects: one open occurrence may now support one line beyond ten seconds. This claims only liveness, never tool productivity or success. A stuck but still observed session can receive that one line; unchanged occurrence identity prevents repeating it. Ended steps retain the original ten-second advancement window. Read failures, missing observations, clock rollback and end-of-turn still suppress activity. Four-line episode cap, cadence and final-answer serialization remain unchanged.
Undo and recovery: revert the reader change and its expectations; no persisted schema or migration, resend, grant or deployment change.
Multi-machine posture: local observation remains disposable and owner-scoped. Durable progress identity, budget and send outcome remain in the existing owner journal; no new state or cross-machine authority.
Layer below: read complete constitution; inspected production-conversation-session observation/end guards, admissionActivity post/post-failure handling, journal progress identity/cadence/revalidation/serialization, train-61 reader and walk6 actual native tool timeline. Train-61 already had the same expiry; its many short tools masked this long-single-tool gap.
Bug class: integration
Bug evidence: reproducer=tests/preview/working-progress.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains sample files only.
Convergence: none
Decision: gap-progress-open-occurrence | Refresh eligibility only for a still-open occurrence under a fresh session observation, preserving its single-use identity; completed work retains its original evidence clock. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/gap-progress-1017-PROGRESS.md
Decision: gap-progress-recorded-replay | Replay update 6234450's actual tool input, completion, final model output and relative times with a fake clock; never run the captured sampling command or claim a new live proof. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/gap-progress-1017-PROGRESS.md
Prompt review: no prompt, semantic parser or model disposition changes. Existing recorded summary uncertain, Jev unsure/undecided, reply review, delivered reply and empty-context cases remain tested. New fixture preserves the real 6234450 model output; admission rows are explicitly projections of captured tool events, not purported captured admission bytes.

## Closing block

simplestRobustRoute: This is the simplest robust route: distinguish an open occurrence from completed work in the existing bounded activity reader. No new timer, sender, store or model call. The old ten-second occurrence-age test made long foreground work ineligible even when live observations continued. Fresh observation and exact pending occurrence are start guards; completion, final answer and stop are end guards; stable occurrence identity and existing cadence/cap bound notifications. Unattended live acceptance belongs to the desk proof and is not claimed here.
80/20: Recorded 572-second tool replay sends before completion with no renewed completed activity or post-answer line. Existing failure closure, unknown sends, stop, cadence, batch, rollback and final-answer serialization checks remain targeted regression coverage. The Studio owns live proof and native conformance renewal.
VERDICT: author submission; independent review pending

Register refresh: replay-generated existing shape-only outputs from committed source 655f8cfe33ca52c807485442f214985b5c0e74b2. No declaration, owner manifest, conformance certificate or authority was changed.
Deferral: generated/register.json:1 | not-a-deferral=Existing declaration wording reproduced by the generator, with no deferred repair introduced.
