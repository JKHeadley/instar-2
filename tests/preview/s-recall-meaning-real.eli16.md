# Checking the repair with a real model

The old tests chose the search words themselves. This replay lets the real model choose them. Each question starts with a new encrypted temporary journal made from the recorded S fixture. The script uses the normal question envelope, model route, answer reader and memory lookup. Replies stay in the replay; there is no Telegram connection.

Each round asks the hut question three times, the horse question three times, and the earlier dentist question once. Each question allows at most two model calls. The expected answers and grading rules are never sent to the model.

The first round found the key in all three runs. One horse answer admitted the search could miss things, then claimed the person had not told it the name. That failed. The instruction now also says that a failed search cannot establish that something was never said. This is a general evidence rule, not a required answer sentence. Both rounds are retained for comparison.

The fixture contains 24 scrubbed recorded turns, their search concepts and the recorded summary. Forty-four synthetic garden turns reproduce the older-versus-recent history boundary. The common test helper supplies synthetic source timestamps; dates in these replay answers are not evidence about the live conversation's dates. Its existing 409600-byte context cap is explicitly passed to the provider; the default 32768-byte cap rejected the initial setup before reaching a model. Calls, output size, stop and charge bounds are unchanged. Subscription charge remains UNKNOWN.

Run only with a permitted profile and matching activation record, after the desk's test-login guard. Supply a new output filename; an interrupted report remains visible and is never silently overwritten:

```sh
node /ABSOLUTE/LANES/testlogin-1021/check-test-login.mjs \
  --policy /ABSOLUTE/LANES/testlogin-1021/policy.json -- \
  --login-profile /ABSOLUTE/profile.json --activation-record /ABSOLUTE/activation.json \
  --output /ABSOLUTE/new-report.json
INSTAR_SLICE_TS_CACHE=/ABSOLUTE/PRIVATE-CACHE nice -n 10 node --no-warnings \
  --loader ./scripts/slice-ts-loader.mjs tests/preview/s-recall-meaning-real.mjs \
  --login-profile /ABSOLUTE/profile.json --activation-record /ABSOLUTE/activation.json \
  --output /ABSOLUTE/new-report.json --source-head REVIEWED_COMMIT
```

The committed reports retain raw model replies, chosen lookup phrases, recalled source ids, usage, input hashes and a per-question assessment. Existing stub tests stay as controls, and the final real responses are replayed through parsing, lookup and delivery. These seven cases establish the requested bounded evidence; they do not prove perfect recall or replace the desk's live group S check.
