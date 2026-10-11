import type { RegistryHive } from '../types';

export function inventoryCounts(programs: { hive: RegistryHive; category: 'desktop' | 'store' | 'system' }[]) {
  const counts = { all: programs.length, desktop: 0, store: 0, system: 0,
    sources: { HKLM: 0, HKCU: 0, WOW6432Node: 0, APPX: 0 } };
  for (const program of programs) {
    counts[program.category]++;
    const source = program.hive === 'HKLM (64-bit)' ? 'HKLM'
      : program.hive === 'HKLM (32-bit Wow6432Node)' ? 'WOW6432Node'
      : program.hive === 'HKCU (Mevcut Kullanıcı)' ? 'HKCU' : program.hive;
    counts.sources[source]++;
  }
  return counts;
}
