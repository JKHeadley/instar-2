# Justin live test: supervised rolling summaries

Run only after the desk installs this build on the approved private preview journal. Justin sends the messages in the bound private chat. Keep the existing bot, grant, expiry, call limits, and journal root. The desk binds the existing TypeSafe secret to `INSTAR_SECRET_PREVIEW_TYPESAFE_KEY`; do not print it. This script does not authorize a new launch or cap raise.

Set `PREVIEW_ROOT` to that approved root, then use this read-only status command after each step:

```sh
node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs status --root "$PREVIEW_ROOT"
```

1. Record starting `calls`, `summaryThrough`, `summaryChecks`, and `summaryPending`. Check that the existing caps leave room for replies and summaries. As Justin, send: “On September 26, I promised Maya I would bring the blue notebook on Tuesday. Remember that commitment.” Wait for its one PREVIEW reply.
2. Send ordinary follow-up turns until a rolling summary covers that update. Wait for `summaryPending: 0` before reading status. A successful Jev check advances `summaryThrough`, increments `summaryChecks.pass`, and leaves `lastSummaryCheck` with `path: "jev"` and a latency. A Jev signal followed by a subscription pass instead increments both the signal verdict and `pass`, with `lastSummaryCheck.path: "subscription"`. Record the actual path; do not presume which one the models choose.
3. Ask: “What did I promise Maya, and on which day?” The answer must retain Maya, the blue notebook, and Tuesday. Use the read-only `inspect --root "$PREVIEW_ROOT" --text "What did I promise Maya, and on which day?" --model MODEL` probe to confirm the next packet's `historyMode` and `summaryThrough`. Only claim summarized recall if it says `summary-plus-recent`.
4. For a negative branch, use a separate desk-approved isolated preview fixture with stubbed Jev and subscription results, as in `summary-check.test.ts`: a Jev violation or unsure plus full-context violation must leave `summaryThrough` unchanged; Jev unavailable must leave it unchanged and show a failed retry attempt; an uncertain subscription result must leave `summaryPending` visible. Do not try to induce false memory in Justin's live journal.
5. Record the before and after status JSON, the actual reply, and the inspect result as gate evidence. Confirm accepted turn count still includes every message, calls never exceed the cap, and no duplicate Telegram replies arrived. Status evidence is content-free; keep raw journal and credentials private.

Offline tests prove the verdict branches and replay. This live procedure proves the TypeSafe binding, latency, actual subscription route when naturally invoked, journal integration, and Justin's memory recall on the approved surface.
