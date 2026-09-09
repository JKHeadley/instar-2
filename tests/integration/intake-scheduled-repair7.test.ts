import { it } from 'vitest';
import { verifyAndAdmit } from '../../src/facts/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { json,refused,value } from '../intake/fixtures.js';
import { scheduledOwnerContext,scheduledRepair6Setup } from '../intake/scheduled-repair6-fixtures.js';
import { messageOnlyScheduledAttempt,unwitnessedScheduledAdmission } from '../intake/scheduled-repair7-fixtures.js';

it.each(['version','text','missing-version','valid-shape'] as const)
('P4-ST-36 V84 signed replication refuses scheduled data without principal/discovery witnesses (%s)',variant => {
  const x=unwitnessedScheduledAdmission(variant),previous=x.f.frames.at(-1) as FactEnvelope;
  const signed=x.f.f.next(previous,{ kind: x.candidate.kind,body: x.candidate.body,principal: x.f.principal,
    provenance: x.f.provenance,at: x.f.f.now,predecessors: { inSegment: previous.id,frontier: {},required: x.candidate.required } },
  x.context);
  refused(verifyAndAdmit(json(signed),'machine-a',{ ...x.context,facts: x.f.frames as FactEnvelope[] }));
});

it('P4-ST-37 V90 signed replication refuses scheduled work through a registered message-only adapter',() => {
  const x=messageOnlyScheduledAttempt(),previous=x.f.frames.at(-1) as FactEnvelope;
  const signed=x.f.f.next(previous,{ kind: 'intake-admitted',body: x.body,principal: x.principal,provenance: x.provenance,
    at: x.f.f.now,predecessors: { inSegment: previous.id,frontier: {},required: x.required } },x.context);
  refused(verifyAndAdmit(json(signed),'machine-a',{ ...x.context,facts: x.f.frames as FactEnvelope[] }),
    'not registered for verified scheduled ticks');
});

it.each(['channel','identityEpoch'] as const)
('P4-ST-38 signed replication refuses admission %s inconsistent with receipt and resolution',field => {
  const x=scheduledRepair6Setup(),admitted=value(x.f.port().receiveScheduledTick(x.input));
  if(admitted.kind!=='scheduled-admitted') throw new Error('expected scheduled admission');
  const frames=x.f.frames as FactEnvelope[],original=frames.pop()!,previous=frames.at(-1)!,body=structuredClone(original.body) as any;
  body[field]=field==='channel'?'scheduled:replica-mismatch':'sha256:'+'c'.repeat(64);
  const context=scheduledOwnerContext(x.f);
  const signed=x.f.f.next(previous,{ kind: 'intake-admitted',body,principal: x.f.principal,provenance: x.f.provenance,
    at: x.f.f.now,predecessors: { inSegment: previous.id,frontier: {},required: original.predecessors.required } },context);
  refused(verifyAndAdmit(json(signed),'machine-a',{ ...context,facts: frames }));
});
