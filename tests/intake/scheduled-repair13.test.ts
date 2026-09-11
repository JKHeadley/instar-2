import { expect,it } from 'vitest';
import { verifyAndAdmit } from '../../src/facts/index.js';
import { scheduledIntakeWorkRegistration } from '../../src/intake/scheduled-a/index.js';
import { json,refused,value } from './fixtures.js';
import { changedRecorderCandidate,mixedPersonThenScheduled,packageRecorderPersonAdmission } from './scheduled-repair13-fixtures.js';

it.each(['chat-a','scheduled:calendar'])('P4-ST-69 V137 preserves a person admission recorded by a package principal (%s)',channel=>{
  const x=packageRecorderPersonAdmission(channel),original=x.f.frames.pop() as any;
  const boundary={ site:x.f.context.site,preserved:x.f.context.preserved,register:x.f.context.decode.register };
  const registration=value(scheduledIntakeWorkRegistration(boundary,x.deps.author.principal.id,x.deps.governance.register));
  expect(value(verifyAndAdmit(json(original),'machine-a',{ ...x.f.context,ownedBodies:[registration],facts:x.f.frames as any })).id)
    .toBe(original.id);
});

it('P4-ST-69 V141 admits a valid scheduled tick after ordinary person history on the same adapter',()=>{
  const x=mixedPersonThenScheduled();
  expect(value(x.port.receiveScheduledTick(x.input)).kind).toBe('scheduled-admitted');
});

it.each(['identity','package-system-principal'] as const)
('P4-ST-70 V143 changed recorder proof cannot disable scheduled witness validation (%s)',recordType=>{
  const x=changedRecorderCandidate(recordType,true);
  refused(verifyAndAdmit(json(x.candidate),'machine-a',{ ...x.context,facts:x.f.frames as any }));
  refused(x.append());
});
