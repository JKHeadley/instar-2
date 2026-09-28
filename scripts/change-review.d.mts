export interface ParsedRecord {
  readonly fields: Map<string, string[]>;
  readonly closing: Readonly<Record<string, string | null>>;
  one(label: string): string | null;
  all(label: string): string[];
}
export interface PromptFinding {
  readonly id: string; readonly kind: 'fixture-phrase' | 'asserted-answer';
  readonly promptFile: string; readonly fixtureFile: string | null; readonly phrase: string;
}
export interface RecordContext {
  readonly subject: readonly string[]; readonly digest: string | null;
  readonly promptFindings: readonly PromptFinding[]; readonly promptSourcesChanged: readonly string[];
  readonly deferrals: readonly string[]; readonly skips: readonly string[];
  exists(path: string): boolean;
}
export interface Verdict { readonly errors: string[]; readonly notes: string[] }
export interface LedgerEntry {
  readonly id: string; readonly seq: number; readonly kind: string; readonly head: string; readonly tree: string;
  readonly [field: string]: unknown;
}
export interface LandingContext {
  readonly heads: readonly string[]; readonly head: string; readonly tree: string; readonly record: string;
  readonly author: string; readonly subject: readonly string[];
  artifactHash(path: string): string | null;
  convergenceEligible(record: never, author: string, population: never): boolean;
}
export const TIERS: readonly string[];
export const RED_CLASSES: readonly string[];
export const RESIDUE_SEVERITIES: readonly string[];
export function parseRecord(text: string): ParsedRecord;
export function suggestTier(paths: readonly string[]): 'ordinary' | 'significant' | 'critical';
export function isTestFile(path: string): boolean;
export function isPromptSourceFile(path: string): boolean;
export function scanPrompts(files: readonly { path: string; text: string }[]): { findings: PromptFinding[]; promptSources: string[] };
export function addedLineHits(added: readonly { path: string; line: number; text: string }[]): { deferrals: string[]; skips: string[] };
export function subjectDigest(entries: readonly { path: string; blob: string | null }[]): string;
export function validateRecord(record: ParsedRecord, ctx: RecordContext): Verdict;
export function landingVerdict(record: ParsedRecord, entries: readonly LedgerEntry[], ctx: LandingContext): Verdict;
