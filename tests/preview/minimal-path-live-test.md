# Limited answer past a cap: single-machine acceptance and supervised live script

Rule 15 on the live journal runner. Past an ordinary cap the runner keeps each operator message and
answers it once with a fixed limited answer from its reserve, but only while Part Eleven's verdict
admits the minimal path. On one machine that needs the operator's accepted single-machine profile
(P-08). This file says what that record is, the one step that produces it, how to prove it on a live
room, and the decisions this build made. The builder's offline tests are not evidence that a real
Telegram message arrived.

## What the runner observes

| Dependency | What the runner checks | When it is missing |
|---|---|---|
| `register` | The register generation read at launch (`generated/source.json`) is still the installed one | The checkout changed under the running process: restart the runner |
| `lease`, `fence` | This runner's exclusive conversation claim, re-verified against its owner record | Another runner holds the conversation, or the claim was lost |
| `installation-policy` | The operator's P-08 single-machine acceptance resolved at launch | No acceptance is recorded, or it covers another trial or an older profile |

The runner never observes a replication peer: it serves only the single-machine posture, and Part
Eleven leaves the peer out only under that accepted policy.

## The record and the one step

The record is one entry, `installationPolicies`, in the desk's sealed authority record
(`activation-authority.json`); its fields are in `README.md` under "Single-machine acceptance (P-08)".

1. The operator sends one message in the bound topic accepting the single-machine profile as
   presented: provider calls and reply-only Telegram and Slack sends run from one machine with no
   peer copy; if that machine is lost for good, the records needed to reconstruct a paid call or a
   send can be lost with it, and an earlier effect whose outcome is unknown cannot safely be
   repeated.
2. The desk adds the entry (the operator's exact words, the message reference and time, the trial
   and `singleMachineProfileDigest()`), seals the record with `seal-authority`, and restarts the
   runner.

Nothing else settles it: an unsealed or edited record, another trial's acceptance, an older profile
digest, words the operator did not send, or a revoked entry all leave limited answers inhibited.

## Supervised live script

1. Before the acceptance is recorded, run `status` on the root. Confirm
   `minimalReserve.installation.policy.state` is `not-accepted` with its reason, and that the chat
   `status` reply carries the line `Past a cap: limited answers are not available (missing:
   installation-policy)`.
2. On a root whose turn allowance is spent, send one message as the operator. Confirm no reply
   arrives, the message is in the journal, and `minimalReserve.outages` lists its update with
   `missing: ["installation-policy"]` and the repair text. Any other name in `missing` is a
   different fault: stop and record it.
3. Record the acceptance (the one step above) and restart the runner. Confirm exactly one message
   arrives for the kept messages of that conversation: `PREVIEW — I got your message and saved it,
   but I can't answer yet: …`. Confirm `minimalReserve.limitedAnswers` shows it `api-accepted`,
   `outages` is empty, `replies` did not increase, and `minimalReserve.repliesUsedThisHour` is 1.
4. Restart the runner once more and run `status` twice. Confirm no second limited answer.
5. Raise the allowance through the normal path. Confirm the kept messages get their ordinary
   answers once.

## Decisions made in this build

- `minimalpath-p08-in-sealed-authority-record`: the acceptance is an entry in the existing sealed
  authority record, resolved to the operator's authenticated message, the same way the trial's
  activation grant and waiver are. The live rooms have no independent approval page installed, and
  the record needs no new store, key or surface. Its standing is stated as account-authenticated
  under the desk's seal, never as device-signed.
- `minimalpath-register-by-installed-generation`: `register` follows Ten's own rule for that
  dependency (the live generation equals the current one), read from `generated/source.json`. A
  switched checkout under a running process therefore inhibits limited answers until restart.
- `minimalpath-lease-fence-from-conversation-claim`: `lease` and `fence` are the runner's exclusive
  conversation claim, which already gates every ordinary send. The verdict reads the claim without
  the retire-on-loss side effect; the send seam still consumes the fence before dispatch.
- `minimalpath-outage-names-the-policy`: on a single machine a missing peer is reported as
  `installation-policy`, because no peer can be supplied there and the acceptance is what clears it.
- `minimalpath-no-pushed-outage-notice`: while the minimal path is not admitted nothing is pushed
  about it. A chat reply is the operation that is not admitted, and the preview has no admitted
  infrastructure-notice effect. The outage is on the pull surfaces: launch stderr, the run log,
  `status`, and the chat `status` reply while turns remain.
