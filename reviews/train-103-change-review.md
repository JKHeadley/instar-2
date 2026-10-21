# Change review — train-103 reviewed release train

Subject base: 9594add77f86c96b8084bf23a29dc005af26c8ba
Review state: open
Reviewed content: none
Outcome: Combine the five exact reviewed heads, preserving accepted live behavior, bounded never-sent retries, memory-list consequence guidance, status-only route notices, install dependency and channel formatting guidance.
Affected rules: 1, 10, 12, 24, 34, 37, 42, 47, 49, 55, 56, 69, 72, 73, 74, 84, 87, 90, 101, 102, 105, 111, 112, 113, 116
Affected floors: Secrets and spend caps unchanged; stop checked after retry waits; no duplicate sends through proof-of-never-sent only; durable intake and ownership unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Combined send-path and model-facing changes retain the existing critical verification bar.
Side effects: Retry duration grows to at most four attempts with 2/10/30-second waits only after proven never-sent outcomes. Platform guidance adds prompt bytes paid by the existing desk-status cut. The memoryList instruction remains model judgment, with Fable failure reproduction unproven in the member report. Formatting renderer ancestry from the reviewed briefing head is retained.
Undo and recovery: Revert affected reviewed behavior through a reviewed change and regenerate; preserve journals and never replay uncertain sends. No live deployment is performed.
Multi-machine posture: Existing conversation ownership and replicated journal remain unchanged. Pure briefing and formatting functions behave identically on every machine; dispatch retries remain local to the admitted sending owner.
Layer below: Full constitution, exact member diffs, downloaded Studio member reports and cint-L37 desk chain; transport outcome distinctions, existing deadline enforcement and promotion history inspected.
Bug class: unit
Bug evidence: reproducer=tests/preview/delivery-failure-notice.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains only sample files.
Convergence: none
Prompt review: Preserve the reviewed prompt changes. Member report records proof-room envelope 46040310 for channel guidance and updates 6235088/6235112 for memoryList. Fable reproduction remains unproven; no live model execution or new live acceptance claimed here. Existing instruction literals in tests are contract assertions, not keyword inference gates.
Prompt finding: 0abb3dc96311 | protocol-literal | Existing instruction or protocol literal asserted by the consumer fixture; not a phrase-based meaning classifier.
Prompt finding: 4106b49fff07 | protocol-literal | Existing instruction or protocol literal asserted by the consumer fixture; not a phrase-based meaning classifier.
Prompt finding: 42faf877ba82 | protocol-literal | Existing instruction or protocol literal asserted by the consumer fixture; not a phrase-based meaning classifier.
Prompt finding: 4b98dc2a1b9f | protocol-literal | Existing instruction or protocol literal asserted by the consumer fixture; not a phrase-based meaning classifier.
Prompt finding: 5b486d8bd247 | protocol-literal | Existing instruction or protocol literal asserted by the consumer fixture; not a phrase-based meaning classifier.
Prompt finding: 5fa1a20c4031 | protocol-literal | Existing instruction or protocol literal asserted by the consumer fixture; not a phrase-based meaning classifier.
Prompt finding: 7c45ffbe90ad | protocol-literal | Existing instruction or protocol literal asserted by the consumer fixture; not a phrase-based meaning classifier.
Prompt finding: 849db3a6296a | protocol-literal | Existing instruction or protocol literal asserted by the consumer fixture; not a phrase-based meaning classifier.
Prompt finding: 95e349aaf4ac | protocol-literal | Existing instruction or protocol literal asserted by the consumer fixture; not a phrase-based meaning classifier.
Prompt finding: aef7d91bef51 | protocol-literal | Existing instruction or protocol literal asserted by the consumer fixture; not a phrase-based meaning classifier.
Prompt finding: b1bb3946362d | protocol-literal | Existing instruction or protocol literal asserted by the consumer fixture; not a phrase-based meaning classifier.
Prompt finding: b288d6ef1604 | protocol-literal | Existing instruction or protocol literal asserted by the consumer fixture; not a phrase-based meaning classifier.
Prompt finding: e769ca9dd959 | protocol-literal | Existing instruction or protocol literal asserted by the consumer fixture; not a phrase-based meaning classifier.
Prompt finding: e8708c7fea24 | protocol-literal | Existing instruction or protocol literal asserted by the consumer fixture; not a phrase-based meaning classifier.
Prompt finding: f6d7f3274c85 | protocol-literal | Existing instruction or protocol literal asserted by the consumer fixture; not a phrase-based meaning classifier.
Prompt finding: feadb66b8ad1 | protocol-literal | Existing instruction or protocol literal asserted by the consumer fixture; not a phrase-based meaning classifier.
Decision: train-103-merge-connect | Merge exact e87fdce0f36056a1fb1f74b9269533337ebf9d88; bounded never-sent retry. Source report: walk-findings-1020-PROGRESS.md. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-103-PROGRESS.md
Decision: train-103-merge-memory | Merge exact c69933585db325d2d6d3bbe3f5836b5b29c3e406; consequence wording, preserving reported Fable proof limit. Source report: walk-findings-1020-PROGRESS.md. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-103-PROGRESS.md
Decision: train-103-merge-route | Merge exact 6441c52de436b12d552789d100faba670d1cb1d7; route maintenance stays on status. Source report: walk-findings-1020-PROGRESS.md. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-103-PROGRESS.md
Decision: train-103-merge-install | Merge exact f3d1e15a82c409657736dde843309c0a914df1c0; TypeScript runtime dependency. Source report: clean-install-1020-PROGRESS.md. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-103-PROGRESS.md
Decision: train-103-merge-briefing | Merge exact 5622ebff66e546de7f5f435e52a90f1373526ded; per-platform format guidance and its reviewed renderer ancestry. Source report: md-briefing-1020-PROGRESS.md. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-103-PROGRESS.md
Decision: train-103-A | Keep every source behavior; automatic source merges retain live correction acknowledgement and all five members. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-103-PROGRESS.md
Decision: train-103-B | Create branch directly at exact live base; no main merge and no branch movement. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-103-PROGRESS.md
Decision: train-103-C | No product conflict and no omitted member. Generated-only conflicts use base output provisionally, pending standard regeneration; never hand-merge generated content. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-103-PROGRESS.md
Decision: train-103-D | Skip macOS/Studio-bound integration and register end-to-end checks on WSL, and disclose unrelated host failures. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-103-PROGRESS.md
Decision: train-103-desk | Use downloaded desk repin, build, rehash and replay tools. Replay refused the expired preview.step-check deadline; do not claim regenerated output. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-103-PROGRESS.md
Decision: train-103-deadline | Preserve the expired step-check declaration and append-only promotion record. Repeated deadline extensions without graduation are not a repair (Rules 24, 72, 73). Its live procedure and promotion/retirement belong to the desk; no clock override or fabricated evidence. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-103-PROGRESS.md

Verification: Targeted member tests and direct source importers, journal tests and READY pinned tests; architecture, typecheck, lint, register and review checks. Exact outcomes in the report. No full suite.
simplestRobustRoute: This is the simplest robust route: ordinary merges of exact reviewed heads and the existing desk regeneration chain. No new machinery, authority or store. Start guards remain ownership and durable intake; dispatch keeps stop, spend, secrets and no-duplicate floors; release remains refused where graduation evidence is absent.
80/20: Targeted checks only; preserve useful merged work and report failed evidence honestly to the desk.
VERDICT: author submission for desk review; not independent convergence or live acceptance
