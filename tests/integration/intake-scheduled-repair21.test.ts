import { expect,it } from 'vitest';
import { refused,value } from '../intake/fixtures.js';
import { scheduledFixture } from '../intake/scheduled-fixtures.js';
import { addSecondGrant } from '../intake/scheduled-repair14-fixtures.js';

it.each(['absent','copies'])
('P4-ST-107 F1 V221 a changed retry without an admission validates the current grant before mismatch (%s)',fault=>{
  const f=scheduledFixture(); f.installSchemas();
  const grant=fault==='absent'?undefined:f.grant();
  const tick=f.tick(),discovery=f.discovery(tick.eventId);
  const input={ raw:tick.raw,route:tick.route,
    discovery:{ owner:'part-two' as const,name:'FactEnvelope' as const,id:discovery.fact.id } };
  if(fault==='copies') addSecondGrant({ f,grant:grant!,tick,discovery,input });

  refused(f.port().receiveScheduledTick({ ...input,directive:[] } as any),'unsupported-in-slice-a');
  expect(f.facts().filter(fact=>fact.kind==='intake-admitted')).toEqual([]);
  const before=f.facts().length,result=f.port().receiveScheduledTick({
    ...input,raw:f.tick({ calendarPolicyVersion:'cron-v2' }).raw,
  });
  refused(result,'unsupported-in-slice-a');
  expect(f.facts().slice(before).map(fact=>fact.kind)).toEqual(['intake-receipt']);
  expect(f.facts().slice(before+1)).toEqual([]);
  expect(f.facts().filter(fact=>fact.kind==='intake-mismatch')).toEqual([]);
  expect(value(f.port().pendingScheduledAdmissions({
    owner:f.deps.workOwner,frontier:f.frontier(),limit:10,after:null,
  })).admissions).toEqual([]);
});
