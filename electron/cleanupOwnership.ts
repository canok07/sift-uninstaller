import path from 'node:path';
import type { InstalledProgram, LeftoverItem } from '../src/types';

// Presentation only. This evidence must never authorize a cleanup target.
export function leftoverEvidence(program: InstalledProgram, matchedName: string, nestedPublisher: boolean): NonNullable<LeftoverItem['evidence']> {
  return {
    programName: program.displayName,
    matchedName,
    matchKind: matchedName.toLowerCase() === program.displayName.trim().toLowerCase() ? 'display-name' : 'normalized-name',
    locationKind: nestedPublisher ? 'publisher' : 'direct',
    ...(nestedPublisher && program.publisher?.trim() ? { publisher: program.publisher.trim() } : {})
  };
}

export function cleanupTerms(program: InstalledProgram): string[] {
  const name = program.displayName.trim();
  return [...new Set([name.replace(/\s*\(.*?\)\s*/g, '').replace(/version\s*[\d.]+/gi, '').trim(), name])];
}
const folded = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const overlaps = (a: string, b: string) => {
  a = path.resolve(a).toLowerCase(); b = path.resolve(b).toLowerCase();
  return a === b || a.startsWith(b + path.sep) || b.startsWith(a + path.sep);
};

// Conservative exclusion, not proof of ownership. Similar product names and
// installed locations are protected even when their exact display names differ.
export function cleanupConflict(target: string, term: string, selected: InstalledProgram, installed: InstalledProgram[]): string | undefined {
  const name = folded(term);
  for (const other of installed) {
    if (other.id === selected.id) continue;
    if (path.isAbsolute(target) && other.installLocation && path.isAbsolute(other.installLocation) && overlaps(target, other.installLocation)) return 'Başka kurulu programın konumu ile çakışıyor: ' + other.displayName;
    const names = [...cleanupTerms(other), other.publisher || ''].map(folded).filter(value => value.length >= 3);
    if (names.some(value => name.length >= 3 && (name.startsWith(value) || value.startsWith(name)))) return 'Başka kurulu program/yayıncı adıyla belirsiz eşleşme: ' + other.displayName;
  }
}
