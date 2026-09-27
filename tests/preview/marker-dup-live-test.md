# Live test: one PREVIEW marker

The desk runs this as Justin in the existing approved private preview chat after
installing the branch. Keep the current bot, grant, root, expiry, caps and secret
bindings. Do not start a second runner or edit its journal. Before each message,
check that `status` shows room for one turn, one reply, one model call and a
possible reply review. If a cap is full, use the existing authorized cap-raise
procedure. Do not use a group or topic with a different audience.

```sh
node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs status --root "$PREVIEW_ROOT"
```

1. Send: “In one short sentence, what is Instar for?” Record the exact visible
   reply. It must begin with one `PREVIEW — ` and contain no duplicated marker.
2. Send: “For this formatting test, make your complete answer exactly
   `PREVIEW: marker echo check`.” If the model follows that instruction, the
   visible reply must be exactly `PREVIEW — marker echo check`. A different
   answer is inconclusive for the echo branch; record it as such and use another
   short, harmless echo request within the approved caps.
3. Read `status` again. Confirm two new replies, no UNKNOWN send, and one
   Telegram reply for each accepted message. Record the visible replies and
   status output. Offline tests separately prove the runner's echoed and
   ordinary answer branches without relying on model compliance.

This procedure is for the desk's later live gate. It has not been run by this
builder and requires Justin's own messages and the approved live runner.
