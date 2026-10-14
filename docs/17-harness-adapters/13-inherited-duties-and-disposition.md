## 13. Inherited duties and implementation units

**Rule — missing behavior has an owner and exit test.** Rules 8/30/34/49/68/71/84/115;
checks P13-NF-01/03/07/19/26/40/43–48. These are build commitments for this design, tracked in
its joint-review delivery. They specify work and dependencies, not delivered capabilities.
The common contract is implemented once; worker packages can then be built independently.

| Unit | Scope and exit condition | Plan steps and concurrency |
|---|---|---|
| Public conversation contract (Ten/Thirteen) | Version the existing port/context/observations; implement public control, reply/terminal events and durable cursor. Two different inputs run on one worker; busy, duplicate, stale incarnation, gap and stop neighbors pass. | Serves 2–7. First shared seam; independent of memory-store migration and commitments storage. |
| Conversation queue and reply bridge (conversation/Four/Eight) | Use owner intake queue and outbound identities; consume the public adapter. Crash while busy retains the next message; lost reply receipt does not resend; empty output stays unsent. | Step 2, alongside 3/5/6 after the port shape. Keep the journal as custody until step 5's verified cutover. |
| Claude worker (Thirteen) | Extract the working session driver behind the contract, including exact lifecycle/result evidence, scoped tools and metering. Full real walk passes; no vendor branch remains in its consumers. | Supports 2/4/6/7; independently of Codex/native packages after the shared seam. Reuse the step-1 conversation build. |
| Codex worker (Thirteen) | Map thread input, reply/terminal events, restore and control to the same contract, testing actual captured shapes and the same walk. | Supports 2/4/6/7; parallel with Claude/native, no extra conversation implementation. |
| Native worker (Thirteen) | Ship loop and tool-worker bindings, add continuing input and normalized events, run every compatible model route and real self-hosting. | Supports 2/4/6/7; parallel with the two vendor packages. |
| Account/tool binding (Eight/Nine/Ten) | Generate actual scoped catalogue and custody handles; prove allowed read plus revoked/outside-role refusal, physical bypass denial, stop and accounting. | Step 4 with 7's real keys. Read/reversible-path design proceeds beside other units; one-machine irreversible writes await the operator question in section 14. |
| Grounding/record integration (Five/awareness/Two) | Current manifest at first input, resume and compaction; complete covered history and last-inbound accounting; missing-range neighbors fail honestly. | Steps 5/6; parallel with step 3 commitments. Commitments enter briefing/work references through their own store, not this adapter. |

The joint review reconciles Five's continuing-run/step model and Eight's action contract before
those schemas land. A provider/worker replacement consumes the same remaining budget and durable
work references. Step 7 supplies real custody; adapters consume it without administering it.
Implementation delivery must update package docs, generated briefing, consumer graph and migration
for installed configurations together. No implementation status can be inferred from this table.
