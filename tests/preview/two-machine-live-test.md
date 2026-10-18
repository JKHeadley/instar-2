# Two-machine live proof (proof group T): Rules 31 and 63 on the Mac Studio and the Laptop

Status: plan, runnable. Decision D1 is taken as (a), the constitutional default, and the runner wiring has landed.

**D1(a), in one paragraph.** The purpose document says that once a second machine is enrolled, `replicated(1)` is the default demand for a reply, and that falling back to local durability when the peer is lost refuses. So a reply is sent only after the other machine has acknowledged the journal through that reply's record. When one machine is really gone, the survivor takes the conversation over with the history, keeps reading messages, and its replies **wait** until the other machine is back. No waiver is taken. A survivor that replies alone would be a change to the constitution, which only the operator can make.

**Bounded retention.** Telegram keeps an unconfirmed update for at most 24 hours regardless of the unadvanced offset (Bot API, "Getting updates"), so the shared settled cursor by itself gives only bounded platform redelivery. Durable custody of captured input comes from the journal: the cursor passes an update only once the peer has acknowledged the journal's intake record for it. Input that no runner has read into a journal (for example while the authority machine is away and nothing is admitted) still waits at Telegram within that 24-hour window only. A bounded trial here is evidence for handover within that window, never general durable-intake proof for unread input.

Recorded coverage of every check here already exists on real runner processes on one host: `tests/preview/two-machine-runner.test.ts` and `two-machine-floors.test.ts` (two runners, one real authority process, real HTTP), with `tests/preview/journal-replication.test.ts` and `tests/preview/two-machine-serving.test.ts` underneath. This plan proves the same behaviour across two real machines, a real network and real Telegram.

## What runs where

| Machine | Runs | Address |
|---|---|---|
| Mac Studio | the authority (one voter, design 10 §16) and one runner | authority and journal-copy port on its Tailscale address `100.124.55.70`; ports chosen by the desk |
| Laptop | one runner | reaches both over Tailscale; its own journal-copy port on its Tailscale address |

The authority:

```
node --no-warnings --loader ./scripts/slice-ts-loader.mjs tests/preview/conversation-authority-server.mjs \
  --path <authority log> --bot-id <bot> --chat-id <chat> --host <studio tailscale address> --port <A>
```

Each runner is the ordinary `journal-agent.mjs run …` command with these additions:

```
--machine-posture multi-machine --conversation-authority http://<studio>:<A> \
--replica-listen <this machine's tailscale address>:<R> --replica-peer http://<other machine>:<R'> \
--owner-machine studio|laptop
```

- The shared secret is bound by the host on all three processes as `INSTAR_SECRET_PREVIEW_AUTHORITY_SECRET`. It is never an argument and never logged.
- Both runners use the same bot, chat, operator and the same storage SecretRef. The copy is the journal's own sealed bytes, so the successor can only read it with the same key.
- **Exactly one machine is started with `--journal-lineage seed`**, once, on the first start: the machine whose journal becomes the shared history (a fresh root creates a new journal). The flag works only while the authority has never issued a lease. A machine with no enrolled history never takes the conversation; it waits to receive the copy.
- Lease term 30 s. The owner renews every 10 s and stops acting as owner 10 s before its term would end.
- Each runner must be started by its host supervisor (`scripts/host-watch.mjs`) or relaunched by hand: a standby that reaches its cycle limit and an owner that lost the lease both end as `queued`, meaning "start me again".

Every process the desk starts is recorded by PID (`$!`) and stopped by that exact PID only. Load generators are never run on the Studio.

Observation surfaces:
- **Chat:** the test chat's visible reply bubbles.
- **Authority view:** `read` through the authority: `epoch`, `holder`, `cursor`, `unresolved`, `claims`.
- **Authority log:** the hash-chained `acquire`, `expire`, `release`, `claim`, `outcome` and `settle` lines.
- **Runner stderr:** the role lines (`standby: …`, `owner: epoch N; history seeded|continued|adopted`, `replies wait for the other machine …`, `the other machine acknowledged the journal; replies are sent`).
- **Runner status** (`journal-agent.mjs status --root …`): `sharedHistory.lineage`, `sharedHistory.copy`, `sharedHistory.replication` (`peerCurrent`, `reason`, `acknowledgedBytes`, `journalBytes`, `settledCursor`) and `sharedHistory.setAside`.
- **Run log:** each root's `runs.jsonl`.

## Phase 1: a test copy (a throwaway preview bot and chat, synthetic messages)

**T0. Setup.** Start the authority. Start the Studio runner with `--journal-lineage seed`, then the Laptop runner without it.
PASS: the Studio's stderr says `owner: epoch 1; history seeded`. The Laptop's says `standby: held by studio`, and its Telegram call log shows zero `getUpdates`. The Studio's status shows `replication.peerCurrent: true`, and the Laptop's status shows `sharedHistory.copy` from `studio` at epoch 1.
FAIL: both report owner, the Laptop polls, or the Studio reports the peer as not current while the Laptop is up.

**T1. One voice, with the record on both machines first.** Send `T1-a`, `T1-b` and `T1-c` five seconds apart.
PASS: exactly three reply bubbles, all from the Studio runner. Afterwards `cursor` is one past T1-c's update id, `unresolved` is empty, and the authority log has one `claim` per reply, all at epoch 1. The Laptop's `copy.size` equals the Studio's `replication.journalBytes` within one poll cycle.
FAIL: a fourth bubble, a missing reply after 60 s, or any `claim` by the Laptop.

**T2. The peer goes away: replies are held, not sent on local durability.** Stop the Laptop runner by its PID. Send `T2`. Wait 60 s.
PASS: no `T2` reply. The Studio's stderr says `replies wait for the other machine to acknowledge the journal (…); nothing is sent on local durability`. Its status shows `turns` one higher (the message is in its journal), `calls` unchanged (no model call was made), and `replication.peerCurrent: false`. The authority `cursor` has NOT passed `T2`, so Telegram still holds it. Then start the Laptop runner again. Within 30 s there is exactly one `T2` reply, from the Studio, and the cursor passes `T2`.
FAIL: a `T2` reply while the Laptop is down, two `T2` replies, or none 60 s after the Laptop is back.

**T3. The owner machine is lost: the other takes over with the history, and waits for its peer.** Stop the Studio runner by PID with `SIGKILL` (no clean hand-back). Send `T3`.
PASS: within one term plus a few seconds the Laptop's stderr says `owner: epoch 2; history adopted`. Its status shows the T1 and T2 exchanges in `turns` and `replies`, and `lineage.adopted` from `studio`. It reads `T3` (`turns` rises) and sends nothing. Then start the Studio runner again (no seed flag). It reports `standby: held by laptop` and never polls. Within 30 s there is exactly one `T3` reply, from the Laptop.
FAIL: a `T3` reply before the Studio runner is back, two `T3` replies, a Laptop journal without the earlier exchanges, or any Studio poll while it is the standby.

**T4. A stalled owner comes back stale.** The Laptop is the owner. Send `kill -STOP <laptop runner pid>` and wait 45 s. The Studio takes over (`owner: epoch 3; history adopted`). Send `T4`. Then `kill -CONT <laptop runner pid>`.
PASS: the resumed Laptop runner sends nothing and exits with the run-log row `conversation ownership lost` (`retired`, `revival: queued`). After it is relaunched it reports `standby: held by studio`, and there is exactly one `T4` reply, from the Studio. The Studio's status lists one file under `sharedHistory.setAside`: its own older journal, kept.
FAIL: any send from the resumed Laptop runner, two `T4` replies, or a missing set-aside file.

**T5. Partition: each side thinks the other is gone.** The Studio is the owner. On the Laptop run `tailscale down`. This cuts the Laptop from the authority and from the Studio's copy port, while Telegram stays reachable from both. Send `T5`.
PASS: the Studio keeps the lease (the authority is local to it) and reports `replies wait for the other machine …`. No `T5` reply. The Laptop reports `standby` or `inhibited: authority unreachable` and never polls or sends. Then run `tailscale up`: within 30 s there is exactly one `T5` reply, from the Studio.
FAIL: a `T5` reply during the partition, two `T5` replies, or any Laptop poll.

**T6. The authority machine leaves.** The Laptop is the owner (stop the Studio runner cleanly, wait for the Laptop to take over, restart the Studio runner as standby). Stop both the Studio runner and the authority by their PIDs. Send `T6`.
PASS: no reply while they are down. Within 20 s the Laptop's renewals fail, its local term ends, and it exits with `conversation ownership lost`; relaunched, it reports `inhibited: authority unreachable` and never polls or sends (design 10 §9 and §16: failover is unavailable in this direction). Restart the authority, then the Studio runner. After the authority's one-term restart hold, one machine takes the lease and, once the other is up as its peer, exactly one `T6` reply appears. The authority log's epoch continues from its previous value and is never reset.
FAIL: any reply while the authority is down, a duplicate after restore, or an epoch lower than before.

**T7. Authority restart under a live owner.** Stop the authority by PID and restart it within 10 s. Send `T7`.
PASS: the owner renews under the same epoch (the restart honours one full term for the recorded lease) and replies to `T7` once. The authority log is continuous and its chain verifies on reopen.
FAIL: a new epoch issued to the other machine during the restart hold, or any duplicate.

**T8. Restart honesty.** On every runner restart above, the restarted runner reports standby or owner from the authority and never from its own memory.
PASS: its first role line matches the authority view.

## Phase 2: Justin's own preview

This phase runs only after Phase 1 passes in full, with his explicit trial grant and synthetic non-sensitive messages. The Studio's existing preview root is the seeded machine (`--journal-lineage seed` on its first multi-machine start), so its journal becomes the shared history. The Laptop root starts empty and receives the copy. Repeat T0, T1, T2 and T3 only. T2 and T3 deliberately make the agent silent for a minute; T5 to T7 take it offline for longer, so the desk schedules those only with his agreement.

PASS and FAIL are exactly as in Phase 1. Any FAIL stops the phase, and the single-machine runner is restored as follows.

**Rollback to one machine.** Single-machine startup reads the root's own `journal.encrypted` and never adopts the copy in `replica/`. After T3 the Laptop is the owner, so the Studio's own journal is older than the shared history; restarting it alone as it stands would resume old history and old call/send accounting, after Telegram was already allowed to drop the newer input. So the Studio first takes the newest history back through the ordinary verified hand-back:

1. If the Studio runner is not the owner, make it the owner. Keep it running as the standby (start it with its usual multi-machine flags if it is down) and stop the current owner by its exact PID with `SIGTERM`. Its clean end sends the journal's last bytes and hands the lease back. PASS when the Studio's stderr says `owner: epoch N; history adopted` with `lineage.adopted` naming the previous owner.
2. Verify the Studio root holds the newest accepted state. Its status (`journal-agent.mjs status --root …`) must show the same `turns`, `replies`, `calls` and `sendOutcomes` as the previous owner's last status, and the authority view's `cursor` must equal its `sharedHistory.replication.settledCursor`.
3. Only then stop the Studio runner (`SIGTERM`, exact PID), the Laptop runner and the authority, all by PID. Relaunch the Studio runner with `--machine-posture single-machine` and without the authority or replica flags. That path is unchanged, and it now uses a `journal.encrypted` that holds the whole history.

If step 1 or step 2 cannot be established (the owner died without a clean end, the Studio's copy is damaged or behind, or any count differs), **do not start a single-machine runner on either root.** Leave both roots as they are, including every `replica/` copy and set-aside journal, keep the agent silent, and hand the state to the desk. Restarting an older root would be a quiet loss of accepted input and of spend accounting (Rules 31, 45).

## Expected and not a failure

- A transient Telegram `409 Conflict` on one poll during a handover. The previous owner's last long-poll (at most 5 s) overlaps the new owner's first. The runner's existing conflict handling retries.
- A reply whose send was claimed but whose outcome never reached the authority stays in `unresolved` and is never sent again. That is the honest unknown (design 10 §4). It is a FAIL only if the user received two replies.
- While its peer is away, the owner reads at most 100 waiting messages (one Telegram page); more wait at Telegram until the peer returns. The stop command on the machine and the stop page still work.
- A turn that was already in progress when the peer went away waits at its next model call or at the send. If that owner is also restarted before the peer returns, that one turn's call or reply is recorded as stopped or refused in its journal and is not repeated.

## Honest limits of this proof

- Failover in both directions needs three voters (design 10 §2); this proves the one-voter shape, where losing the authority machine means silence until it is back.
- With one of two machines gone, the survivor reads but does not reply. That is D1(a): the constitutional default has an availability price.
- The wait is visible on the pull surfaces (stderr, status, the run log, the host supervisor's service observation), not in the chat: a notice in the chat is itself a send, and it would need the same acknowledgement.
- Model calls obey the same demand as sends: ordinary work starts only while the other machine holds the whole journal, and each call waits until its own reservation row is acknowledged.
- The peer's acknowledgement is authenticated by the two machines' shared secret. Per-machine signing keys belong to the full transport (design 10), not to this preview.
