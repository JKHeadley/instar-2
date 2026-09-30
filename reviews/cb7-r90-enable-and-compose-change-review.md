# Change review — cb7-r90: enable the account-assented declaration and compose createRegisterSpine under option (C)

Subject base: a44ddb7f84b95d33860afea7db56bc3b88d0c08e
Review state: open
Reviewed content: none
Outcome: Plan #94. Merges main 712a78a0, which carries the approval-gesture amendment (PR #139). With the amendment landed, the account-assented provenance is constitutional, so ONE edit turns on the declaration accountAuthenticatedAssent in src/decode/explicit-yes.ts. Its pinning test now binds the declaration to the amended Part Eleven sentence ("a chat reply outside part one's `account-assented` conditions are never yes"). scripts/slice-assembly.mjs's stub spine is replaced on the desk's option (C). Every declaration keeps a shape-only bootstrap row naming `bootstrap:shape-only`, never an approval fact, until an operator yes lands a governed version of the same id through createRegisterLanding. That version then supersedes the bootstrap row, and history keeps both. The extract, entering force and currency are answered by createRegisterSpine from durable governing records, not from memory. Those records live in a dedicated segment under the slice home, read BEFORE the fact log, because decoding the fact log binds to the register generation that these records decide. The first entering-force record is the spine's genesis anchor. A restart with an unchanged generation appends nothing. A non-empty fact log beside an empty governing segment refuses at boot. src/facts/register-spine.ts gains the optional bootstrap rows and governedExtract, the head extract that needs no anchor.
Affected rules: 2, 4, 7, 26, 28, 82, 90, 98, 105, 113, 116
Affected floors: secrets — unchanged (the landing appender's key is passed in, never read or logged); spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged (one-use yes); durable intake — unchanged (the governing segment is written before any intake fact and never touches intake)
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: turns on account-assented approval in the Part One Authorization decoder, and replaces the spine the slice register is verified against
Side effects: an account-assented chat reply or review approval that meets Part One's conditions now completes exactly one Authorization. Each slice home gains `governing/`, `governing-payloads/` and `peer-governing-payloads/`, with one entering-force record per register generation. An existing slice home that already holds facts but no governing segment refuses to boot. That is the loss detector: no deployed home predates this change, and a test home is disposable. Register entries keep their bootstrap rows, now labelled `bootstrap:shape-only` instead of the fabricated `slice:register-approval`, so the slice register generation id changes.
Undo and recovery: turning the declaration off again is the one-line flip to enabled:false, after which every recorded account-assent version refuses at the spine (fail closed). Reverting the slice composition restores the stub. The governing segment is additive and can be deleted together with its slice home.
Multi-machine posture: the governing fact segment is machine-local, and its payload custody copies to the slice's peer stand-in directory (the slice's own declared loss model). This is deliberate for the slice: the register generation must be settled before the replicated fact log can be decoded. Replicating the governing segment is the landing composition's job, named as the next unit with cb1-mf5. Until then, a second machine enters its own bootstrap generation and sees no governed version landed elsewhere, so nothing is double-counted.
Layer below: docs/00-the-purpose.md lines 81-92 and docs/05-the-types.md's account-assented paragraph (as amended by PR #139); src/register/generator.ts loadRegister and entry() (a bootstrap row must be superseded by the first governed row, or it would be a second head); src/register/governance.ts P3-NF-26 (enforced records need non-pending approvedIn, which bootstrap rows keep, per option (C)).
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: no system prompt, provider policy or invocationPolicyDigest changed
Deferral: none

Subject (paths): see the change-review check

## Closing block

simplestRobustRoute: required outcome: the slice register is verified against durable, recorded governing state, and one operator yes can land a governed version without a boot-time approval storm. Route: reuse createRegisterSpine and createRegisterLanding as built, the existing file fact storage and file custody helpers, and a bootstrap-row list that is plain data. The added pieces are the dedicated segment, which prevents a named failure (a boot-order cycle: the fact log cannot be decoded before the generation, and the generation depends on the governing records) and the loss check (Rule 2). There is no new store implementation and no new format. Start guard: the empty segment computes its generation from bootstrap rows. End-state guard: every row is either a bootstrap row or a verified governed row. Limit guard: one entering-force record per generation.
80/20: tests/facts/register-landing.test.ts 8/8, which now proves both sides of the bootstrap composition (a superseded bootstrap row forged live refuses, and bootstrap rows the spine was not given refuse). tests/integration/slice.test.ts passes, with a new test for bootstrap rows, restart reuse and loss refusal. tsc, lint, register:check and git diff --check are clean.
VERDICT: author submission; the independent verdict is recorded as a pass
