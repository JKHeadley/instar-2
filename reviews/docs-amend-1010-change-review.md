# Change review — Purpose: six amendments approved by Justin 2026-10-10

Subject base: a035d5ed1206d72d26a81861283dbbebe8f221f7
Review state: open
Reviewed content: none
Outcome: Write the six amendments approved in topic 102965 on 2026-10-10 at 17:23 PDT exactly as supplied. Align the rule book, glossary, onboarding policy and tests quoting the replaced definition. Regenerate sibling changelogs and the shape-only register through the existing replay chain. This is documentation and publication metadata; no runtime implementation or activation.
Affected rules: Purpose constraints 1–6 and its amendment authority; Rules 1, 4, 18, 23, 34, 38, 43, 62, 74, 76, 84, 86, 90, 91, 98, 101, 103, 104, 109, 111, 113 and 116. Exact quoted wording is preserved; related definitions distinguish verification from sign-off; four governed documents gain new changelog versions with earlier entry bytes preserved; no approval is inferred and no hook is bypassed.
Affected floors: secrets — all protection retained; spend cap — retained, sign-off never bypasses the cap; stop — retained; no duplicate sends — durable cause and uncertainty rules retained; durable intake — capture and standing requirements retained. No floor implementation changes.
Operator questions: final-head code-owner Approve from Justin is required before merge. The six amendment blocks are approved as worded; aligned explanatory prose is visible in this PR for that review. Do not merge this builder branch.
Suggested tier: critical
Declared tier: critical
Tier rationale: this changes the purpose and governing vocabulary, even though no runtime behavior is implemented.
Side effects: downstream designs still citing the old four-test definition need alignment. The report lists exact sentences and locations for the desk. Verification profiles remain conservative, while the glossary explicitly prevents interpreting them as extra sign-off requirements. Onboarding policy defaults follow the agreed role. Generated register bytes and their publication pins change together without entering-force authority.
Undo and recovery: revert the amendment and its aligned documentation through a new governed version; replay the register from that source. Preserve the approval and changelog history. No runtime state migration or deployment is involved.
Multi-machine posture: identical repository documentation and generated register on all machines; no machine-local authority, state, lease or replication changes.
Layer below: full purpose and rule book; the approved amendment draft; glossary profiles; policy P-05/P-06; build-register and register-source replay/anchor checks; changelog validator and renderer; change-review checker. Read the effect, verification-holder and harness-adapter design passages cited in the report.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: verification-versus-signoff | retain the existing critical/significant verification expressions while removing their equivalence to sign-off; five profile fields cannot determine the current role, resource threshold or sensitive designations. The purpose replaces the definition that imposed sign-off, not the safety and evidence floors. No runtime formula is changed in a docs-only unit. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/docs-amend-1010-PROGRESS.md
Decision: onboarding-policy | align P-05 and P-06 in the same change because their fixed starting restrictions and removed-rule reference otherwise contradict one-conversation role grants. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/docs-amend-1010-PROGRESS.md
Decision: publication-pins | regenerate the existing register publication anchor, hash literal and derived artifacts; these bind the documentation bytes and confer no runtime authority. No build logic changes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/docs-amend-1010-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: insert the exact approved text, update existing consumers and history, and replay the existing register. Add no runtime mechanism or new gate; retain independently enforced safeguards and verification while removing extra sign-off interpretations.
80/20: Exact-text and old-history preservation assertions pass; the governed-document and architecture checks pass; both directly affected test files pass all nine tests. Register replay, lint and change-review checks are recorded in the builder report against the final commit. Independent review and the operator's final-head approval remain the desk's landing requirements.
VERDICT: author submission; independent review pending
