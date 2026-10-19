# Change review — train-85 deferred preparation integration

Subject base: 5b8a3230bdf7826f8628fade0f3a2c9d5a01135d
Review state: open
Reviewed content: none
Outcome: Integrate the reviewed deferred-answer preparation clarification onto the exact live train-82 base.
Affected rules: 1, 8, 10, 12, 22, 26, 34, 36, 37, 41, 46, 49, 58, 64, 69, 70, 71, 74, 83, 90, 92, 101, 102, 111, 112, 113, 116
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake retain existing guards; no runtime call, send authority, persistence schema or scheduling mechanism added.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The member changes model-facing scheduled-work instructions; this train integrates reviewed bytes and regenerates publication.
Side effects: Both tool and no-tool work routes distinguish preparation from delivery; actual unfinished work and missing input remain open. Report retention, delivery inhibition and receipt settlement are unchanged.
Undo and recovery: Revert the instruction and its documentation/tests through review, then regenerate publication; existing persisted records retain their shape and meaning. Never replay an uncertain send.
Multi-machine posture: Existing owner journal remains authoritative across machines; this train adds no state or coordination. Tests use isolated roots; WSL checks do not establish live acceptance.
Layer below: Read both constitutional documents, the member report and cint-L37 chain. Inspect existing work question, scheduler and delivery settlement; preserve train-82 renewal and retirement behavior. Generated publication uses the existing replay tool.
Bug class: integration
Bug evidence: reproducer=tests/preview/deferral-delivery.test.ts
Hook bypass: none; core.hooksPath unset, common hooks directory contains only samples.
Convergence: none
Prompt review: No new train-authored prompt or parser. Carry the reviewed clarification and provenance-bound fixture; replay recorded continue/report work outcomes and prior summary, uncertain, Jev, review and delivered/empty shapes. Member report: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/deferral-delivery-1018-PROGRESS.md.
Decision: train-85-merge | Ordinary merge of exact reviewed 68ef87fd4520619bcdd25af557e46eaa269ab9f8; member report read through the Studio API. Source merges cleanly. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-85-PROGRESS.md
Decision: train-85-A | Preserve the member instruction and test bytes together with all live-base behavior; only generated metadata conflicts, resolved by regeneration. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-85-PROGRESS.md
Decision: train-85-B | Create branch directly at exact live base 5b8a3230bdf7826f8628fade0f3a2c9d5a01135d; preserve ancestry, no main merge or branch movement. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-85-PROGRESS.md
Decision: train-85-C | No product conflict and no omitted head. Keep base generated output only as temporary merge input, then replace all generated artifacts through replay. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-85-PROGRESS.md
Decision: train-85-D | Run targeted WSL checks; report unchanged host-dependent failures separately. Studio owns live acceptance and absolute report files unavailable here. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-85-PROGRESS.md
Decision: train-85-desk | Use downloaded desk repin/build/rehash/replay chain, changing only macOS sed syntax for Linux. Guard constants and native certificate remain unchanged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-85-PROGRESS.md

Deferral: generated/register.json:1 | not-a-deferral=Existing declaration wording reproduced by the generator, not unfinished work.
Deferral: tests/preview/README.md:33 | not-a-deferral=Documentation of the shipped deferred-answer lifecycle, not unfinished builder work.
Deferral: tests/preview/deferral-delivery.test.ts:79 | not-a-deferral=Recorded deferred-work evidence and expected retained result, not unfinished builder work.
Deferral: tests/preview/fixtures/deferral-delivery-2026-10-18.json:18 | not-a-deferral=Recorded deferred-work evidence and expected retained result, not unfinished builder work.
Deferral: tests/preview/fixtures/deferral-delivery-2026-10-18.json:19 | not-a-deferral=Recorded deferred-work evidence and expected retained result, not unfinished builder work.
Deferral: tests/preview/fixtures/deferral-delivery-2026-10-18.json:24 | not-a-deferral=Recorded deferred-work evidence and expected retained result, not unfinished builder work.
Deferral: tests/preview/fixtures/deferral-delivery-2026-10-18.json:27 | not-a-deferral=Recorded deferred-work evidence and expected retained result, not unfinished builder work.
Deferral: tests/preview/fixtures/deferral-delivery-2026-10-18.json:43 | not-a-deferral=Recorded deferred-work evidence and expected retained result, not unfinished builder work.
Deferral: tests/preview/fixtures/deferral-delivery-2026-10-18.json:48 | not-a-deferral=Recorded deferred-work evidence and expected retained result, not unfinished builder work.
Deferral: tests/preview/fixtures/deferral-delivery-2026-10-18.json:51 | not-a-deferral=Recorded deferred-work evidence and expected retained result, not unfinished builder work.
Prompt finding: 4106b49fff07 | protocol-literal | Unchanged existing protocol text; not a semantic classifier copied from a fixture.
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged existing protocol text; not a semantic classifier copied from a fixture.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged existing protocol text; not a semantic classifier copied from a fixture.
Verification: Targeted member and direct importer tests, requested journal/subscription/register checks, final pinned subset, typecheck, lint, architecture, register and change-review checks; exact outcomes in the train report.
simplestRobustRoute: This is the simplest robust route: one ordinary reviewed-head merge and the existing desk chain. The member clarifies preparation versus delivery using existing scheduled work and retained reports; no new retry, classifier, state or send path. Durable intake starts work; completed substantive reports and receipts finish it; existing dependency, stop, spend and send guards remain. No new unattended live acceptance claim.
80/20: Targeted changed tests and direct importers plus explicitly required train checks; no full suite or base comparison worktree.
VERDICT: author submission for desk gate; no independent convergence or live acceptance claim
