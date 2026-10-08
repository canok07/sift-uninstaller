import { createHash } from 'node:crypto';
import type { InstalledProgram } from '../src/types';

export function getProgramId(program: Pick<InstalledProgram, 'category' | 'registryKey' | 'packageFullName'>): string {
  const identity = program.category === 'store'
    ? `appx:${program.packageFullName || ''}`
    : `registry:${program.registryKey || ''}`;
  if (identity.endsWith(':') || /[\x00-\x1f]/.test(identity)) throw new Error('Programın kalıcı sistem kimliği eksik veya geçersiz.');
  if (program.category !== 'store' && !/^registry:HKEY_(LOCAL_MACHINE|CURRENT_USER)\\SOFTWARE\\/i.test(identity)) {
    throw new Error('Program için tam Registry kimliği gerekli.');
  }
  return 'win-app-' + createHash('sha256').update(identity.toLowerCase()).digest('hex');
}

// Stable identity is separate from the exact record the user confirmed.
export function getProgramRevision(program: InstalledProgram): string {
  return createHash('sha256').update(JSON.stringify([
    program.id, program.displayName, program.displayVersion, program.publisher,
    program.uninstallString, program.quietUninstallString, program.installLocation,
    program.packageFullName, program.packageName, program.category
  ])).digest('hex');
}
