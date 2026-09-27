# Supervised suite: live test as Justin

Use the existing approved private preview runner and its current canonical root.
The runner must already be running with its reviewed bot, grant, audience, expiry,
secret bindings and finite caps. Do not start another runner or edit its journal.
Set `INSTAR_SECRET_PREVIEW_STORAGE_KEY` through the existing vault host binding;
do not paste the key into the command line or output. Then, from the repository
root, run this coordinator in the foreground:

```sh
node --loader ./scripts/slice-ts-loader.mjs tests/preview/live-test-suite.mjs /ABSOLUTE/EXISTING_ROOT
```

The coordinator displays, in order, the existing Jev, marker, recall, channel
memory, dated memory and away digest live procedures. Justin sends their stated
messages in the bound private Telegram chat. The desk performs their stated
read-only checks and any required supervised preparation. After each procedure,
enter `PASS` only when its actual Telegram replies, `status` and `inspect`
evidence meet that procedure's pass conditions; otherwise enter `FAIL: reason`.
The coordinator reads the encrypted journal once a second while a procedure is
open. Its table counts newly answered turns with Telegram API acceptance, shows
whether a hold appeared, and prints the first hold reason. A hold stops the
sequence immediately. A pending or UNKNOWN send cannot pass. Exit code is zero
only when every listed procedure passes. No prompt, Telegram send, cap raise,
model call, import or journal write is issued by the coordinator itself.

The definite-failure and lost-answer substitute procedure in
`journal-model-failure-live-test.md` explicitly requires separate empty roots
and a test loader. Run it separately under that procedure; never attach that
loader to this existing-root suite. A due-day dated check and the three-hour
away check can require a trial whose approved expiry covers them. If the
current trial cannot cover them, record FAIL rather than changing dates or caps
without the existing authorization path.
