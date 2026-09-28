# Terse answer to a clarifying question: supervised private-chat script for Justin

Run this only after the desk lands this revision onto `runner-integrate11`
at `3695117d` (live runner-frozen15, int11 r3 VERDICT YES) or a descendant that
carries int11's activation. Only then resume the existing reply-only preview
under that activation. Relative to `3695117d` the change is in the packet
builder, not the provider policy: `git diff 3695117d -- src/` is empty, so
int11's policy digest and fixed expiry still apply. This does not hold on
the older `56fe0b7c` base. `56fe0b7c..3695117d` changes the conversation
policy and expiry, so an activation issued for that base is refused and must
not be reused. Use the bound private operator chat. Do not start a second runner or
use the frozen live root from this builder worktree. Record the actual
messages, `status`, and `inspect` output; the offline harness is not a live
proof.

1. Check `status` for stop, expiry, UNKNOWN effects and enough capacity for
   about fifteen messages plus summary calls. If needed, use the desk's recorded
   `raise-caps` authority first. Send: `Sarah, my dentist, moved her office to
   Elm Street.` Wait for the reply. Send: `My sister Sarah just moved to
   Portland.` Wait for the reply.
2. Send harmless filler messages, waiting for each reply and for
   `summaryPending: 0`, until `inspect --text "Where did Sarah move?" --model
   MODEL` shows `historyMode: summary-plus-recent`. Stop and record an
   incomplete result if a cap or hold appears. Ask: `Where did Sarah move?` The
   reply should ask one short question distinguishing the dentist from your
   sister.
3. Send one unrelated message: `Can you remind me what a good stretch after
   running is?` Wait for its reply. Then answer the earlier question tersely:
   `second`. Before sending, `inspect --text "second" --model MODEL` should show
   the Sarah question turn in `history` or `recalled`. The reply should say your
   sister moved to Portland. It should not ask what "second" means and should
   not treat it as a new fact.
4. Control: send `Can you draft the invite?` If the reply asks a two-way
   question (for example formal or casual), answer `second`. The reply should
   apply `second` to that newest question, not to Sarah.
5. Control: after that exchange, send `the dentist one` with no open question.
   The reply may ask what you mean or mention the dentist; it should not claim
   that you just answered a pending question.
6. Inspect the persisted prompts and send intents for steps 3 to 5. Each
   message should have one send intent and at most one accepted send, with no
   unsolicited message between them. Record, for each terse reply, whether the
   model bound it to the right question, the wrong one, dropped it, or stored it
   as a free-standing fact. A wrong binding is a failed live proof.

The statements above are temporary test facts in the trial journal. If this
root is kept, Justin can ask to forget them through the existing memory
workflow.
