// Types for the register build's committed action-metadata loader (the only export TypeScript tests use).
export type ActionMetadata = Readonly<Record<string, { readonly protected: boolean; readonly repository: boolean }>>;
export function isActionSource(path: string): boolean;
export function actionRegistry(files: Readonly<Record<string, string>>): ActionMetadata;
