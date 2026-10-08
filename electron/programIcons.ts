import path from 'node:path';
import fs from 'node:fs';
import type { InstalledProgram } from '../src/types';

export function parseDisplayIcon(value: string, env: Record<string, string | undefined> = process.env): string | null {
  if (value.length > 4096 || /[\x00-\x1f]/.test(value)) return null;
  let file = value.trim().replace(/,\s*-?\d+\s*$/, '').trim();
  if (file.startsWith('"') && file.endsWith('"')) file = file.slice(1, -1);
  file = file.replace(/%([^%]+)%/g, (_match, key: string) => {
    const found = Object.keys(env).find(name => name.toLowerCase() === key.toLowerCase());
    return found ? env[found] || '' : '%' + key + '%';
  });
  if (!/^[a-z]:[\\/]/i.test(file) || file.includes('%') || file.includes('"') || file.slice(2).includes(':')) return null;
  if (!['.exe', '.dll', '.ico', '.png'].includes(path.win32.extname(file).toLowerCase())) return null;
  return path.win32.normalize(file);
}

export function isWithinIconRoot(file: string, root: string): boolean {
  const relative = path.relative(root, file);
  return Boolean(relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
}

export function findIconFile(program: InstalledProgram): string | null {
  const parsed = parseDisplayIcon(program.displayIcon || '');
  if (!parsed) return null;
  let file = parsed;
  if (program.category === 'store') {
    const root = program.installLocation;
    if (!root || !/^[a-z]:[\\/]/i.test(root) || !isWithinIconRoot(file, root)) return null;
    // AppX logos commonly exist only as targetsize/scale assets.
    if (!fs.existsSync(file)) {
      const directory = path.dirname(file), stem = path.basename(file, path.extname(file));
      const choices = fs.readdirSync(directory).filter(name => name.toLowerCase().startsWith(stem.toLowerCase() + '.')
        && /\.(targetsize-\d+.*|scale-\d+)\.png$/i.test(name)).sort((a, b) => {
          const score = (name: string) => /targetsize-32\b/i.test(name) ? 0 : /targetsize-44\b/i.test(name) ? 1 : /scale-100\b/i.test(name) ? 2 : 3;
          return score(a) - score(b) || a.localeCompare(b);
        });
      if (!choices.length) return null;
      file = path.join(directory, choices[0]);
    }
    if (!isWithinIconRoot(fs.realpathSync(file), fs.realpathSync(root)) || path.extname(file).toLowerCase() !== '.png') return null;
    if (fs.statSync(file).size > 4 * 1024 * 1024) return null;
  }
  const resolved = fs.realpathSync(file);
  // A local-looking junction must not cause a network request.
  if (!/^[a-z]:[\\/]/i.test(resolved) || !fs.statSync(resolved).isFile()) return null;
  if (/\.(png|ico)$/i.test(resolved) && fs.statSync(resolved).size > 4 * 1024 * 1024) return null;
  return resolved;
}

export class IconQueue {
  private active = 0;
  private waiting: Array<() => void> = [];
  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= 4) await new Promise<void>(resolve => this.waiting.push(resolve));
    else this.active++;
    try { return await task(); }
    finally { const next = this.waiting.shift(); if (next) next(); else this.active--; }
  }
}
