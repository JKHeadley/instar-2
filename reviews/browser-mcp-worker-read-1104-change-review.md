# Change review — worker reads connector launch configuration

Subject base: bcbe1def1642146c18f1e0d569ab84016fa6454e
Review state: open
Reviewed content: none
Deferral: src/commitments/CheckInReminderReconciler.ts:126 | not-a-deferral=a log line naming rows the bounded pass leaves for the next pass, which the durable due list picks up
Deferral: src/commitments/CommitmentTracker.ts:63 | not-a-deferral=the CMT-xxx id format in a comment
Deferral: src/commitments/CommitmentTracker.ts:193 | not-a-deferral=a comment describing a counted follow-up field
Deferral: src/commitments/CommitmentTracker.ts:542 | not-a-deferral=a comment describing the carried auto-expiry deferred window
Deferral: src/commitments/CommitmentTracker.ts:2160 | not-a-deferral=the persistence state name 'deferred'
Deferral: src/commitments/CommitmentTracker.ts:2161 | not-a-deferral=the persistence state name 'deferred'
Deferral: src/commitments/CommitmentTracker.ts:2259 | not-a-deferral=a carried comment about a 1.x sweep; that sweep is not carried
Deferral: src/commitments/CommitmentTracker.ts:2403 | not-a-deferral=the persistence state name 'deferred'
Deferral: src/commitments/CommitmentTracker.ts:2410 | not-a-deferral=the persistence state name 'deferred'
Deferral: src/commitments/LlmQueue.ts:198 | not-a-deferral=a comment on the dispatch gap of the queue
Deferral: src/commitments/PromiseBeacon.ts:735 | not-a-deferral=a comment on the election verdict
Deferral: src/commitments/PromiseBeacon.ts:926 | not-a-deferral=fixed status text when a line could not be fetched
Deferral: src/commitments/PromiseBeacon.ts:1118 | not-a-deferral=fixed close-out text quoting the promise
Deferral: tests/commitments/1x/CommitmentTracker-auto-expiry.test.ts:107 | not-a-deferral=fixture text
Deferral: tests/commitments/1x/CommitmentTracker-auto-expiry.test.ts:244 | not-a-deferral=fixture text
Deferral: tests/commitments/1x/CommitmentTracker.test.ts:73 | not-a-deferral=a test title naming the id format
Deferral: tests/commitments/1x/check-in-reminder-reconciler.test.ts:271 | not-a-deferral=a test title for the bounded pass
Deferral: tests/commitments/1x/check-in-reminder-reconciler.test.ts:282 | not-a-deferral=a test title for the bounded pass
Prompt finding: 4106b49fff07 | protocol-literal | existing journal.ts text this change did not edit; the diff of that file from the subject base has no line containing it
Prompt finding: 85544c20941f | protocol-literal | existing journal.ts text this change did not edit; the diff of that file from the subject base has no line containing it
Prompt finding: e8708c7fea24 | protocol-literal | existing journal.ts text this change did not edit; the diff of that file from the subject base has no line containing it
Prompt finding: 849db3a6296a | protocol-literal | existing journal.ts text this change did not edit; the diff of that file from the subject base has no line containing it
Deferral: generated/register.json:1 | not-a-deferral=generated source hash was regenerated from the merged commit; the original branch's separate missing Part Two authority is unchanged and remains open.
