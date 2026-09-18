// @ts-nocheck -- authoritative review assertions; adjudicated real-owner prerequisite translation.
import { vi } from 'vitest'; vi.setConfig({ testTimeout: 120000 });
import '../assembly/production-grounding-evidence.mjs';
import {it,expect} from 'vitest';
import {isProductionGroundedRunGraph,createRunGraph} from '../../src/rungraph/index.js';
import {decode} from '../../src/index.js';
import {realPairedFixture as nativeFixture} from '../assembly/real-context-delivery-fixture.js';
import {value,ref,json} from '../rungraph/astra-production-grounding-fixture.js';
it('N1 actual public Ten reader with native confined driver gives real Five graph production capability and successful signed delivery',()=>{
 const f=nativeFixture();expect(isProductionGroundedRunGraph(f.graph,'scope:minimal')).toBe(true);
 expect(isProductionGroundedRunGraph(f.graph,'other-scope')).toBe(false);
 const g=value(f.graph.ground(f.id,'w','h','start',f.lease));expect(g.kind).toBe('session-grounding');
 expect(f.events).toEqual(['clock','sample','live-process','deliver','live-process','consume']);
 expect(value(f.graph.read(f.id)).pending).toHaveLength(0);
 expect(value(f.graph.transition(f.start(f.ready,g))).pending).toHaveLength(1);
});
it('N2 actual reader accepts second distinct live input on the unchanged launch and incarnation',()=>{
 const f=nativeFixture(),g1=value(f.graph.ground(f.id,'w','h','start',f.lease));
 const first=value(f.runtime.inspectCurrent()).find((r:any)=>r.record.type==='ContextDeliverySpecification')!;
 const running=value(f.graph.transition(f.start(f.ready,g1))),observed=f.observe(running,'happened');
 const outcome=(value(f.store.read()).find(r=>r.id===observed.trigger.id)!.body as any).outcome,step=running.pending[0]!;
 const e=value(decode('Evidence',f.evidenceInput({id:'native-settled',claim:{subject:step.operation.key,predicate:'operation-settled',value:{digest:step.operation.digest,claimClosed:true,chargeSettled:true}},freshFor:10000}),f.ctx.decode));
 const ef=f.append('evidence-record',json({evidence:e})).fact;
 const graph=value(createRunGraph({...f.deps,settlement:{owner:'part-eight' as const,read:(reference:any)=>f.success({record:reference,outcome,claimClosed:true,chargeSettled:true})}}));
 const ready=value(graph.transition({...observed,to:'ready',blockedOn:{kind:'nothing'},settlement:ref(ef)}));
 const second=f.append('next-inbound',json({capture:{reference:'message:2',hash:f.ctx.captures['message:2']!.hash}})).fact;
 f.setMutation((s:any,o:any,g:any)=>{s.reason='live-input';s.previousDelivery=first.fact.id;s.input=second.id;s.inputDigest=f.ctx.captures['message:2']!.hash;s.step='step:operation:2';g.intake=ref(second);g.lastInbound=ref(second);g.step=s.step;g.contextDeliveryReason=s.reason;g.messages.push({fact:ref(second),sequence:second.segment.position,capture:'message:2',hash:f.ctx.captures['message:2']!.hash});s.contextManifest.push({class:'message',reference:'message:2',digest:f.ctx.captures['message:2']!.hash});});
 const g2=value(graph.ground(f.id,'w','h','start',f.lease));const t=f.start(ready,g2,'operation:2');
 expect(value(graph.transition({...t,trigger:ref(second)})).state).toBe('running');
 const specs=value(f.runtime.inspectCurrent()).filter((r:any)=>r.record.type==='ContextDeliverySpecification');
 expect(specs).toHaveLength(2);expect(specs[1].record.incarnation).toBe(specs[0].record.incarnation);expect(specs[1].record.launch).toBe(specs[0].record.launch);
 expect(f.events.filter(x=>x==='deliver')).toHaveLength(2);expect(f.events.filter(x=>x==='consume')).toHaveLength(2);
});
