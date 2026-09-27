# Real model recall sample: Justin live test

Run only with the desk's active preview subscription login profile and matching
activation record. This command creates and deletes its own temporary encrypted
synthetic journal. It never opens the live runner root or sends Telegram messages.
The output path must be a new absolute path outside the live runner root.

```sh
node --no-warnings --loader ./scripts/slice-ts-loader.mjs \
  tests/preview/real-model-recall-sample.mjs --live \
  --login-profile /ABSOLUTE/PREVIEW/profile.json \
  --activation-record /ABSOLUTE/PREVIEW/activation.json \
  --model claude-sonnet-5 \
  --output /Users/dabombstudio/.instar/agents/echo/.instar/lanes/real-model-recall-sample-report.json
```

The fixture has exactly 120 turns: 30 original facts, eight later corrections,
five later forget requests, and 77 routine turns. Its final summary contains
only current retained facts. Twenty fixed questions use the replayed journal's
real packet builder and the existing subscription route. Each question gets one
durable model reservation and at most one provider invocation; there are no
automatic retries. A rejected or uncertain call counts as a miss. The report
records the score, all answers, every packet and available token usage. Each
miss also has the packet hash, size, summary frontier, relevant excerpts, and
whether the expected or stale value was visible. Keep the generated JSON for
desk review.

Each answer must be exactly the current synthetic label, or `UNKNOWN` for a
forgotten label. The journal's structured `{reply,memory}` response is scored
from its extracted reply. The report also keeps the raw provider output so a
malformed or ambiguous answer can be inspected; either counts as a miss.

Without both `--live` and `--login-profile`, the command prints `SKIP` and
opens no provider. If activation or the profile fails the existing validation,
it refuses before the first question. The current subscription policy is used
unchanged, including its output cap; output-cap rejections count as misses.
The command reserves the report path before the first provider call. An
interrupted run leaves a `started` artifact; treat it as incomplete and inspect
it instead of rerunning the same sample. SIGINT, SIGTERM, SIGHUP, or activation
revocation stop further questions and cancel the local provider child.
