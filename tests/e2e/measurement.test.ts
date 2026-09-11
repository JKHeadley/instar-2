import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('P16-NF-01 P16-NF-02 P16-NF-03 P16-NF-05 P16-NF-22 P16-NF-23 P16-NF-24 P16-NF-25 P16-NF-26 P16-NF-27 P16-NF-28 P16-NF-29 P16-NF-30 P16-NF-52 P16-NF-53 fresh process exposes only the structural A1 surface and replays F8 F9 F10 F11', () => {
  const script = String.raw`
    import { consumeResult } from './dist/index.js';
    import * as m from './dist/measurement/index.js';
    const take = r => consumeResult(r, { Success: v => v, Refused: x => { throw new Error(x.detail); } });
    const kind = r => consumeResult(r, { Success: () => 'Success', Refused: () => 'Refused' });
    const model = { type:'MeasurementProducerContract',schemaVersion:2,id:'producer:model',family:'model-call',
      subjectKind:'model-token',producer:'probe',categories:[{name:'input',unit:'tokens',relation:'standalone'}],
      evidencePredicate:'usage-observed',sourceSampleRequired:true,hardwareProfileRequired:false };
    const event = { ...model,id:'producer:event',family:'programmatic-event',subjectKind:'programmatic-count',
      evidencePredicate:'event-observed' };
    const register = { generation:{owner:'part-three',name:'RegisterGeneration',id:'generation:1'},
      entries:['site','probe','producer:model','producer:event','usage-observed','event-observed'],producers:['probe'],methods:[],
      actions:{},subjects:{clock:['unix-ms'],'model-token':['tokens'],'programmatic-count':['tokens']},sites:{site:'closed'},keys:{},
      allowRedelegation:false,conflictStanding:{ordinary:'delegate',authority:'operator'} };
    const types = { register,preserved:'capture:none',captures:{},evidence:[] };
    const context = { site:'site',preserved:'capture:none',register,types,
      registeredContracts:{'producer:model':model,'producer:event':event} };
    const modelContract = take(m.decodeMeasurementProducerContract(model,context));
    const eventContract = take(m.decodeMeasurementProducerContract(event,context));
    const descriptor = {processIncarnation:'p:1',pid:7,startEvidence:'s:1',tags:['worker']};
    const out = {
      exports:Object.keys(m).sort(),
      event:take(m.admitMeasurementAmount({contract:eventContract,category:'input',amount:1},context)),
      fraction:kind(m.admitMeasurementAmount({contract:modelContract,category:'input',amount:0.5},context)),
      unsafe:kind(m.admitMeasurementAmount({contract:modelContract,category:'input',amount:Number.MAX_VALUE},context)),
      category:kind(m.decodeMeasurementProducerContract({...model,categories:[{name:'fictional-token',unit:'tokens',relation:'standalone'}]},context)),
      absent:take(m.reconcileProcessIncarnation(descriptor,null,context)),
      malformedProcess:kind(m.reconcileProcessIncarnation(descriptor,false,context)),
      malformedEpisodes:kind(m.coalesceUnknownQuotaEpisodes(['account'],[null,42],context)),
      port:Object.keys(m.createMeasurementLedger(context)).sort(),
    };
    process.stdout.write(JSON.stringify(out));
  `;
  const result = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: process.cwd(), encoding: 'utf8',
  })) as Record<string, unknown>;
  expect(result).toMatchObject({ event: { family: 'programmatic-event', amount: 1 }, fraction: 'Refused',
    unsafe: 'Refused', category: 'Refused', absent: 'missing', malformedProcess: 'Refused',
    malformedEpisodes: 'Refused', port: ['admitAmount', 'owner', 'trend'] });
  const exports = result.exports as string[];
  for (const removed of ['resolveQuantity', 'aggregateMeasurements', 'evaluateBurn', 'renderBoundedRead',
    'mergePeerMeasurements', 'renderCurrentMeasurementRead', 'createBoundedReadCache'])
    expect(exports).not.toContain(removed);
});

it('package subpath keeps the public Part Sixteen export', () => {
  const pkg = JSON.parse(execFileSync(process.execPath, ['-e',
    "process.stdout.write(require('fs').readFileSync('package.json','utf8'))"], { encoding: 'utf8' })) as {
      exports: Record<string, unknown>;
    };
  expect(pkg.exports['./measurement']).toEqual({ types: './dist/measurement/index.d.ts',
    default: './dist/measurement/index.js' });
});
