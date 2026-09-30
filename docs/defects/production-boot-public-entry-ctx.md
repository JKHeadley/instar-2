# Installed production bin refuses to boot: "Cannot read properties of undefined (reading 'ctx')" (Rule 37 quarantine)

**Status:** CLOSED 2026-09-29 (w3-bootctx). **Owner:** constitutional-build integration desk (Echo). **Opened:** 2026-09-28.

`tests/assembly/production-boot-public-entry.test.ts` — `installed bin boots the same public application and admits Four; fixture-admitted: …` — fails deterministically on `cint-1` and on a pristine built `2988aa95` (`/private/tmp/claude-501/cint1-livefix/re1.log`, `base-re1.log`, `rr2-failfiles.log`) with `AssertionError: production boot refused: Cannot read properties of undefined (reading 'ctx')` (the child exits 1 where 0 is expected).

**Cause (as first recorded):** not yet diagnosed. The refusal is a `TypeError` raised inside the installed `bin/instar-production.mjs` boot path, reached before admission completes; it is not an assertion about output. The declaration repair does not touch the boot path; the failure is identical on its base.

**Reproduce:** `npm run build && npx vitest run tests/assembly/production-boot-public-entry.test.ts` after removing the skip.

**Disposition:** the case is quarantined with `it.skip` and a comment linking here; its body and assertions are retained. While quarantined, the gate does not prove that the installed bin boots the same public application and admits Part Four. A green gate is reported as green with this quarantine named.

**Repair and closure:** the owner finds which object lacks `ctx` (run the child with the test's arguments and read the stack), repairs the cause, removes the skip and shows the case passing.

**Re-check on the cint-L2 merge (2026-09-28):** with the skip removed on the merged tree, the installed-bin case again failed while its sibling passed (`.instar/lanes/cint-L2-merge-quar1.log`). The quarantine stays.

**Multi-machine posture:** machine-local test. This record and the quarantine travel with the repository.

**Cause (diagnosed 2026-09-29):** the `TypeError` was raised in the test's installation host, not in the production boot. Stack from the child (instrumented on base `2988aa95`): `recordedCheckpoint` (`tests/assembly/production-boot-checkpoint.ts:6`) ← the host's `checkpoint` (`tests/assembly/production-boot-bin-host.ts:23`) ← `captureCheckpoint` (`tests/assembly/production-boot-installed-fixture.ts:81`) ← `owners.host.capture` (`tests/assembly/production-boot-owner-fixture.ts:65`) ← `configure` ← `src/assembly/production-application.ts:36`. `a5a734fc` (persist the initial preview capture before the signed fact) added an `initial-capture-durable` checkpoint that passes only `{ reference }`; the bin host treated every checkpoint payload as installed state and read `installed.f.ctx` on it. The public boot boundary correctly turned that thrown error into a refusal, so the production code was right to refuse: the defect was entirely in the fixture host.

**Repair:** already at the source in `11513eb7` (build 10, "repair the bin boot fixture host for the capture-durable checkpoint"): the host records nothing at `initial-capture-durable`, which is not a physical invocation and has no installed state yet. That commit landed after `cint-1`/`cint-L2` were cut, which is why the re-checks on those trees still failed; the skip was never lifted afterwards. No production code (`bin/instar-production.mjs`, `scripts/production-boot*.mjs`, `src/assembly/production-boot.ts`) changed or needed to change.

**Evidence (both sides):** with the skip removed, the installed-bin case fails on `11513eb7^` (`production boot refused: Cannot read properties of undefined (reading 'ctx')`, exit 1) and passes on `11513eb7`; on `cint-L5` (`85b46430`) the whole file passes (2/2) with the skip removed. The refusal side still holds: `tests/assembly/production-boot-command.test.ts` (the installed executable names every missing real binding and refuses) passes unchanged.

**Closure:** the `it.skip` is removed; the case runs in the gate again, proving that the installed bin boots the same public application and admits Part Four.
