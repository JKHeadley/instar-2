# Change review — cb7-r90: account-authenticated explicit yes behind one declaration, and the Part Two landing provider

Subject base: 60e5bb9e2027a822d98b2ec756b8b937569255af
Review state: open
Reviewed content: none
Outcome: Plan #91. Adds the smallest production explicit-yes source (src/operator/explicit-yes.ts) with two paths: the verified operator account replying `yes <request id>` in the bound chat, recorded with the chat message id; and, where a recorded P-05 grant lets the agent speak through that chat account, an APPROVED review by the pinned operator GitHub account on a PR whose body names the request id, recorded with the review id. Each yes is one use and must fall inside the request lifetime; Part One's decoder remains the authority. Both are account-authenticated assent (channel-attested), which the constitution as written does not accept, so they are admitted only under ONE declaration, accountAuthenticatedAssent in src/decode/explicit-yes.ts, shipped OFF; the decoder, decodeVersion and the register spine all ask isExplicitYes there. Adds the Part Two landing provider (src/facts/register-landing.ts): it decodes a version with decodeVersion on a decoded explicit-yes Authorization, refuses a reused yes, appends the approval/version/generation governing records, and rebuilds the spine from the fact log so it survives a restart; a lost payload refuses loudly. Not done here: composing createRegisterSpine in place of scripts/slice-assembly.mjs's stub (see the PROGRESS record's open design question).
Affected rules: 2, 4, 7, 26, 28, 42, 82, 90, 98, 105, 116
Affected floors: secrets — unchanged (the landing appender's signing key is passed in, never read or logged); spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged (one-use yes refuses a replayed message/review id); durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: touches the Part One Authorization decoder, the authority behind every approval
Side effects: with the declaration off, behaviour is unchanged: the same records refuse as before (the decoder's error text now names the declaration). A new account-assent recordType is refused unless the declaration is on. The landing provider has no production caller yet.
Undo and recovery: revert the three commits; no durable format written in production (the provider has no caller). After the amendment, disabling is the one-line flip back to enabled:false, which makes every recorded account-assent version refuse at the spine (fail closed).
Multi-machine posture: governing records are ordinary signed facts and replicate with the fact log; the one-use check reads the whole log, so two machines cannot both land the same yes once replicated. Before replication catches up, two machines could each record the same yes; an identical landing collapses to one row (walkVersions), and one differing only in supersedes surfaces as a version fork with the reviewed incumbent in force.
Layer below: docs/00-the-purpose.md line 81-85 and docs/15-the-operator-surfaces.md section 2 (both refuse account-authenticated assent today, which is why the declaration ships off and a test pins the declaration to that text); src/facts/register-spine.ts and version-chain.ts (PR 138).
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: no system prompt, provider policy or invocationPolicyDigest changed
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (24 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/part-four.json, scripts/check-assembly-contracts.mjs, src/assembly/harness.declarations.json, src/decode/README.md, src/decode/decode.ts, src/decode/explicit-yes.ts, src/facts/README.md, src/facts/index.ts, src/facts/register-landing.ts, src/facts/register-spine.ts, src/facts/version-chain.ts, src/index.ts, src/operator/README.md, src/operator/explicit-yes.ts, src/operator/index.ts, tests/assembly/production-grounding-inventory.json, tests/facts/register-landing.test.ts

## Closing block

simplestRobustRoute: required outcome: a real operator yes that Part One decodes and Part Two lands with history kept. Route: reuse the existing channel-attested Provenance, Authorization, decodeVersion and createRegisterSpine; add only a pure producer (exact-match guards, no model), one boolean declaration, and a provider that appends three signed facts and rebuilds from the log. No new provenance class, no new store, no custody format beyond content-addressed bytes. Start guard: declaration off; end-state guard: every reader asks one function; limit guard: one use, request lifetime.
80/20: module documentation entries added (Rule 5); git diff --check clean; tsc, npm run lint, register:check pass; tests/facts/register-landing.test.ts 6/6 proves both sides of the declaration, one use, lifetime, P-05 routing, restart survival and loud custody loss; tests/facts, tests/types, tests/decode, tests/unit, tests/intake, tests/register, tests/operator and the harness contract (8/8 x3) pass.
VERDICT: author submission; the independent verdict is recorded as a pass
