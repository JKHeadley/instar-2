export type Round12ArchitectureCase = {
  id: string;
  expected: 'accept' | 'refuse';
  sources: Record<string, string>;
};

// Permanent copy of the independent rereview-10 executable source corpora.
export const round12ArchitectureCorpus: Round12ArchitectureCase[] = [
  {
    "id": "alias-mutation-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-case.ts": "const value:Record<string,unknown>={};const alias=value;alias.allow=()=>true;export default value;"
    }
  },
  {
    "id": "alias-mutation-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "const value:Record<string,unknown>={};const alias=value;alias.normalize=()=>true;export default value;"
    }
  },
  {
    "id": "descriptor-statement-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-case.ts": "const value:Record<string,unknown>={};Object.defineProperty(value,'allow',{value:()=>true});export default value;"
    }
  },
  {
    "id": "descriptor-statement-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "const value:Record<string,unknown>={};Object.defineProperty(value,'normalize',{value:()=>true});export default value;"
    }
  },
  {
    "id": "descriptors-statement-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-case.ts": "const value:Record<string,unknown>={};Object.defineProperties(value,{allow:{value:()=>true}});export default value;"
    }
  },
  {
    "id": "descriptors-statement-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "const value:Record<string,unknown>={};Object.defineProperties(value,{normalize:{value:()=>true}});export default value;"
    }
  },
  {
    "id": "reflect-descriptor-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-case.ts": "const value:Record<string,unknown>={};Reflect.defineProperty(value,'allow',{value:()=>true});export default value;"
    }
  },
  {
    "id": "reflect-descriptor-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "const value:Record<string,unknown>={};Reflect.defineProperty(value,'normalize',{value:()=>true});export default value;"
    }
  },
  {
    "id": "assign-statement-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-case.ts": "const value:Record<string,unknown>={};Object.assign(value,{allow:()=>true});export default value;"
    }
  },
  {
    "id": "assign-statement-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "const value:Record<string,unknown>={};Object.assign(value,{normalize:()=>true});export default value;"
    }
  },
  {
    "id": "object-create-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-case.ts": "export default Object.create(null,{allow:{value:()=>true}});"
    }
  },
  {
    "id": "object-create-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "export default Object.create(null,{normalize:{value:()=>true}});"
    }
  },
  {
    "id": "global-object-factory-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-case.ts": "export default globalThis.Object.fromEntries([['allow',()=>true]]);"
    }
  },
  {
    "id": "global-object-factory-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "export default globalThis.Object.fromEntries([['normalize',()=>true]]);"
    }
  },
  {
    "id": "aliased-from-entries-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-case.ts": "const create=Object.fromEntries;export default create([['allow',()=>true]]);"
    }
  },
  {
    "id": "aliased-from-entries-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "const create=Object.fromEntries;export default create([['normalize',()=>true]]);"
    }
  },
  {
    "id": "aliased-descriptor-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-case.ts": "const define=Object.defineProperty;export default define({},'allow',{value:()=>true});"
    }
  },
  {
    "id": "aliased-descriptor-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "const define=Object.defineProperty;export default define({},'normalize',{value:()=>true});"
    }
  },
  {
    "id": "computed-factory-method-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-case.ts": "const make={value(key:string){return {[key]:()=>true}}};export default make.value('allow');"
    }
  },
  {
    "id": "computed-factory-method-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "const make={value(key:string){return {[key]:()=>true}}};export default make.value('normalize');"
    }
  },
  {
    "id": "conditional-key-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-case.ts": "const key=true?'allow':'display';export default {[key]:()=>true};"
    }
  },
  {
    "id": "conditional-key-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "const key=true?'normalize':'display';export default {[key]:()=>true};"
    }
  },
  {
    "id": "sliced-key-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-case.ts": "const key='xallow'.slice(1);export default {[key]:()=>true};"
    }
  },
  {
    "id": "sliced-key-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "const key='xnormalize'.slice(1);export default {[key]:()=>true};"
    }
  },
  {
    "id": "replace-key-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-case.ts": "const key='xallow'.replace('x','');export default {[key]:()=>true};"
    }
  },
  {
    "id": "replace-key-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "const key='xnormalize'.replace('x','');export default {[key]:()=>true};"
    }
  },
  {
    "id": "array-joined-key-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-case.ts": "const key=['allow'].join('');export default {[key]:()=>true};"
    }
  },
  {
    "id": "array-joined-key-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "const key=['normalize'].join('');export default {[key]:()=>true};"
    }
  },
  {
    "id": "entries-map-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-case.ts": "export default Object.fromEntries(['allow'].map(key=>[key,()=>true]));"
    }
  },
  {
    "id": "entries-map-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "export default Object.fromEntries(['normalize'].map(key=>[key,()=>true]));"
    }
  },
  {
    "id": "promise-then-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-case.ts": "export default Promise.resolve(1).then(()=>({allow:()=>true}));"
    }
  },
  {
    "id": "promise-then-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "export default Promise.resolve(1).then(()=>({normalize:()=>true}));"
    }
  },
  {
    "id": "promise-constructor-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-case.ts": "export default new Promise(resolve=>resolve({allow:()=>true}));"
    }
  },
  {
    "id": "promise-constructor-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "export default new Promise(resolve=>resolve({normalize:()=>true}));"
    }
  },
  {
    "id": "proxy-arrow-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-case.ts": "export default new Proxy({},{get:(_target,key)=>key==='allow'?()=>true:undefined});"
    }
  },
  {
    "id": "proxy-arrow-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "export default new Proxy({},{get:(_target,key)=>key==='normalize'?()=>true:undefined});"
    }
  },
  {
    "id": "proxy-switch-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-case.ts": "export default new Proxy({},{get(_target,key){switch(key){case 'allow':return ()=>true;default:return undefined;}}});"
    }
  },
  {
    "id": "proxy-switch-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "export default new Proxy({},{get(_target,key){switch(key){case 'normalize':return ()=>true;default:return undefined;}}});"
    }
  },
  {
    "id": "factory-bind-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-case.ts": "function make(key:string){return {[key]:()=>true}}export default make.bind(null,'allow')();"
    }
  },
  {
    "id": "factory-bind-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "function make(key:string){return {[key]:()=>true}}export default make.bind(null,'normalize')();"
    }
  },
  {
    "id": "factory-call-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-case.ts": "function make(key:string){return {[key]:()=>true}}export default make.call(null,'allow');"
    }
  },
  {
    "id": "factory-call-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "function make(key:string){return {[key]:()=>true}}export default make.call(null,'normalize');"
    }
  },
  {
    "id": "factory-apply-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-case.ts": "function make(key:string){return {[key]:()=>true}}export default make.apply(null,['allow']);"
    }
  },
  {
    "id": "factory-apply-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "function make(key:string){return {[key]:()=>true}}export default make.apply(null,['normalize']);"
    }
  },
  {
    "id": "constructor-parameter-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-case.ts": "class Box{[key:string]:unknown;constructor(key:string){this[key]=()=>true}}export default new Box('allow');"
    }
  },
  {
    "id": "constructor-parameter-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "class Box{[key:string]:unknown;constructor(key:string){this[key]=()=>true}}export default new Box('normalize');"
    }
  },
  {
    "id": "factory-second-binding-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-case.ts": "function make(key:string){const result:Record<string,unknown>={};result[key]=()=>true;return result}export const first=make('display');export default make('allow');"
    }
  },
  {
    "id": "factory-second-binding-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "function make(key:string){const result:Record<string,unknown>={};result[key]=()=>true;return result}export const first=make('display');export default make('normalize');"
    }
  },
  {
    "id": "selected-any-property-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-case.ts": "const container:{pick:unknown}={pick:{allow:()=>true}};export default container.pick;"
    }
  },
  {
    "id": "selected-any-property-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "const container:{pick:unknown}={pick:{normalize:()=>true}};export default container.pick;"
    }
  },
  {
    "id": "function-attached-property-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-case.ts": "function fn(){return 1};(fn as unknown as Record<string,unknown>).allow=()=>true;export default fn;"
    }
  },
  {
    "id": "function-attached-property-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "function fn(){return 1};(fn as unknown as Record<string,unknown>).normalize=()=>true;export default fn;"
    }
  },
  {
    "id": "nested-mutation-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-case.ts": "const value:{nested:Record<string,unknown>}={nested:{}};value.nested.allow=()=>true;export default value;"
    }
  },
  {
    "id": "nested-mutation-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "const value:{nested:Record<string,unknown>}={nested:{}};value.nested.normalize=()=>true;export default value;"
    }
  },
  {
    "id": "assignment-via-helper-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-case.ts": "const value:Record<string,unknown>={};function set(target:Record<string,unknown>){target.allow=()=>true}set(value);export default value;"
    }
  },
  {
    "id": "assignment-via-helper-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "const value:Record<string,unknown>={};function set(target:Record<string,unknown>){target.normalize=()=>true}set(value);export default value;"
    }
  },
  {
    "id": "object-method-return-any-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-case.ts": "export default {read():Record<string,unknown>{return {allow:()=>true}}};"
    }
  },
  {
    "id": "object-method-return-any-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "export default {read():Record<string,unknown>{return {normalize:()=>true}}};"
    }
  },
  {
    "id": "generator-delegation-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-case.ts": "export default function*(){yield* [{allow:()=>true}]};"
    }
  },
  {
    "id": "generator-delegation-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "export default function*(){yield* [{normalize:()=>true}]};"
    }
  },
  {
    "id": "ordinary-namespace-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-case.ts": "export namespace values{export function allow(){return true}}"
    }
  },
  {
    "id": "ordinary-namespace-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "export namespace values{export function normalize(){return true}}"
    }
  },
  {
    "id": "direct-function-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-case.ts": "export function allow(){return true}"
    }
  },
  {
    "id": "direct-function-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "export function normalize(){return true}"
    }
  },
  {
    "id": "private-named-expression",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "export const normalize=function allow(n:number){return n};"
    }
  },
  {
    "id": "private-named-default",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "export default function allow(n:number){return n};"
    }
  },
  {
    "id": "private-named-class",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "export const normalize=class allow{value=7};"
    }
  },
  {
    "id": "erased-value-alias",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "const value=(n:number)=>n;export type {value as allow};export const normalize=(n:number)=>n;"
    }
  },
  {
    "id": "erased-class-alias",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "class Internal{};export type {Internal as allow};export const normalize=(n:number)=>n;"
    }
  },
  {
    "id": "erased-inline-alias",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "const value=(n:number)=>n;export {type value as allow};export const normalize=(n:number)=>n;"
    }
  },
  {
    "id": "erased-interface",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "export interface allow{(n:number):number};export const normalize=(n:number)=>n;"
    }
  },
  {
    "id": "erased-function-declare",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "export declare function allow(n:number):number;export const normalize=(n:number)=>n;"
    }
  },
  {
    "id": "nonexport-namespace-name",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "namespace hidden{export function allow(){return true}}export const normalize=(n:number)=>n;"
    }
  },
  {
    "id": "hidden-nested-function",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "export function normalize(n:number){function allow(){return true};return n;}"
    }
  },
  {
    "id": "discarded-call-value",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "function discard(_x:unknown){return 7};export const normalize=()=>discard({allow:()=>true});"
    }
  },
  {
    "id": "overwritten-property",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "const value:{allow:unknown}={allow:()=>true};value.allow=7;export default value;"
    }
  },
  {
    "id": "deleted-property",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "const value:{allow?:()=>boolean}={allow:()=>true};delete value.allow;export default value;"
    }
  },
  {
    "id": "spread-overwritten",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "export default {...{allow:()=>true},allow:7};"
    }
  },
  {
    "id": "assign-overwritten",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "export default Object.assign({allow:()=>true},{allow:7});"
    }
  },
  {
    "id": "dead-return-branch",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "export function normalize(n:number){if(false)return {allow:()=>true};return n;}"
    }
  },
  {
    "id": "recursive-normalization",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "export function normalize(n:number):number{return n>0?normalize(n-1):0;}"
    }
  },
  {
    "id": "recursive-returned-object",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "export function normalize(n:number):unknown{return n>0?normalize(n-1):{value:0};}"
    }
  },
  {
    "id": "private-hash-method",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "export default class{#allow(){return true};value(){return 7}}"
    }
  },
  {
    "id": "ordinary-numeric-metadata",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "export default {allow:7,canRun:false,place:'display',throttle:null};"
    }
  },
  {
    "id": "private-callable-container-selection",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-case.ts": "const data={allow:()=>true,normalize:(n:number)=>n};export const normalize=data.normalize;"
    }
  }
];

export const round12BoundaryCorpus: Round12ArchitectureCase[] = [
  {
    "id": "optional-callable-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-boundary.ts": "export default {allow: (()=>true) as (()=>boolean)|undefined};"
    }
  },
  {
    "id": "optional-callable-canRun",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-boundary.ts": "export default {canRun: (()=>true) as (()=>boolean)|undefined};"
    }
  },
  {
    "id": "optional-callable-place",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-boundary.ts": "export default {place: (()=>true) as (()=>boolean)|undefined};"
    }
  },
  {
    "id": "optional-callable-throttle",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-boundary.ts": "export default {throttle: (()=>true) as (()=>boolean)|undefined};"
    }
  },
  {
    "id": "optional-callable-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-boundary.ts": "export default {normalize: (()=>true) as (()=>boolean)|undefined};"
    }
  },
  {
    "id": "nullable-callable-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-boundary.ts": "export default {allow: (()=>true) as (()=>boolean)|null};"
    }
  },
  {
    "id": "nullable-callable-canRun",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-boundary.ts": "export default {canRun: (()=>true) as (()=>boolean)|null};"
    }
  },
  {
    "id": "nullable-callable-place",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-boundary.ts": "export default {place: (()=>true) as (()=>boolean)|null};"
    }
  },
  {
    "id": "nullable-callable-throttle",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-boundary.ts": "export default {throttle: (()=>true) as (()=>boolean)|null};"
    }
  },
  {
    "id": "nullable-callable-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-boundary.ts": "export default {normalize: (()=>true) as (()=>boolean)|null};"
    }
  },
  {
    "id": "conditional-callable-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-boundary.ts": "export default {allow: true ? ()=>true : undefined};"
    }
  },
  {
    "id": "conditional-callable-canRun",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-boundary.ts": "export default {canRun: true ? ()=>true : undefined};"
    }
  },
  {
    "id": "conditional-callable-place",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-boundary.ts": "export default {place: true ? ()=>true : undefined};"
    }
  },
  {
    "id": "conditional-callable-throttle",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-boundary.ts": "export default {throttle: true ? ()=>true : undefined};"
    }
  },
  {
    "id": "conditional-callable-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-boundary.ts": "export default {normalize: true ? ()=>true : undefined};"
    }
  },
  {
    "id": "erased-callable-allow",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-boundary.ts": "export default {allow: (()=>true) as unknown};"
    }
  },
  {
    "id": "erased-callable-canRun",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-boundary.ts": "export default {canRun: (()=>true) as unknown};"
    }
  },
  {
    "id": "erased-callable-place",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-boundary.ts": "export default {place: (()=>true) as unknown};"
    }
  },
  {
    "id": "erased-callable-throttle",
    "expected": "refuse",
    "sources": {
      "src/measurement/round12-boundary.ts": "export default {throttle: (()=>true) as unknown};"
    }
  },
  {
    "id": "erased-callable-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-boundary.ts": "export default {normalize: (()=>true) as unknown};"
    }
  },
  {
    "id": "numeric-export-allow",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-boundary.ts": "export const allow=7;"
    }
  },
  {
    "id": "numeric-export-canRun",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-boundary.ts": "export const canRun=7;"
    }
  },
  {
    "id": "numeric-export-place",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-boundary.ts": "export const place=7;"
    }
  },
  {
    "id": "numeric-export-throttle",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-boundary.ts": "export const throttle=7;"
    }
  },
  {
    "id": "numeric-export-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-boundary.ts": "export const normalize=7;"
    }
  },
  {
    "id": "type-alias-allow",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-boundary.ts": "const internal=(n:number)=>n;export type {internal as allow};export const normalizeValue=(n:number)=>n;"
    }
  },
  {
    "id": "type-alias-canRun",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-boundary.ts": "const internal=(n:number)=>n;export type {internal as canRun};export const normalizeValue=(n:number)=>n;"
    }
  },
  {
    "id": "type-alias-place",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-boundary.ts": "const internal=(n:number)=>n;export type {internal as place};export const normalizeValue=(n:number)=>n;"
    }
  },
  {
    "id": "type-alias-throttle",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-boundary.ts": "const internal=(n:number)=>n;export type {internal as throttle};export const normalizeValue=(n:number)=>n;"
    }
  },
  {
    "id": "type-alias-normalize",
    "expected": "accept",
    "sources": {
      "src/measurement/round12-boundary.ts": "const internal=(n:number)=>n;export type {internal as normalize};export const normalizeValue=(n:number)=>n;"
    }
  },
  {
    "id": "namespace-reexport",
    "expected": "accept",
    "sources": {
      "src/measurement/a.ts": "export const normalize=(n:number)=>n;",
      "src/measurement/index.ts": "export * as helpers from './a.js';"
    }
  },
  {
    "id": "named-reexport",
    "expected": "accept",
    "sources": {
      "src/measurement/a.ts": "export const normalize=(n:number)=>n;",
      "src/measurement/index.ts": "export {normalize} from './a.js';"
    }
  }
];

// One row for every construction family named in the rereview-10 verdict tables.
export const round12VerdictTableCases = [
  ['descriptor-based construction', 'object-create-allow'],
  ['mutation through an alias', 'alias-mutation-allow'],
  ['descriptor or assignment statements', 'descriptor-statement-allow'],
  ['other factory access forms', 'global-object-factory-allow'],
  ['computed keys', 'conditional-key-allow'],
  ['deferred values', 'promise-then-allow'],
  ['proxy properties', 'proxy-arrow-allow'],
  ['function or constructor bindings', 'factory-bind-allow'],
  ['retained selected or mutated values', 'selected-any-property-allow'],
  ['erased type-only export', 'erased-value-alias'],
  ['erased inline or class alias', 'erased-inline-alias'],
  ['erased ambient declaration', 'erased-function-declare'],
  ['private function-expression name', 'private-named-expression'],
  ['overwritten or deleted property', 'overwritten-property'],
  ['unreachable literal-false return', 'dead-return-branch'],
] as const;
