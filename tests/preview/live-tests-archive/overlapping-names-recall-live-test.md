# Overlapping names: supervised live test as Justin

Use only Justin's bound private chat with the preview bot and the desk's already
authorized trial. The builder has not run this test or touched the live journal.
The names and facts below are synthetic. Keep the runner's normal activation,
stop, spend, reply and expiry controls in force.

1. With the runner paused and its writer lock released, use `journal-agent.mjs
   status --root …` to record the current turns, calls, replies, unknown outcomes
   and limits. Allow at least 20 turn slots, 40 call slots and 20 reply slots for
   this exercise, including summary and reply-review calls. If the authorized
   trial lacks headroom, have the desk raise its finite caps while paused and
   record the authority reference. Resume the same runner and root.
2. Justin sends these four messages, one at a time, waiting for each reply:
   - `Memory test: Sam Patel in accounting approved the blue budget.`
   - `Memory test: Sam Ruiz, my neighbour, lent me the red ladder.`
   - `Memory test: Jon Moss from design chose the amber cover.`
   - `Memory test: John Vale from legal chose the green contract.`
3. Justin sends a filler message consisting of `Filler for the memory test,
   just reply ok. ` followed by 50 repetitions of `The garden plan has
   tomatoes, beans, squash and herbs along the south fence. `, waiting for a
   reply each time. Repeat that message until the read-only `inspect --root … --text "What did John
   choose?" --model DESK_EXACT_MODEL_ID` reports `summary-plus-recent` and
   shows separate sourced people entries for Jon Moss and John Vale. Use at
   most eight filler turns. If the packet cannot reach that state within the
   trial's bounds, record a failure; do not edit the journal.
4. Justin asks `What did Sam do?` and `What did John choose?`, one at a time.
   Each reply should ask exactly one clarifying question naming the two
   plausible people. It must not assign either person's fact to the other.
5. Justin asks these four detailed questions, one at a time:
   - `What did Sam in accounting approve?` → blue budget, Sam Patel.
   - `What did my neighbour Sam lend me?` → red ladder, Sam Ruiz.
   - `What did Jon from design choose?` → amber cover, Jon Moss.
   - `What did John from legal choose?` → green contract, John Vale.
   A reply that mixes identities, chooses the other person's fact, or asks for
   clarification despite the detail fails the test.
6. The desk records the six question/reply pairs and the read-only packet
   evidence. `status` should show no new UNKNOWN sends or calls and no holds;
   replies should rise by the number of Justin's accepted messages. Preserve
   any unexpected result as evidence and do not resend an uncertain turn.

The offline benchmark measures packet visibility and a deterministic answer
stub. This live test is the required check of actual model behavior. Neither
test changes provider policy or the subscription output-token cap.
