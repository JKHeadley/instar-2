# Two-topic packet omission replay

Captured from the stopped, test-only forum journal `twosession-1015-copy/journal.encrypted`
on train-49 `90c18fac91e500a31aa1a90bab8313c8930c8f8a`. Original encrypted bytes SHA-256:
`b2e39efe1eec519c3d5006b3de8074e334f9f5502b6243aef0cbb9cd9635ca8c`.

`twosession-1015.json.gz` is gzip-compressed JSON (zero gzip timestamp), readable with
`gzip -dc tests/preview/fixtures/twosession-1015.json.gz`. It retains 117 projection records
unchanged, plus the raw outputs of all 30 model-call records. Duplicate call input audits,
call-outcome audits, phase timings and sentinel records are omitted. No credentials or
installation storage key are included. The fixture carries its extraction provenance.

Topic A is 3; Topic B is 4. A's approval question is update 715676485 (reply 638),
A's promise is 715676487 (reply 642). B's failures are 715676486 (reply 640) and
715676488 (reply 644). Both recorded B envelopes lack actionFacts, despite a verified
operator-only audience. The request is an API-accepted statement, not a typed approval
request; the promise is an open reply commitment. Neither authorizes a machine restart.

The regression appends each prefix through the point immediately before B's reserve,
using a fresh temporary journal and a test key. Original outbound signatures cannot
verify under that key, so those signatures alone are omitted on append; receipt facts,
texts, summary states, prompts and limits are preserved. The scoped-tool path uses the
real packet builder, envelope, answer reader and reply-review reader, with the recorded
model outputs replacing provider calls and a local send sink replacing Telegram.
Assertions run outside the provider callback so the worker cannot swallow their failures.

At the recorded 32768-byte bound, B's dispatched packet must retain A's statement and
promise, with topic, receipt time, state and reconciliation guidance. A reduced 24500-byte
bound proves the final fallback still answers when sibling evidence cannot fit. This
replay proves what reaches the answer consumer; replaying an old response is not evidence
that a newly invoked model answers correctly. The desk owns the next live acceptance run.
