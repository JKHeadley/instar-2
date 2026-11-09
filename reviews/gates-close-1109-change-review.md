# Change review — dispositions for the eight dark-feature gates due 2026-11-10/11

Subject base: 1e5d9df64e18ec60041a21fb73c382d3769203b4
Review state: open
Reviewed content: none
Outcome: Each of the eight register gates due 2026-11-10 00:00 UTC (P5-NF-54 rungraph-core, PREVIEW-CONVERSATION, PREVIEW-DURABLE-MEMORY, PREVIEW-STATUS-COMMAND, PREVIEW-UPCOMING-DATE, PREVIEW-REQUESTED-ACTIONS, PREVIEW-OWNED-OBLIGATIONS) or 2026-11-11 00:00 UTC (PREVIEW-MEDIA-CUSTODY) gets a recorded per-gate disposition in docs/defects/preview-dark-feature-deadlines-2026-11-01.md, judged only against its "Graduate only" condition on evidence from installed live builds. Two meet their condition (preview-conversation, preview-owned-obligations) and cannot be promoted in the register's replay phase; six do not. All eight stay dark with a recorded keep-dark review date of 2026-11-24 00:00 UTC. No status, metric, test or runtime behaviour changes.
Affected rules: 72 and 73 (a dark feature keeps its gate and a dated review; the deadline still fails a change to its feature after 2026-11-24, shown with --now on both sides); 62 and 9 (a live user-facing feature is registered only with a resolved live proof: the two met gates are not declared live because replay cannot resolve a record reference); 84 (the live runner's generated briefing is unchanged: moving a declaration to the pending file would have removed preview-conversation from it); 2 and 8 (nothing is silently extended: each date carries its reason, its next proof and who decides at the date); 116 (no new machinery; the repo's own record-live-proof, register replay and desk re-derivation chain).
Affected floors: secrets — untouched; the live journal was opened read only with the storage key from the secret store in the same command, never printed; spend cap — untouched, no model call; stop — untouched; no duplicate sends — nothing sent; durable intake — untouched; nothing was written to the live group root.
Operator questions: none required by the defect record, which lets Echo close a gate with keep-dark and a reason. Stated for the operator: the 2026-11-24 dates are keep-dark review dates, not a third extension; if the operator reads them as an extension, the alternative for the six unmet gates is retirement.
Suggested tier: significant
Declared tier: significant
Tier rationale: Register declaration dates and a defect record; no code path, prompt or runtime behaviour changes.
Side effects: Generated register outputs replayed for the new dates (generated/*). Owner-reference manifest pins re-derived for the two edited rungraph test artifacts. Two append-only record-live-proof rows written to proof-room roots (not the live root): live-proof:preview.obligations in preview-trial-root/proofroom2-dshort15-20261108-221842/proofs.jsonl (update 6237161) and live-proof:preview.reply in preview-trial-root/proofroom1-ps-20261108-221812/proofs.jsonl (update 367055964); backups of both files before the write are in .instar/lanes/gates-close-1109-probe/.
Undo and recovery: Revert the three commits; the earlier 2026-11-10/11 deadlines return (and would then be overdue). The two proof rows are harmless observations; leave them.
Multi-machine posture: Declaration and documentation only; the register check is deterministic per commit.
Layer below: Read docs/00-the-purpose.md and docs/01-the-rules.md. checkDeadlines (src/rulegraph/graph.ts) requires gate.deadline on every dark feature; P3-NF-20 (src/register/declarations.ts) requires liveProof on a non-dark user-facing feature; the register shape makes liveProof a record reference (e2e-run), and `build-register --replay` refused it on this tree: "unresolved preview-conversation.liveProof: record live-proof:preview.reply". tests/preview/capabilities.ts names preview.pending-declarations.json as the route for such declarations, which leaves the register and so the generated briefing.
Bug class: none
Bug evidence: none
Hook bypass: none. core.hooksPath unset in this clone; plain git commit.
Convergence: none
Decision: gates-close-D1 | Evidence was read from the live group journal read only (openPreviewJournal readOnly, as the agent-chat exporter does) and from the 217/219 post-install sets; every turn cited is named by journal update. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/gates-close-1109-PROGRESS.md
Decision: gates-close-D2 | preview-status-command stays dark: the status reply came from the journal but its turn made two model requests (reply review, Jev check), and the condition says "without a model request". | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/gates-close-1109-PROGRESS.md
Decision: gates-close-D3 | The two met gates are kept dark rather than moved to the pending file, because the move would change the running agent's briefing; the evidence and proof rows are recorded so a provider-backed regeneration can promote them. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/gates-close-1109-PROGRESS.md
Decision: gates-close-D4 | fetch-inbound-media had no written graduation condition; one is added to the defect record (current live build, stored photo and voice note with consumed claims, and a refused admission that keeps the message). | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/gates-close-1109-PROGRESS.md
Prompt review: none; no model-facing prompt, parser or accept/refuse decision changes.

Subject (15 paths): docs/defects/preview-dark-feature-deadlines-2026-11-01.md, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references.json, reviews/gates-close-1109-change-review.md, src/rungraph/rungraph.declarations.json, tests/preview/journal.declarations.json, tests/preview/media-admission.declarations.json, tests/rungraph/closure-registration-additivity.test.ts, tests/rungraph/scope.test.ts

## 1.x comparison

JKHeadley/instar main at acf21aeb728a2006d2a12f1cdb00244bf8f073d6: docs/specs/feature-maturation-ladder.md. A dark 1.x feature carries a ladder entry with a disposition ('ladder' | 'composed' | 'retire' | 'finished'), measured rung thresholds, and graduates only on its own logged behaviour; the server never moves a feature by itself. Reused here: a gate closes only on recorded evidence meeting its stated bar, or by an explicit recorded disposition with its reason, and the decision is reviewed, never automatic. No 1.x code fits: 2.0's gates live in the typed register declarations, so only the disposition discipline carries over.

## Closing block

simplestRobustRoute: Required outcome: every gate due by 2026-11-11 is closed by graduation or a recorded disposition before the ceiling, without overclaiming. Simplest route: judge each gate on existing live evidence, record the result per gate in the existing defect record, move the existing deadline field to a recorded review date, and replay the register with the desk chain. No code changes.
80/20: All eight gates judged with evidence paths; register check passes now and fails again after 2026-11-24, shown with --now on both sides; targeted tests on the two edited test files and the briefing tests.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
