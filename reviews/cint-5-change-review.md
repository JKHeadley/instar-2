# Change review — cint-5: builds 7, 1 and 6 integrated on cint-1

Subject base: 2988aa95ac15cdc77e43700342c2d61adaafb0e9
Review state: open
Reviewed content: none
Outcome: One integration branch carries cint-1 (int13 plus build 4, live as frozen18) and three constitutional builds, merged in order with no approved behaviour dropped: build 7 (every change is bound to one review record carrying its evidence, a start-bound full gate and an append-only evidence ledger; landing admits only an accepting, non-withholding exact-tree review), build 1 (the register reads the shipped inventory of the four launchers, checks documentation, stores, bindings, parser evidence and capability lines on it, and the live journal runner's capability-note source is generated from the feature declarations), and build 6 (a host resource owner with Six allocation and Ten observation on the launch path, measured resource outcomes, the doorway map and secret custody). Conflicts were confined to generated output (regenerated), the 2000-turn packet pin, the recorded bin host and the self-state fixture (the same fix on both sides) and three hunks of the journal runner (status keeps build 4's obligation fields and takes build 6's measured reply timings; each tick runs build 4's obligation step and then build 6's doorway check). The combined tree needed three truth repairs that neither build could see alone: build 6's resource owner writes durable state, so build 1's shipped-inventory check refused the register until its store was declared beside it (machine-local, deletes); build 4's Rule 86 release means the reply review no longer fails closed in every case, so its declaration now carries a closed rung and an open rung matching the code and review-unavailable-release.test.ts; and build 4's owned obligations were missing from the generated briefing, whose delivered text now says nothing else is available, so they are declared as a dark feature with one short capability line and a graduation test (journal-obligations.test.ts); the line is kept to 182 characters because a 430-character version measurably crowded the open commitments out of the packet at compaction (journal-commitments live-script case: commitments 0 at summary-plus-recent), and carrying open commitments outranks describing them. The packet digest was re-pinned after a structural diff against cint-1's packet showed only the capability field changed. Build 1's deferred Rule 36 parser holds are carried by one open defect record. One test reads build 6's doorway observation on a real-shaped Claude Code result frame (a dated helper model listed before the requested model), the model-output format the live map depends on. Status is PARTIAL for exactly the three blocked items in the progress record: build 6 physical confinement, build 7 Rule 90 approval closure, and build 1 MUST-FIX 5 (the expiry and capacity rungs still carry the ruled-three label that finding names).
Affected rules: 1, 4, 5, 6, 7, 8, 12, 13, 26, 27, 32, 36, 37, 39, 40, 42, 48, 49, 55, 56, 57, 60, 61, 65, 66, 69, 70, 71, 74, 78, 82, 83, 84, 86, 90, 91, 93, 95, 99, 100, 101, 107, 109, 111, 112, 113, 114, 116
Affected floors: secrets — unchanged in behaviour (build 6's secret custody and redaction additions are its reviewed code; no secret value is logged or declared, and the reply review's credential rung stays closed); spend cap — unchanged (Six allocation bounds launches, the review's spend-cap refusal still holds a reply); stop — unchanged (the operator stop and expiry gate code is untouched; its declaration still carries the finding-5 label, recorded as blocked); no duplicate sends — unchanged (the Rule 86 release sends once and an UNKNOWN review is never repeated); durable intake — unchanged (journal, preview system prompt, provider policy and invocationPolicyDigest are untouched; only the capability-note source text and the packet's capability field changed, from build 1)
Operator questions: (1) Rule 82: build 1 changes protected register and rule-graph toolchain paths (src/register/**, src/rulegraph/**, scripts/*register*.mjs, tests/register/**, tests/rulegraph/**, register-source/**, tests/e2e/register.test.ts), so its landing needs the operator's approval of those paths; (2) the version-chain authorization and landing provider: authorizing the register's move out of conversion mode with a real part-two provider is what closes build 7's Rule 90 approval and build 1's MUST-FIX 5, and no builder can supply it; (3) the same Rule 82 approval covers this integration's one edit to that protected register e2e file: the Rule 37 quarantine of its R2 ambient-bridge case, which flipped (87 s red in the loaded gate, 13 s green alone on the same tree) and is recorded in docs/defects/register-e2e-timeout.md; declining it leaves that case red rather than changing anything else
Suggested tier: critical
Declared tier: critical
Tier rationale: the live journal runner, its launch-path resource enforcement and the register toolchain all change, and the capability text the live model reads changes
Side effects: the live runner's capability-note source becomes the generated briefing (Rules 78, 84) and now lists preview-owned-obligations among what the agent can do for the operator (available, user-facing, dark until its graduation test and live proof); the packet's capability field shortens to usage instructions; the journal runner launches its provider children through build 6's resource owner, adds resource, doorway and secret-custody status fields, and checks doorways once per tick after obligation work; npm run test:all runs the change-review gate, and every later commit needs a review record; the register reads the shipped inventory and refuses undeclared writers, unused bindings, missing READMEs and capability-line drift; the reply-review declaration gains two rungs (no runtime change); a new store declaration for scripts/resource-owner.mjs and a new defect record for the three synthetic-byte parsers; the preview owner manifest gains the PREVIEW-OWNED-OBLIGATIONS fixture row
Undo and recovery: revert this merge chain to return to cint-1 (2988aa95); each build's own undo remains as its progress record states (build 7: restore lanes/desk-landing-check.mjs from its backup; build 6: the resource owner's ledger and state files are inert once its import is removed; build 1: regenerate generated/ from the reverted sources). The live journal is untouched and replays unchanged; the runner must be restarted onto a checkout with regenerated generated/ for the briefing to apply
Multi-machine posture: machine-local, deliberately: the evidence ledger lives in the local git common directory (build 7), the resource owner's launch ledger and outcomes describe this host's own processes (build 6, declared machine-local), and the register and briefing are generated per checkout from committed inputs (build 1); nothing here adds a peer dependency, so the one-machine installation keeps every function
Layer below: docs/00-the-purpose.md and docs/01-the-rules.md (read in full); src/register/workflow.ts P3-NF-26/27 (the replay approved-history requirement that keeps finding 5 blocked), src/register/governance.ts readEnforcedRecord and src/register/rungs.ts (the rung shape the reply-review declaration now uses); src/facts/version-chain.ts decodeVersion (no committed provider); scripts/register-shipped.mjs R7/R32/R66/R78 on the combined inventory; tests/preview/journal.ts jevNonSecretFlags and reviewUnavailableReleases with tests/preview/review-unavailable-release.test.ts (both sides of the Rule 86 rung); tests/preview/obligations.ts and journal-obligations.test.ts (the feature line); scripts/resource-owner.mjs durableWrite (the declared store); tests/preview/doorway-map.ts subscriptionExchange and observeExchange against the modelUsage shape of genuine result frames in the desk's run logs; the desk's desk-rehash-owner-manifests.mjs, desk-repin-chain.sh and desk-pin-preflight.mjs (derived pins, run as the desk runs them)
Bug class: integration
Bug evidence: reproducer=tests/preview/capability-briefing.test.ts
Hook bypass: none
Convergence: none
Prompt review: the only prompt-source changes are build 1's capability field and generated capability-note text; no fixture trigger phrase was copied into a prompt and no dispatch states its expected answer; the four fixture-phrase findings below are standing protocol text the tests check for, not triggers
Prompt finding: 450c79237a95 | protocol-literal | the provider guidance sentence about disagreeing memory items is the instruction itself; the people test asserts the instruction is present
Prompt finding: 849db3a6296a | protocol-literal | the runner's fixed reply when no memory is saved; the memory-list test asserts that fixed text
Prompt finding: bd01de21286a | protocol-literal | the packet instruction to cite sourceLabel, retained verbatim from cint-1 in the capability field; the hallucination-rate test checks the instruction is carried
Prompt finding: fb5fa7e706c8 | protocol-literal | the packet instruction for questions about what the operator said, retained verbatim from cint-1; the test checks the instruction is carried
Deferral: scripts/change-review.mjs:49 | not-a-deferral=the placeholder pattern lists TODO/TBD so they are refused as field values
Deferral: scripts/change-review.mjs:159 | not-a-deferral=a comment naming the rule that dispositions deferrals
Deferral: scripts/change-review.mjs:160 | not-a-deferral=the deferral pattern itself
Deferral: scripts/change-review.mjs:161 | not-a-deferral=the skip pattern line, adjacent to the deferral pattern
Deferral: scripts/register-shipped.mjs:128 | not-a-deferral=a comment describing how the check treats a deferred Rule 36 hold
Deferral: scripts/register-shipped.mjs:136 | not-a-deferral=the check reading the deferred hold class
Deferral: scripts/register-shipped.mjs:138 | not-a-deferral=the error text naming a missing deferred loop
Deferral: src/conversation/slack.parser.json:50 | commitment=docs/defects/rule-36-genuine-parser-captures.md
Deferral: src/conversation/telegram.parser.json:33 | commitment=docs/defects/rule-36-genuine-parser-captures.md
Deferral: src/rulegraph/README.md:3 | not-a-deferral=module documentation of how deferred holds become owned loops
Deferral: src/rulegraph/graph.ts:79 | not-a-deferral=a comment on the owned loop the rule graph mints for deferred holds
Deferral: src/rulegraph/graph.ts:81 | not-a-deferral=the code selecting deferred holds
Deferral: src/rulegraph/graph.ts:84 | not-a-deferral=the error text for an unknown deferred part
Deferral: src/rulegraph/graph.ts:85 | not-a-deferral=the owned loop id for a deferred hold
Deferral: tests/e2e/register.test.ts:138 | not-a-deferral=a test comment on expected deferred loops
Deferral: tests/e2e/register.test.ts:140 | not-a-deferral=test code collecting deferred loops
Deferral: tests/e2e/register.test.ts:141 | not-a-deferral=test code collecting deferred loops
Deferral: tests/e2e/register.test.ts:143 | not-a-deferral=test code comparing expected loops
Deferral: tests/preview/reply-check.declarations.json:124 | commitment=docs/defects/rule-36-genuine-parser-captures.md
Deferral: tests/register/change-review-git.test.ts:142 | not-a-deferral=fixture text proving generated output is not scanned while the same authored text is
Deferral: tests/register/change-review-git.test.ts:143 | not-a-deferral=fixture text proving generated output is not scanned while the same authored text is
Deferral: tests/register/change-review-git.test.ts:145 | not-a-deferral=fixture text proving generated output is not scanned while the same authored text is
Deferral: tests/register/change-review-git.test.ts:149 | not-a-deferral=fixture text proving generated output is not scanned while the same authored text is
Deferral: tests/register/change-review.test.ts:30 | not-a-deferral=a test proving TBD is refused as a field value
Deferral: tests/register/change-review.test.ts:89 | not-a-deferral=fixture input lines for the deferral detector
Deferral: tests/register/change-review.test.ts:99 | not-a-deferral=a fixture record carrying fixture dispositions
Deferral: tests/register/shipped.test.ts:85 | not-a-deferral=a test title about the deferred-loop alternative
Deferral: tests/register/shipped.test.ts:98 | not-a-deferral=a fixture deferred hold
Deferral: tests/register/shipped.test.ts:100 | not-a-deferral=test code applying the fixture hold
Deferral: tests/rulegraph/graph.test.ts:17 | not-a-deferral=rule-graph test fixtures and assertions for deferred holds
Deferral: tests/rulegraph/graph.test.ts:20 | not-a-deferral=rule-graph test fixtures and assertions for deferred holds
Deferral: tests/rulegraph/graph.test.ts:26 | not-a-deferral=rule-graph test fixtures and assertions for deferred holds
Deferral: tests/rulegraph/graph.test.ts:27 | not-a-deferral=rule-graph test fixtures and assertions for deferred holds
Deferral: tests/rulegraph/graph.test.ts:29 | not-a-deferral=rule-graph test fixtures and assertions for deferred holds
Deferral: tests/rulegraph/graph.test.ts:31 | not-a-deferral=rule-graph test fixtures and assertions for deferred holds
Deferral: tests/rulegraph/graph.test.ts:33 | not-a-deferral=rule-graph test fixtures and assertions for deferred holds
Deferral: docs/defects/rule-36-genuine-parser-captures.md:1 | commitment=docs/defects/rule-36-genuine-parser-captures.md
Deferral: docs/defects/rule-36-genuine-parser-captures.md:3 | commitment=docs/defects/rule-36-genuine-parser-captures.md
Deferral: docs/defects/rule-36-genuine-parser-captures.md:9 | commitment=docs/defects/rule-36-genuine-parser-captures.md
Deferral: docs/defects/rule-36-genuine-parser-captures.md:10 | commitment=docs/defects/rule-36-genuine-parser-captures.md
Deferral: docs/defects/rule-36-genuine-parser-captures.md:11 | commitment=docs/defects/rule-36-genuine-parser-captures.md
Deferral: docs/defects/rule-36-genuine-parser-captures.md:15 | commitment=docs/defects/rule-36-genuine-parser-captures.md
Skip: tests/e2e/register.test.ts:373 | quarantine=docs/defects/register-e2e-timeout.md
Skip: tests/preview/journal-assembled.test.ts:15 | quarantine=docs/defects/preview-journal-load-timing-flake.md
Skip: tests/preview/journal-audit.test.ts:272 | quarantine=docs/defects/preview-journal-load-timing-flake.md
Skip: tests/preview/journal-dated-memory.test.ts:97 | quarantine=docs/defects/preview-journal-load-timing-flake.md
Skip: tests/register/change-review.test.ts:90 | scope=a string fixture for the skip detector, not a skipped test

## Closing block

simplestRobustRoute: Merge the three reviewed builds as they are and repair only what the combined tree makes untrue, through each build's existing mechanism: one store declaration beside the new writer, one declaration's rungs matched to the code, one feature line and declaration for the capability the briefing omitted, one re-pin backed by a packet diff, and one defect record for the already-owned parser debts. No new service, register kind, checker or authority store; the blocked items stay with their owners rather than being relabelled.
80/20: Every conflict and combined-tree truth gap is resolved inside existing mechanisms; status stays PARTIAL for the three recorded blocked items only.
VERDICT: author submission; the independent verdict is recorded as a pass in the evidence ledger
