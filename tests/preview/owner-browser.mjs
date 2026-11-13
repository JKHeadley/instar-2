// Owner-only normal Chrome read. Rules 1/4/18/57/60/63/100/103/116.
// Reuses 1.x PlainChromeReloginBrowser's PID-addressed Apple Event, not its launch or login machinery.
import { spawn } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { OWNER_BROWSER_PAGES, ownerBrowserPages, ownerBrowserRequest, ownerBrowserRefused } from './owner-browser-contract.mjs';

export function readOwnerBrowserBinding(root) {
  const row = JSON.parse(readFileSync(join(root, 'owner-browser.json'), 'utf8'));
  if (Object.keys(row).sort().join(',') !== 'account,ownership,profileId,service,userDataDir'
    || row.profileId !== 'echoofdawn-github' || row.service !== 'github' || row.account !== 'EchoOfDawn'
    || row.ownership !== 'agent' || typeof row.userDataDir !== 'string' || !/^\/[A-Za-z0-9_./-]+$/u.test(row.userDataDir)
    || realpathSync(row.userDataDir) !== row.userDataDir) throw Error('profile-binding-unavailable');
  return row;
}
export function chromePid(table, binding, uid) {
  const matches = table.split('\n').map(line => /^\s*(\d+)\s+(\d+)\s+(.+)$/u.exec(line))
    .filter(row => row && Number(row[2]) === uid && row[3].startsWith('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome ')
      && !/(?:^|\s)--type=/u.test(row[3])
      && row[3].split(/\s+/u).filter(arg => arg.startsWith('--user-data-dir=')).length === 1
      && row[3].split(/\s+/u).includes(`--user-data-dir=${binding.userDataDir}`));
  return matches.length === 1 && Number(matches[0][1]) > 1 ? Number(matches[0][1]) : null;
}
// Fixed DOM code, no worker script, body, form values, hidden inputs or storage. The exact authenticated login
// meta is checked in the same evaluation as location/title; a body mentioning EchoOfDawn is insufficient.
export const ownerBrowserDom = (page = 'account-profile') => `JSON.stringify((function(){
  if(location.origin==='https://github.com' && (location.pathname==='/login' || document.querySelector('form[action="/session"]'))) return {status:'login-required'};
  if(location.origin!=='https://github.com') return {status:'refused',reason:'navigation-scope'};
  if(document.readyState!=='complete') return {status:'loading'};
  var login=document.querySelector('meta[name="user-login"]');
  if(!login || !login.content) return {status:'unavailable'};
  if(login.content!=='EchoOfDawn') return {status:'refused',reason:'account-mismatch'};
  if(location.href!==${JSON.stringify(OWNER_BROWSER_PAGES[page])}) { location.assign(${JSON.stringify(OWNER_BROWSER_PAGES[page])}); return {status:'loading'}; }
  return {status:'observed',origin:location.origin,path:location.pathname+location.search,account:'EchoOfDawn',title:document.title.slice(0,256)};
})())`;
export const OWNER_BROWSER_DOM = ownerBrowserDom();
export const OWNER_BROWSER_APPLE_EVENT = `ObjC.import('Foundation');
function fc(s){return (s.charCodeAt(0)<<24)|(s.charCodeAt(1)<<16)|(s.charCodeAt(2)<<8)|s.charCodeAt(3);}
function run(argv){
 const D=$.NSAppleEventDescriptor;
 function spec(cls,from,form,data){const r=D.recordDescriptor.coerceToDescriptorType(fc('obj '));
 r.setDescriptorForKeyword(D.descriptorWithTypeCode(fc(cls)),fc('want'));r.setDescriptorForKeyword(from,fc('from'));
 r.setDescriptorForKeyword(D.descriptorWithEnumCode(fc(form)),fc('form'));r.setDescriptorForKeyword(data,fc('seld'));return r;}
 const w=spec('cwin',D.nullDescriptor,'indx',D.descriptorWithInt32(1));
 const t=spec('prop',w,'prop',D.descriptorWithTypeCode(fc('acTa')));
 const ev=D.appleEventWithEventClassEventIDTargetDescriptorReturnIDTransactionID(fc('CrSu'),fc('ExJa'),D.descriptorWithProcessIdentifier(Number(argv[0])),-1,0);
 ev.setParamDescriptorForKeyword(t,fc('----'));
 ev.setParamDescriptorForKeyword(D.descriptorWithString(argv[1]),fc('JvSc'));
 const res=ev.sendEventWithOptionsTimeoutError(0x3,2,null);
 if(!res || res.isNil()) return '{}';
 const out=res.paramDescriptorForKeyword(fc('----'));return !out || out.isNil() ? '{}' : ObjC.unwrap(out.stringValue);
}`;
/** Strict projection: raw responses/errors never leave the owner. */
export function ownerBrowserObservation(raw, now, scrub, held, page = 'account-profile') {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 4096) return { status: 'unavailable' };
  let row; try { row = JSON.parse(raw); } catch { return { status: 'unavailable' }; }
  if (row?.status === 'login-required') return { status: 'login-required' };
  if (row?.status === 'refused') return ownerBrowserRefused(row.reason === 'navigation-scope' ? 'navigation-scope' : 'account-mismatch');
  if (row?.status !== 'observed' || row.origin !== 'https://github.com' || row.path !== OWNER_BROWSER_PAGES[page]?.slice('https://github.com'.length)
    || row.account !== 'EchoOfDawn' || typeof row.title !== 'string' || row.title.length > 256) return { status: 'unavailable' };
  const title = scrub(row.title).replace(/[\u0000-\u001f\u007f<>]/gu, '').slice(0, 256);
  const result = { status: 'observed', page, account: 'EchoOfDawn', observedAt: now,
    title, truncated: row.title.length === 256 };
  return held(JSON.stringify(result)) === 'clear' ? result : ownerBrowserRefused('output-secret-check');
}
/** One helper at a time. Abort/timeout kills only the child we started; settlement waits for its close. */
export function runOwnerBrowserHelper(command, args, signal) {
  if (signal.aborted) return Promise.reject(Error('browser-helper-unavailable'));
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'ignore'] });
    const chunks = [], maxBytes = command === '/bin/ps' ? 2 * 1024 * 1024 : 4096;
    let bytes = 0, failed = false;
    const cancel = () => { failed = true; if (child.pid) child.kill('SIGKILL'); };
    const timer = setTimeout(cancel, 2500);
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
    child.stdout.on('data', chunk => { bytes += chunk.length; if (bytes > maxBytes) cancel(); else chunks.push(chunk); });
    child.on('error', () => { failed = true; });
    child.on('close', code => {
      clearTimeout(timer); signal.removeEventListener('abort', cancel);
      if (failed || code !== 0) reject(Error('browser-helper-unavailable'));
      else resolve(Buffer.concat(chunks).toString('utf8'));
    });
  });
}
export function createOwnerBrowser({ binding, hold, scrub, held, now = Date.now, platform = process.platform,
  uid = process.getuid?.(), execute = runOwnerBrowserHelper, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  let busy = false;
  const observe = async ({ input, stopped, deadline, bindingSnapshot }) => {
    if (!ownerBrowserRequest(input)) return ownerBrowserRefused('request-scope');
    if (busy || platform !== 'darwin') return { status: 'unavailable' };
    busy = true;
    const controller = new AbortController();
    const expires = Math.min(deadline, now() + 15000);
    const withdrawn = () => stopped() || now() >= expires;
    const timer = setInterval(() => { if (withdrawn()) controller.abort(); }, 25);
    let slot, noAnswer = false;
    const pages = ownerBrowserPages(input), observations = [];
    try {
      if (withdrawn()) return ownerBrowserRefused('closed-or-stopped');
      const initial = binding();
      if (bindingSnapshot && JSON.stringify(initial) !== JSON.stringify(bindingSnapshot)) return ownerBrowserRefused('profile-withdrawn');
      slot = await hold({ timeout: Math.max(1, expires - now()), stopped: withdrawn });
      if (withdrawn()) return ownerBrowserRefused('closed-or-stopped');
      if (!slot) return { status: 'unavailable' };
      // Recheck the owner config and exact main process on EVERY evaluation; never frontmost/default fallback.
      for (let attempt = 0; attempt < 40 && !withdrawn(); attempt++) {
        if (JSON.stringify(binding()) !== JSON.stringify(initial)) return ownerBrowserRefused('profile-withdrawn');
        const table = await execute('/bin/ps', ['-axo', 'pid=,uid=,args='], controller.signal);
        const pid = chromePid(table, initial, uid);
        if (pid === null) return { status: 'unavailable' };
        if (withdrawn()) return ownerBrowserRefused('closed-or-stopped');
        if (JSON.stringify(binding()) !== JSON.stringify(initial)) return ownerBrowserRefused('profile-withdrawn');
        const raw = await execute('/usr/bin/osascript', ['-l', 'JavaScript', '-e', OWNER_BROWSER_APPLE_EVENT, String(pid), ownerBrowserDom(pages[observations.length])], controller.signal);
        if (withdrawn()) return ownerBrowserRefused('closed-or-stopped');
        if (JSON.stringify(binding()) !== JSON.stringify(initial)) return ownerBrowserRefused('profile-withdrawn');
        let loading = false;
        noAnswer = typeof raw === 'string' && Buffer.byteLength(raw) <= 4096 && raw.trim() === '';
        try {
          const row = JSON.parse(raw);
          loading = row?.status === 'loading';
          noAnswer ||= typeof raw === 'string' && Buffer.byteLength(raw) <= 4096
            && row !== null && typeof row === 'object' && !Array.isArray(row) && Object.keys(row).length === 0;
        } catch { /* Only empty output is retryable; nonempty malformed replies stay final. */ }
        if (!loading && !noAnswer) {
          const page = pages[observations.length], result = ownerBrowserObservation(raw, now(), scrub, held, page);
          if (result.status !== 'observed' || input.page) return result;
          observations.push({ ...result, url: OWNER_BROWSER_PAGES[page] });
          if (observations.length === pages.length) return { status: 'observed', observations };
          continue;
        }
        if (withdrawn()) return ownerBrowserRefused('closed-or-stopped');
        await wait(Math.min(250, Math.max(0, expires - now())));
      }
      if (stopped()) return ownerBrowserRefused('closed-or-stopped');
      return noAnswer ? { status: 'unavailable', reason: 'browser-did-not-answer-in-time' } : { status: 'unavailable' };
    } catch { return stopped() ? ownerBrowserRefused('closed-or-stopped') : { status: 'unavailable' }; }
    finally { clearInterval(timer); controller.abort(); try { if (slot) await slot.release(); } finally { busy = false; } }
  };
  return Object.freeze(Object.assign(observe, { binding }));
}
