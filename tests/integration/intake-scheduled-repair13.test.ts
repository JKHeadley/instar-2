import { expect,it } from 'vitest';
import { verifyAndAdmit } from '../../src/facts/index.js';
import { json,refused,value } from '../intake/fixtures.js';
import { packageRecorderPersonAdmission,unregisteredScheduledCandidate } from '../intake/scheduled-repair13-fixtures.js';

it.each(['chat-a','scheduled:calendar'])('P4-ST-71 V138 package-recorded person history leaves scheduled lookup empty (%s)',channel=>{
  const x=packageRecorderPersonAdmission(channel),head=x.f.frames.at(-1) as any,before=JSON.stringify(x.f.frames);
  expect(value(x.port.pendingScheduledAdmissions({ owner:x.deps.workOwner,
    frontier:{ 'machine-a':{ epoch:head.segment.epoch,position:head.segment.position } },limit:10,after:null })))
    .toEqual({ admissions:[],next:null });
  expect(JSON.stringify(x.f.frames)).toBe(before);
});

it.each(['identity','package-system-principal'] as const)
('P4-ST-72 V142 owner and replay refuse a canonical tick through an adapter not registered for scheduling (%s)',recordType=>{
  const x=unregisteredScheduledCandidate(recordType);
  refused(verifyAndAdmit(json(x.candidate),'machine-a',{ ...x.context,facts:x.f.frames as any }));
  refused(x.append());
});
