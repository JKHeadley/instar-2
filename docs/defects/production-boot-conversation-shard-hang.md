# Production boot conversation shards hang before their first checkpoint (Rule 37 quarantine)

**Status:** OPEN. **Owner:** constitutional-build integration desk (Echo). **Opened:** 2026-09-28.

`tests/assembly/production-boot-conversation-shard-{0,1,2,3}.test.ts` (each registers one case through `registerBootConversationShard` in `tests/assembly/production-boot-conversation.shared.ts`) did not finish on this host. The trace child (`bin/instar-production.mjs` with the `trace` action) listened on its local provider port and sat in an idle event loop: `sample` showed `uv__io_poll`/`kevent` at 0% CPU, and no snapshot was written. The evidence retained in `/private/tmp/claude-501/cint1-livefix/` is: `shard0-cint-1.log` (this branch; a start-only log, the run never reported a result), `base-shard0.log` (a pristine `2988aa95` checkout, which first failed only because compiled `production-holds.js` was missing before a build), `shard0-cint-1-basecheck.log` (a later start-only shard-0 log on that checkout once built), and `base-child.sample` (the idle child). Another builder's tree (cbuild-7) had the same child stuck for 58 minutes.

**Scope of the evidence:** this demonstrates a stall of shard 0 on this branch and on a built base checkout. It does not prove the same zero-checkpoint stall for all four shards or its exact duration; shards 1-3 were excluded from the full run rather than observed individually.

**Cause:** not yet diagnosed. The child appears to await a promise that never settles before its first durable checkpoint.

**Reproduce:** `npm run build && npx vitest run tests/assembly/production-boot-conversation-shard-0.test.ts` after removing the skip; while it runs, `sample <child pid>` on the `instar-production.mjs` child.

**Disposition:** the single registration in `production-boot-conversation.shared.ts` is quarantined with `it.skip` and a comment linking here, so all four shard files report one skipped case each; bodies and assertions are retained. While quarantined, the gate does not prove restored adjacent durable prefixes across SIGKILL/recovery for the 29 boot-conversation prefixes. `scripts/check-boot-conversation-evidence.mjs` refuses a skipped shard, so the boot-conversation evidence stays red until this record closes.

**Repair and closure:** the owner finds the unsettled wait (for example with `--inspect` on the child), repairs it, removes the skip and shows all four shards passing with receipts accepted by `check-boot-conversation-evidence.mjs`.

**Multi-machine posture:** machine-local test. This record and the quarantine travel with the repository.
