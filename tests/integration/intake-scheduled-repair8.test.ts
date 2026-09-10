import { expect,it } from 'vitest';
import { signEnvelope,verifyAndAdmit } from '../../src/facts/index.js';
import { scheduledOwnerContext } from '../intake/scheduled-repair6-fixtures.js';
import { scheduledFixture } from '../intake/scheduled-fixtures.js';
import { json,refused,value } from '../intake/fixtures.js';

const ref=(id: string) => ({ owner: 'part-two' as const,name: 'FactEnvelope' as const,id });

it.each(['machine-a','scheduled-clock'])
('P4-ST-41 V97 signed replication checks source-machine-free canonical tick (%s)',source => {
  const f=scheduledFixture(); f.grant();
  const stable=f.tick(),discovery=f.discovery(stable.eventId);
  value(f.port().receiveScheduledTick({ raw: stable.raw,route: stable.route,discovery: ref(discovery.fact.id) }));
  const original=f.frames.pop() as any,context=scheduledOwnerContext(f);
  const tick=f.tick({ scheduledInstant: f.clock(1000,source) });
  const body=structuredClone(original.body) as any;
  body.intent.ask=tick.body;
  const signed=source==='scheduled-clock'? original:signEnvelope({ ...original,body },f.deps.author.privateKey);
  const result=verifyAndAdmit(json(signed),'machine-a',{ ...context,facts: f.frames as any });
  if(source==='scheduled-clock') expect(value(result).id).toBe(original.id);
  else refused(result);
});
