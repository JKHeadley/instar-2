# Justin live test: memory from another agent channel

Use the existing private preview trial after the desk has landed this build and
resumed its sole runner with `--agent-state-dir` set to this agent's canonical
`.instar` directory. Do not use the preview chat as the source.

1. In an **existing Telegram topic where Echo participates**, send a unique
   message as yourself: `For the channel-memory test, the studio marker is
   JADE-52. Maya did not send this; I did.` Record the topic ID and Telegram
   message ID. Do not put a secret in the marker.
2. Read `status --root ROOT` before and after the next poll cycles. Confirm
   `channelSources.telegram.offset`, `scanned` and
   `imported` rise, `error` is null, and `channelItems` rises once. If the
   source was already at its 2,000-item cap, record the refusal rather than
   claiming a pass.
3. Run `inspect --root ROOT --text "What studio marker did I send in the other
   Telegram topic, and who sent it?" --model MODEL`. Its `next.channelMemory`
   must contain the exact marker, `origin: "stored-log"`, the source message
   ID, source date and `from: "telegram:JUSTIN_USER_ID"`. The sender must come
   from the stored Telegram user ID, not the body mentioning Maya.
4. Ask that question in the private preview chat. The reply should give
   `JADE-52`, identify the other topic and attribute the message to your
   Telegram sender ID. Save the actual reply and the later `status` and
   `inspect` output. A selected packet without a correct delivered reply is
   incomplete live evidence.
5. After a normal pause and restart of the same trial, check `status` again.
   The imported count and `channelItems` must remain stable when the same
   source line is reread; the preview must not send a duplicate reply.

For Slack, run the same test in a channel present in this agent's
`slack-channel-registry.json` once its agent-owned `slack-messages.jsonl` exists.
The expected `from` is the stored `slack:USER_ID`. A Slack log or binding that
does not exist is reported as unavailable evidence, not a passing live test.
