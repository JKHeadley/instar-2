# Production boot conversation shards hang before their first checkpoint (Rule 37 quarantine)

**Status:** CLOSED (2026-09-29, cint-L3b post-check repair). **Owner:** constitutional-build integration desk (Echo). **Opened:** 2026-09-28.

`tests/assembly/production-boot-conversation-shard-{0,1,2,3}.test.ts` (each registers one case through `registerBootConversationShard` in `tests/assembly/production-boot-conversation.shared.ts`) did not finish on this host. The trace child (`bin/instar-production.mjs` with the `trace` action) listened on its local provider port and sat in an idle event loop: `sample` showed `uv__io_poll`/`kevent` at 0% CPU, and no snapshot was written. The evidence retained in `/private/tmp/claude-501/cint1-livefix/` is: `shard0-cint-1.log` (this branch; a start-only log, the run never reported a result), `base-shard0.log` (a pristine `2988aa95` checkout, which first failed only because compiled `production-holds.js` was missing before a build), `shard0-cint-1-basecheck.log` (a later start-only shard-0 log on that checkout once built), and `base-child.sample` (the idle child). Another builder's tree (cbuild-7) had the same child stuck for 58 minutes.

**Scope of the evidence:** this demonstrates a stall of shard 0 on this branch and on a built base checkout. It does not prove the same zero-checkpoint stall for all four shards or its exact duration; shards 1-3 were excluded from the full run rather than observed individually.

**Cause:** not yet diagnosed. The child appears to await a promise that never settles before its first durable checkpoint.

**Reproduce:** `npm run build && npx vitest run tests/assembly/production-boot-conversation-shard-0.test.ts` after removing the skip; while it runs, `sample <child pid>` on the `instar-production.mjs` child.

**Disposition:** the single registration in `production-boot-conversation.shared.ts` is quarantined with `it.skip` and a comment linking here, so all four shard files report one skipped case each; bodies and assertions are retained. While quarantined, the gate does not prove restored adjacent durable prefixes across SIGKILL/recovery for the 29 boot-conversation prefixes. `scripts/check-boot-conversation-evidence.mjs` refuses a skipped shard, so the boot-conversation evidence stays red until this record closes.

**Repair and closure:** the owner finds the unsettled wait (for example with `--inspect` on the child), repairs it, removes the skip and shows all four shards passing with receipts accepted by `check-boot-conversation-evidence.mjs`.

**Re-check on the cint-L2 merge (2026-09-28):** with the skip removed on the merged tree, shard 0 again stalled: after 20 minutes the `instar-production.mjs` child sat at 0% CPU in `uv__io_poll`/`kevent` (`sample`) and the run reported no result (`.instar/lanes/cint-L2-merge-shard0.log`). Shards 1-3 were not observed individually. The quarantine stays.

**Closure on cint-L3b (2026-09-29):** with the skip removed on the current tree (which now contains main `02753cdc`, including the RAM-backed test temp storage of #136), all four shards ran to completion in isolation on this host after `npm run build`: shard 0 in 52 s, shards 1, 2 and 3 in 47 s, 47 s and 52 s (`nice -n 10 npx vitest run <shard> --maxWorkers 1`), and `production-boot-conversation-evidence.test.ts` passed beside them. The trace child ran at full CPU instead of idling in `kevent`. The quarantine is removed, so the gate again runs all four shards and `scripts/check-boot-conversation-evidence.mjs` again checks their receipts against the full run. The stall's root cause was not isolated; if a shard stalls again in a full gate run, this record reopens with that run's log.

**Multi-machine posture:** machine-local test. This record and the quarantine travel with the repository.
