# Two-machine live proof (proof group T): Rules 31 and 63 on the Mac Studio and the Laptop

Status: plan. It cannot run until three preconditions hold:

1. **Operator decision D1** (below) is recorded.
2. **Runner wiring unit** has landed. It connects `tests/preview/journal-agent.mjs` to the shared conversation authority (`tests/preview/conversation-authority.ts`) and the serving step (`tests/preview/two-machine-serving.ts`), and adds the authority launcher. The flags named here are that unit's interface: `--machine-posture multi-machine`, `--conversation-authority URL`, `--authority-secret` (a SecretRef bound to `INSTAR_SECRET_PREVIEW_AUTHORITY_SECRET`), and `--owner-machine NAME`.

3. **Durable captured-input custody** is wired alongside D1 and history grounding. Telegram keeps an unconfirmed update for at most 24 hours regardless of the unadvanced offset (Bot API, "Getting updates"), so the shared settled cursor gives only bounded platform redelivery. Durable custody of captured input, and its reconciliation across a handover, comes from the existing intake/journal owner when the runner is wired. A bounded trial here is evidence for handover within that window, never general durable-intake proof.

Recorded coverage already exists for every check here: `tests/preview/two-machine-serving.test.ts` drives the same authority and serving step on a fake clock and a fake Telegram. This plan proves the same behaviour across two real machines, a real network and real Telegram.

## D1 — operator decision required before any check

Once a second machine is enrolled, the purpose document makes `replicated(1)` the default demand for a reply. An acknowledged copy must exist on the other machine, and local durability is never selected automatically after a peer is lost (docs/00, single-machine rules; docs/14 §"reference reply demand"). When one machine is really gone, ownership moves to the survivor, but under that default the survivor's replies wait until the peer returns. The operator chooses one:

- **D1-a (constitutional default):** replies on a peerless survivor are held, and input is preserved. Checks T2 and T5 then PASS on "held, then exactly one reply after the peer returns".
- **D1-b (preview waiver, Rule 94):** a recorded, preview-only waiver lets the survivor reply on local durability, named as a stand-in beside `fixture-effect-peer-directory`. Checks T2 and T5 then PASS on "exactly one reply from the survivor while the peer is gone".

## Topology

| Machine | Runs | Address |
|---|---|---|
| Mac Studio | the authority (single voter, design 10 §16) and one runner | authority on its Tailscale address `100.124.55.70`, port chosen by the desk |
| Laptop | one runner | reaches the authority over Tailscale |

Both runners use the same bot, chat and operator. Each has its own isolated preview root and `--owner-machine` (`studio`, `laptop`). They share the authority secret through host binding on each machine, never through arguments or logs. Lease term: 30 s. A runner gives up ownership locally one third before its term ends, and renews every 10 s.

Every process the desk starts is recorded by PID (`$!`) and stopped by that exact PID only. Load generators are never run on the Studio.

Observation surfaces used below:
- **Chat:** the test chat's visible reply bubbles.
- **Authority view:** `read` through the authority, which returns `epoch`, `holder`, `cursor`, `unresolved` and `claims`.
- **Authority log:** the hash-chained `acquire`, `expire`, `release`, `claim`, `outcome` and `settle` lines.
- **Runner log:** each root's `runs.jsonl` and its stderr role lines.

## Phase 1: a test copy (a throwaway preview bot and chat, synthetic messages)

**T0. Setup.** Start the authority on the Studio. Then start the Studio runner, then the Laptop runner.
PASS: the authority view shows `epoch 1` with `holder.machine = studio`. The Laptop runner reports `standby` and its log shows zero `getUpdates` calls.
FAIL: both report owner, or the Laptop polls.

**T1. One voice.** Send `T1-a`, `T1-b` and `T1-c` five seconds apart.
PASS: exactly three reply bubbles, all from the Studio runner. Afterwards `cursor` is one past T1-c's update id and `unresolved` is empty. The authority log has one `claim` per update, all with epoch 1.
FAIL: a fourth bubble, a missing reply after 60 s, or any `claim` by the Laptop.

**T2. The owner leaves mid-turn (non-authority owner).** Stop the Studio runner by its PID, so the Laptop acquires `epoch 2` within one term. Restart the Studio runner; it should come up as standby. Send `T2`. As soon as the Laptop's log shows the update was taken but before any reply appears, send `kill -STOP <laptop runner pid>`. Wait 45 s.
PASS (D1-b): exactly one `T2` reply, from the Studio. The authority log shows `expire 2` then `acquire 3 studio`, then `claim update:<T2>` at epoch 3. After `kill -CONT <pid>`, the Laptop's log shows `dispatch-claim refused: stale` or `lease lost` and it sends nothing.
PASS (D1-a): no reply while the Laptop is stopped. Exactly one reply after `kill -CONT` lets the Laptop return as the peer, and it comes from the epoch-3 owner.
FAIL: two `T2` replies, a reply from the stopped Laptop after resume, or no reply 60 s after the condition D1 requires.

**T3. A stale owner comes back.** This is the same run as T2, after `kill -CONT`. Send `T3`.
PASS: one `T3` reply from the current owner. The Laptop never polls, because standby never polls; its log shows no `getUpdates` after resume.
FAIL: any Laptop send or poll while it is not the holder.

**T4. Partition: each side thinks the other is gone.** Make the Laptop the owner again: stop the Studio runner by PID, wait for `acquire` by the Laptop, then restart the Studio runner as standby. On the Laptop run `tailscale down`. This cuts the authority link while ordinary internet, and so Telegram, stays up. Send `T4` immediately.
PASS: within 20 s the Laptop's log shows renewal unreachable, then `inhibited`, with no further `getUpdates`. Within 30 s plus one poll, the Studio acquires the next epoch and serves `T4`: once under D1-b, or held under D1-a until the peer returns. Then run `tailscale up`. The Laptop reports `standby`, and the total is exactly one `T4` reply.
FAIL: two `T4` replies, a Laptop send during the partition, or a Laptop poll after its inhibition.

**T5. The authority machine leaves.** The Studio is the owner. Stop both the Studio runner and the authority by their PIDs. Send `T5`.
PASS: no reply at all while they are down. The Laptop reports `inhibited` and never polls or sends; design 10 §9 and §16 say failover is unavailable in this direction. Restart the authority, then the Studio runner. After the authority's one-term restart hold, exactly one `T5` reply appears. The authority log's epoch continues from its previous value and is never reset.
FAIL: any reply while the authority is down, a duplicate after restore, or an epoch lower than before.

**T6. Authority restart under a live owner.** The Laptop is the owner. Stop the authority by PID and restart it within 10 s. Send `T6`.
PASS: the Laptop renews under the same epoch, because the restart honours one full term for the recorded lease, and it replies to `T6` once. The authority log is continuous and its chain verifies on reopen.
FAIL: a new epoch issued to the Studio during the restart hold, or any duplicate.

**T7. Restart honesty.** On every runner restart above, the restarted runner reports standby or owner from the authority and never from its own memory.
PASS: its first role line matches the authority view.

## Phase 2: Justin's own preview

This phase runs only after Phase 1 passes in full, with his explicit trial grant, synthetic non-sensitive messages, and the runner wiring unit deployed to both machines. Repeat T0, T1, T2 and T4 only. T5 and T6 deliberately take the agent offline, so the desk schedules them only with his agreement.

PASS and FAIL are exactly as in Phase 1. Any FAIL stops the phase. Both runners are stopped by PID, and the single-machine runner is restored by relaunching the Studio runner with `--machine-posture single-machine`, which is byte-identical to before.

## Expected and not a failure

- A transient Telegram `409 Conflict` on one poll during a handover. The previous owner's last long-poll (at most 5 s) overlaps the new owner's first. The runner's existing conflict handling retries.
- An update the old owner claimed but whose outcome never reached the authority stays in `unresolved` and is never resent. That is the honest unknown (design 10 §4). It is a FAIL only if the user received two replies.

## Honest limits of this proof

- Failover in both directions needs three voters (design 10 §2); this proves the one-voter shape.
- Conversation memory (the encrypted journal) stays on each machine. A runner that takes over answers without the other machine's history until journal replication exists.
