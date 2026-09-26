// @ts-nocheck -- bounded offline integration with the real provider and Telegram adapters.
import { expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { createProductionTelegramIO } from '../../scripts/production-boot-io.mjs';
import { createClaudeCodeSubscriptionRoute, SUBSCRIPTION_CONVERSATION_FRAMING,
  subscriptionConversationPolicy } from '../../src/assembly/production-provider.js';
import { openPreviewJournal, createJournalWorker } from './journal.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { SOURCE_PINS, deskStatusSource, readDeskStatus, sourcePacket } from './briefing.js';
import { offlineProfile, OFFLINE_STORAGE_KEY, successiveWorld } from './successive-fixture.js';

it('measures 60 assembled journal turns with real adapters, polling, prompt construction and timed restarts', async () => {
  const fixture = successiveWorld(), root = join(fixture.directory,'assembled-journal');
  mkdirSync(root);
  const updates = Array.from({length:60},(_,i)=>({update_id:i+1,message:{
    chat:{id:Number(fixture.configuration.chatId),type:'private'},from:{id:Number(fixture.configuration.operatorSenderId)},
    text:i===0?'ORCHID is the first unique memory':i===59?'What was the first unique memory?':`ordinary turn ${i}`}}));
  const updatePath = join(fixture.directory,'updates.json'), log = join(fixture.directory,'assembled-endpoint.log');
  writeFileSync(updatePath,JSON.stringify(updates));
  const endpoint = spawn(process.execPath,[join(process.cwd(),'tests/preview/journal-poll-endpoint.mjs'),log,updatePath],
    {stdio:['ignore','pipe','pipe']});
  let journal;
  try {
    const port = await new Promise((done,fail)=>{
      endpoint.stdout.once('data',data=>done(Number(String(data).trim()))); endpoint.once('error',fail);
    });
    const token = '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', policy = subscriptionConversationPolicy(fixture.model);
    const activation = fixture.activation(), now = 1790000002000;
    const context = {site:'preview.journal',preserved:'preview:test',register:{
      generation:{owner:'part-three',name:'RegisterGeneration',id:'preview:register'},
      entries:['preview.journal','preview','host'],producers:['host'],methods:[],actions:{},subjects:{},
      sites:{'preview.journal':'closed','types.decode':'closed'},keys:{},allowRedelegation:false,
      conflictStanding:{ordinary:'delegate',authority:'operator'}},captures:{}};
    const contract = {reference:activation.reference,version:activation.profileDigest,
      parserReference:'claude-code-json-result',parserVersion:'1',endpoint:offlineProfile.loginProfileIdentity,
      account:offlineProfile.expectedAccount,credentialReference:offlineProfile.reference,controller:'preview-journal',
      sourceEvidence:[activation.reference],terminalEvidence:activation.reference,terminalReasonField:'subtype',
      successfulFinalReplyReasons:['success'],strength:'attestation',maxMetadataBytes:policy.maxMetadataBytes,
      maxRawTerminalBytes:policy.maxRawTerminalBytes,maxCaptureBytes:policy.maxCaptureBytes};
    let substitutes = 0, substituteMs = 0, recalled = false, deskSeen = 0;
    const io = {realpath:path=>path,executableBytes:()=>Buffer.from('offline executable bytes'),
      inspectSubscriptionProfile:profile=>({loginProfileIdentity:profile.loginProfileIdentity,
        managedConfigurationDigest:profile.managedConfigurationDigest}),
      execute:async command=>{
        const start=performance.now(); let stdout;
        if(command.args[0]==='--version') stdout='2.1.280 (Claude Code)';
        else if(command.args[0]==='auth') stdout=JSON.stringify({loggedIn:true,authMethod:'claude.ai',
          apiProvider:'firstParty',analyticsDisabled:true,projectsDirectory:`${offlineProfile.configDirectory}/projects`,
          configDirectory:offlineProfile.configDirectory,email:offlineProfile.expectedAccount,
          orgId:offlineProfile.organization,orgName:'Offline',subscriptionType:'max'});
        else {
          substitutes++;
          if(command.stdin.includes('Lane preview-awareness: building.')) deskSeen++;
          if(command.stdin.includes('What was the first unique memory?')) recalled=command.stdin.includes('ORCHID');
          const binding=JSON.parse(JSON.parse(command.stdin).messages[1].content).bindings;
          const decision={type:'Decision',schemaVersion:1,id:`offline-${substitutes}`,at:binding.at,by:binding.by,
            conclusion:{subject:'preview-stage2-answer',predicate:'answer-text',value:'ORCHID',evidence:binding.evidence},
            reason:{subject:'question',predicate:'answered',value:true,evidence:binding.evidence},
            floor:{allowed:binding.floor,chosen:binding.floor.default}};
          stdout=JSON.stringify({type:'result',subtype:'success',is_error:false,result:JSON.stringify(decision),
            session_id:`assembled-${substitutes}`,usage:{input_tokens:1,output_tokens:1}});
        }
        substituteMs+=performance.now()-start;
        return {code:0,limited:false,stdout,stdoutBytes:new Uint8Array(Buffer.from(stdout))};
      }};
    const route = createClaudeCodeSubscriptionRoute({context,credential:{type:'SecretRef',schemaVersion:1,
      vault:'preview',name:offlineProfile.reference},profile:offlineProfile,resolveProfile:()=>offlineProfile,
      provider:'anthropic',model:fixture.model,route:'preview-subscription',disclosure:'Subscription preview; charge UNKNOWN',
      activation,framing:SUBSCRIPTION_CONVERSATION_FRAMING,io,now:()=>now,active:()=>true,adapterEvidenceContract:contract});
    expect(route.kind).toBe('Success');
    if(route.kind!=='Success') return;
    const captures=new Map();
    const physical=createProductionTelegramIO(root,{preserve(ref,bytes){captures.set(ref,bytes);return true;},
      read:ref=>captures.get(ref)??null},`http://127.0.0.1:${port}`);
    const identity=physical.invoke({token:{type:'SecretRef',schemaVersion:1,vault:'preview',name:'telegram-bot-token'},
      method:'getMe',body:{},timeoutMs:30000,identityBinding:{id:Number(fixture.configuration.botId),
        username:fixture.configuration.botUsername.slice(1)}},token);
    expect(identity,JSON.stringify(identity)).toMatchObject({kind:'identity'});
    const g={kind:'genesis',bot:fixture.configuration.botId,chat:fixture.configuration.chatId,
      operator:fixture.configuration.operatorSenderId,grant:fixture.state().read().trial.id,
      configurationDigest:fixture.state().read().trial.configurationDigest,expires:activation.expiresAt,
      maxCalls:80,maxReplies:60,maxTurns:60,maxBytes:32768,cursor:0};
    const sources=sourcePacket(path=>readFileSync(join(process.cwd(),path),'utf8'),SOURCE_PINS,
      {providerAttempts:g.maxCalls,expiresAt:g.expires}).sources;
    const deskStatus=join(root,'desk-status.md');
    writeFileSync(deskStatus,'# Instar 2.0 desk report\nLane preview-awareness: building.\n');
    const create=()=>{
      journal=openPreviewJournal(join(root,'journal.encrypted'),OFFLINE_STORAGE_KEY,g);
      return createJournalWorker(journal,{now:()=>now,stopped:()=>false,
        sources:()=>[...sources,deskStatusSource(readDeskStatus(deskStatus),now,deskStatus)],
        prepareModel:input=>prepareJournalEnvelope(input,fixture.model,g.grant,now),
        model:async({id,prepared})=>{
          const result=await route.value.invoke(prepared,{operation:id,deadline:now+180000,
            timeout:policy.timeout,maxOutputBytes:policy.maxOutputBytes,maxTokens:policy.maxTokens,
            maxCharge:0,automaticRetries:0});
          expect(result.state).toBe('complete');
          return JSON.parse(result.bytes).conclusion.value;
        },
        send:async({text,expectedText,chat})=>{
          const result=physical.invoke({token:{type:'SecretRef',schemaVersion:1,vault:'preview',name:'telegram-bot-token'},
            method:'sendMessage',body:{chat_id:chat,text,parse_mode:'HTML'},timeoutMs:30000},token);
          expect(result.kind).toBe('response');
          const payload=JSON.parse(result.bytes);
          expect(payload.result.text).toBe(expectedText);
          return payload.result.message_id;
        },checkOutbound:()=>{}});
    };
    let worker=create(), samples=[];
    for(let i=0;i<60;i++){
      const start=performance.now(), beforeModel=substituteMs;
      if(i===20||i===40){journal.close();worker=create();}
      worker.pollGate();
      const result=physical.invoke({token:{type:'SecretRef',schemaVersion:1,vault:'preview',name:'telegram-bot-token'},
        method:'getUpdates',body:{offset:journal.view.cursor,limit:1,timeout:1},timeoutMs:12000},token);
      expect(result.kind).toBe('response');
      worker.intake(JSON.parse(result.bytes).result); await worker.drain();
      samples.push(performance.now()-start-(substituteMs-beforeModel));
    }
    const p95=values=>values.slice().sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1];
    expect(substitutes).toBe(60);
    expect(recalled).toBe(true);
    expect(deskSeen).toBe(substitutes); // the desk report reaches every real model prompt
    expect(journal.view.calls).toBe(60);
    expect(journal.view.replies).toBe(60);
    expect(journal.view.order.every(turn=>turn.sent)).toBe(true);
    const first=p95(samples.slice(0,10)),final=p95(samples.slice(50));
    process.stdout.write(`journal assembled 60 turns: non-model p95=${p95(samples).toFixed(1)} ms, first-ten=${first.toFixed(1)} ms, final-ten=${final.toFixed(1)} ms, growth=${(final-first).toFixed(1)} ms\n`);
    expect(p95(samples)).toBeLessThan(5000);
    expect(final-first).toBeLessThan(1000);
  } finally {journal?.close();endpoint.kill('SIGTERM');}
},180000);
