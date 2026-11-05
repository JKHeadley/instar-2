# Harness access probe drops queued stdout on exit

Status: repaired candidate; independent review, full gate and installed acceptance remain required.

The live runner refused a launch at 00:51 PST on November 5 with the generic text that its harness launch was not
permitted. That message alone does not establish a missing sudo rule, user or launcher: readiness used it both when
the probe command failed and when its output had missing or malformed rows. Historical stdout counts were not retained,
so this incident's precise cause is unproved. A later recorded Claude maintenance call completed at 01:21 PST; the
startup's last unavailable line did not mean every login runtime remained held.

A separate controlled reproduction proves a stdout defect in the existing launcher. With 2,500 repeated reads of an
existing harmless path, the installed launcher returned 2,500 rows to an immediate reader. Delaying its pipe reader by
500 milliseconds produced exit 0 with only 712 complete rows and empty stderr. A verbatim private copy behaved the same;
adding a flush callback before its existing exit retained all 2,500 rows under the same delayed reader. No model call,
canary, load generator or live file change participated. This demonstrates a possible source of the readiness failure
class, not a retroactive claim about the historical event.

The repair drains queued stdout through the existing stream callback before exit. Readiness keeps its complete-row
requirement and distinguishes command failures, row-count mismatch and invalid row shape in bounded diagnostics.
Diagnostics contain counts, output byte length and sanitized error code/signal only; they contain no paths, command
output or credentials. Custom probe implementations returning null without detail retain their existing refusal.

The existing readiness installer compares launcher contents and atomically replaces a differing installed file. No
separate migration, background service, authority grant, retry policy or longer deadline is needed. This behavior is
machine-local: each host installs and probes its own launcher, while existing custody, stop, resource and durable-input
boundaries remain unchanged.

Verification: `tests/preview/harness-user.test.ts` exercises the real launcher with a paused pipe reader, distinguishes
all probe failure classes, checks diagnostic redaction and retains null-refusal readiness tests. Removing the flush
must make the backpressure case fail. Test-only isolated processes use the test owner's identity; native installed
harness validation and full release evidence remain the desk's existing gates.
