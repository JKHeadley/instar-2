import { expect, it } from 'vitest';
import {intakeFixture,value,message,route} from '../intake/fixtures.js';
it('V48 receive remains available after additive verified act',()=>{const f=intakeFixture(),v=f.verifiedAct();const p=f.port();value(p.admitVerifiedAct(v.input));expect(value(p.receive(message('ordinary after verified'),route)).kind).toBe('admitted');expect(value(p.expireHolds())).toBe(0);});
it('V49 receive remains available before additive verified act',()=>{const f=intakeFixture();f.verifiedAct();expect(value(f.port().receive(message(),route)).kind).toBe('admitted');});

import {intakeVerifiedActRegistration} from '../../src/intake/index.js';
it('V50 installing the owner decoder in ordinary context restores clean receive',()=>{const f=intakeFixture(),v=f.verifiedAct();const p=f.port();value(p.admitVerifiedAct(v.input));const reg=value(intakeVerifiedActRegistration(f.f.c,f.deps.author.principal.id,f.generation));Object.assign(f.context,{ownedBodies:[...f.context.ownedBodies??[],reg]});expect(value(p.receive(message('ordinary after verified'),route)).kind).toBe('admitted');expect(value(p.expireHolds())).toBe(0);});
it('V51 fresh intake port still accepts clean messages after an approved act',()=>{const f=intakeFixture(),v=f.verifiedAct();value(f.port().admitVerifiedAct(v.input));expect(value(f.port().receive(message('fresh ordinary'),route)).kind).toBe('admitted');});
it('V52 recover remains idempotent after additive verified act',()=>{const f=intakeFixture(),v=f.verifiedAct(),p=f.port();value(p.receive(message('ordinary before act'),route));const receipt=f.facts().find(x=>x.kind==='intake-receipt')!;value(p.admitVerifiedAct(v.input));expect(value(p.recover(receipt.id)).kind).toBe('duplicate');});
it('V53 expireHolds remains available after additive verified act',()=>{const f=intakeFixture(),v=f.verifiedAct(),p=f.port();value(p.admitVerifiedAct(v.input));expect(value(p.expireHolds())).toBe(0);});
