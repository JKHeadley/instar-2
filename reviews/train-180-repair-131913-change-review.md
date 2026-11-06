# Change review — train-180 receipt provenance and live merge repair

Subject base: cb9eff2361f72feaa53648461f699d51a8e31ecb
Review state: open
Reviewed content: none
Outcome: Normalize existing committed observation evidence into the merge planner receipt schema, then merge live 79be7e88 preserving both histories and candidate behavior.
Affected rules: 4, 14, 26, 56, 70, 74, 86, 90, 91, 95, 101, 102, 107, 111, 112, 113, 116
Affected floors: secrets — sanitized original evidence only; spend cap — no provider invocation or accounting change; stop — unchanged; no duplicate sends — no send or replay; durable intake — unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Existing evidence normalization and integration, with no new observation, freshness policy, mechanism or authority.
Side effects: The existing read-only planner can consume the candidate observation without changing either timestamp. Catalog listing remains weaker than invocation, quota or price proof. Native/full/live qualification remains with its existing gate.
Undo and recovery: Revert this repair and regenerate through existing register tooling; original source commits and observations remain available. No installation or live state is changed.
Multi-machine posture: Git distributes the receipt and merged source. The receipt explicitly preserves its local login-class observation and authenticated Studio catalog snapshot limits; it does not certify other hosts. WSL runs portable validation and Studio owns native/full/live qualification.
Layer below: Full purpose and rules; actual read-only resolve-provider-stamps.py proof_for/choose/plan; both committed declarations and receipts; candidate 8d03203de source README and unchanged catalog receipt with hash 524ad58cf5b581171e83ffa3d711d9d6a315f02c0ff11ae4cdd9b5c9be6873f1. The README independently records the subsidy review time; it is not inferred from catalog time.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory has sample hooks only.
Convergence: none
Prompt review: Evidence normalization changes no model prompt, output parser or accept/escalate/refuse policy. The live merge carries its existing post-claim send-settlement repair, session-volume growth and test barrier unchanged; candidate pre-send review logic is retained. No new interpretation of model outputs is introduced by this repair.
Decision: train180-receipt-normalize | Translate already committed catalog and explicit subsidy-review facts into the existing receipt schema, retaining both exact times and source hashes; no new observation is asserted. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-180-repair-131913-PROGRESS.md
Decision: train180-live-preserve | Merge the named live commit and preserve both behavior and history; retain the input selected by the unchanged provenance planner and derive publication through existing generators. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-180-repair-131913-PROGRESS.md

1.x comparison: Searched actual JKHeadley/instar main 7892696ce2a650b2a96135a26f119e79c1ae2612 src/, docs/specs/ and history for receipt binding, observation provenance, source pins and content hashes. Inspected src/core/CapabilityMapper.ts hashContent and contentHash comparisons, docs/specs/CAPABILITY-MAP-SPEC.md content hashing, history 2aaac4288, and authenticated ONEX-LESSONS.md section 6. Inherit the model-map comparison at bc4355b8075dad89e8667ab082c526c0460b0455 recorded in docs/evidence/model-map-refresh-1105/README.md: doorway-scan, model-registry-freshness, DOORWAY-MODEL-KNOWLEDGE-REGISTRY-SPEC and histories 35b02553b/6a61272ca42aa32683b06f9ae4c832371a877334. Reuse actual-byte hashing and bounded observation discipline. The searched 1.x capability mapper does not implement 2.0 committed merge receipt selection; retain the existing 2.0 checker.

Verification: Original committed inputs reproduce the exact refusal. Normalized original facts pass proof_for; deleting the independent subsidy review time, changing the catalog binding, and expiring the unchanged freshness window each refuse. No new provider request or freshness reset occurs.

Merge evidence: The unchanged read-only planner selected committed input 41f34e866bb4f47eefdb984671c57a1328babf3a with declaration SHA256 c68a7aa69df3b264e20d023094dfa4e51565b5f3e6068ca2de8b3c7009b20b26 and normalized receipt SHA256 95f5bcbb44782c35d286db0a8e202e0dda5beabddfea8fc37e9bac79c77eea2a. The incoming receipt is preserved byte-for-byte as docs/release-evidence/codex-model-map-refresh-1105-live-input.json; its absent independent subsidy review time is not filled in. The provider declaration is unchanged from candidate input. Ordinary Git merged journal-agent.mjs without a semantic conflict; all other executable incoming files are unchanged from live. Generated files are replayed after source commit, never hand-pinned.

Deferral: generated/register.json:1 | not-a-deferral=existing governing text in regenerated publication, not a new commitment

simplestRobustRoute: This is the simplest robust route: express existing recorded evidence in the existing consumer schema and merge through existing checks. No new gate, bypass, policy or capability restriction. Start is the two committed inputs; completion is a tested pushed merge; native and live checks retain their normal owners.
80/20: Scope verification to receipt selection, conflicted behavior and cheap gates; no full WSL suite or invented live qualification.
VERDICT: author submission; no independent convergence claimed
