export function ablate(copy: string, part: string, receipt: { root: string; disposable: boolean; sourceDigest: string }): { part: string; beforeDigest: string; afterDigest: string };
