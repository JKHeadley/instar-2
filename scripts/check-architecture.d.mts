import type ts from 'typescript';
export function createProgram(extra?: Record<string, string>): ts.Program;
export function lintProgram(program: ts.Program, files: string[]): { file: string; line: number; rule: string; detail: string }[];
export const INTENT_DECISION_SITES: Readonly<Record<string, { variables?: string[]; decisionProperties?: boolean; functions?: string[] }>>;
export function lintIntentSites(sources?: Record<string, string>): { file: string; line: number; rule: string; detail: string }[];
type Issue = { file: string; line: number; rule: string; detail: string };
export const LIVE_ENTRY_POINTS: readonly string[];
export function shippedClientFiles(): string[];
export const HARNESS_ADAPTER_MODULES: readonly string[];
export function lintHarnessNames(sources: Record<string, string>): Issue[];
export function lintClientImports(sources: Record<string, string>): Issue[];
export const REPLACED_TRUTH_SOURCES: readonly { source: string; replacedBy: string; cutover: string }[];
export const DECLARED_OLD_STORE_READERS: Readonly<Record<string, string>>;
export const DYNAMIC_READERS: Readonly<Record<string, { loads: string[]; reason: string }>>;
export function lintReplacedStores(sources: Record<string, string>, liveEntries?: readonly string[],
  read?: (path: string) => string | null, exists?: (path: string) => boolean): Issue[];
export function registeredDoorways(text?: string): string[];
export function lintParityRegister(register?: unknown, declarations?: Record<string, unknown>,
  read?: (path: string) => string | null, doorways?: readonly string[]): Issue[];
