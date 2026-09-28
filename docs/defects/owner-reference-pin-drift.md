# Owner-reference manifests pin stale hashes for two changed files (Rule 37 quarantine)

**Status:** OPEN. **Owner:** constitutional-build integration desk (Echo). **Opened:** 2026-09-28.

These cases fail deterministically on `cint-1` and on a pristine built `2988aa95` (runs retained as `/private/tmp/claude-501/cint1-livefix/full2.log`, `re1.log`, `base-re1.log`, and the pre-quarantine re-run `rr2-failfiles.log`):
- `tests/intake/governance.test.ts` — `P4-NF-06 R7 owner manifest pins the actual public implementations, contract and inspection assertions`: `src/facts/store.ts: expected 'sha256:5953d792…' to be 'sha256:82e29c69…'`.
- `tests/verification/provider-response-assessment.test.ts` — `P9-NF-64 P9-NF-65 P9-NF-66 registers only the exact Nine, Seven, and Ten fixture/decoder pairs`: `reference artifact hash differs: tests/rungraph/provider-answer-reply.test.ts`.
- `tests/e2e/register.test.ts`, `compiled register build adapter lifecycle` — `P3-NF-01 P3-NF-07 P3-NF-09 actual CLI reproduces committed outputs and rejects edited output`, `P3-NF-21 … R1 normal extract and completion workflows invoke the provider and full graph ladder`, `P3-P4-P5 shipped CLI resolves both owners, retains replay prerequisites and refuses broken intake consumer wiring`, `P3-P5 R2 same pinned commit refuses with and without an ambient bridge, and resolves a committed bridge`, `P3-P5 shipped CLI defaults resolve committed owner bindings, but never spoofed calls or stale artifacts`: each stops at `reference artifact hash differs` for one of the same two files.

**Cause (known):** `scripts/register-owner-references.mjs` checks each pinned artifact's committed bytes against `register-source/owner-references/*.json`. Two pinned files changed without a re-pin: `src/facts/store.ts` (commit `116b6bd7`, pinned in `part-four.json`) and `tests/rungraph/provider-answer-reply.test.ts` (the desk quarantine commit `a50cb9e7`, pinned in `part-ten.json`). Neither file is changed by the declaration repair. Note that quarantining these cases edits two further pinned files (`tests/intake/governance.test.ts`, `tests/verification/provider-response-assessment.test.ts`), which the re-pin must also cover.

**Reproduce:** `npx vitest run tests/intake/governance.test.ts tests/verification/provider-response-assessment.test.ts tests/e2e/register.test.ts` after removing the skips.

**Disposition:** each exact case is quarantined with `it.skip` and a comment linking here; bodies and assertions are retained. While quarantined, the gate does not prove the Part Four owner-manifest pins, the Nine/Seven/Ten fixture-decoder registration, or the compiled register CLI lifecycle (committed-output reproduction, provider ladder, owner resolution, bridge refusal, spoof refusal). A green gate is reported as green with this quarantine named.

**Repair and closure:** the owner confirms each changed file is intended, re-pins the owner-reference manifests with the existing pin tooling (for Part Four, `scripts/pin-intake-owner-references.mjs`), removes the skips, and shows every retained case passing.

**Multi-machine posture:** the tests are machine-local. This record and the quarantine travel with the repository.
