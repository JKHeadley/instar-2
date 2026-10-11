# Change review — Repair design alignment review findings

Subject base: 309cf8e22f305c5490d9220608497076c380d14c
Review state: open
Reviewed content: none
Outcome: Resolve Astra round 1 MF1, N1 and N2 for PR #157: align the migration fixture with section 4, cite the current sign-off definition separately from live-review selection, and complete the affected-rule inventory. Documentation and derived publication only.
Affected rules: Purpose role-grant, sign-off and limit-source rules; Rules 18, 44, 45, 47, 49, 74, 90, 91, 93, 96, 101, 102, 103, 104, 109, 111, 113 and 116. Migration and its consumers retain current standing; identity and grounding across resume/compaction remain requirements; explicit opt-outs persist until superseded. New changelog versions preserve every previous entry.
Affected floors: secrets — custody unchanged; spend cap — resource limits unchanged; stop — stop and revocation unchanged; no duplicate sends — uncertain pending sends never replay; durable intake — authority-inert capture and missing-payload/receipt holds retained.
Operator questions: Final-head code-owner approval for docs/ remains the desk's landing responsibility. No constitutional amendment or new policy is proposed.
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Three prose repairs and the review inventory; no runtime source, model prompt, parser, executable test contract or authority change.
Side effects: Future implementers use current standing rather than an absent legacy flag; sign-off eligibility cannot be mistaken for live-review eligibility. Derived publication is regenerated from source commit 24cf0d58b70e5b77f01089eb39ed213dac5b3d54; existing Decision report paths point to the desk-copy destination for this round.
Undo and recovery: Publish a new documentation version and regenerate from that source; preserve all earlier history.
Multi-machine posture: Shared documentation and deterministic publication only; no runtime machine state, leases, replication or transport changes.
Layer below: Read docs/00-the-purpose.md and docs/01-the-rules.md in full, identical to origin/main; checked section 4 migration cases, glossary consequential-and-ordinary, recall section 8 selector, Rule 91, changelog ownership, change-review and register scripts, and the full Astra round 1 review.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: docs-align-r2-fixture | Replace only the stale default-silent expectation with the three existing section 4 cases, keeping authority-inert imports, missing-payload/receipt holds and uncertain-send no-repeat. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/docs-align-1010-r2-PROGRESS.md
Decision: docs-align-r2-recall | Cite the purpose sign-off list and glossary sign-off meaning; describe the irreversible historical-dependency selector separately without changing its policy or activation requirements. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/docs-align-1010-r2-PROGRESS.md
Decision: docs-align-r2-history | Complete the original open record's affected rules and add family changelog versions with byte-identical prior entries; regenerate existing publications from committed source if required. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/docs-align-1010-r2-PROGRESS.md

## Closing block

simplestRobustRoute: Correct the existing prose, preserve its history and use existing publication/check machinery; this is the simplest robust route and adds no mechanism or gate.
80/20: Verify the three corrections and preserved neighbors directly, run the required architecture, type, governed-document, register and change-review checks, and submit the pushed result for independent review. No runtime completion or live-agent proof is claimed.
VERDICT: author submission; independent review pending
