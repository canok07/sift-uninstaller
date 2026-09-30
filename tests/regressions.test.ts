import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { buildSync } from 'esbuild';
import * as React from 'react';
import { buildCleanupCandidates, checkCleanupPath, checkCleanupRegistry, assertNoLinkedChildren, isSafeName } from '../electron/cleanupSafety';
import { verifyUninstall } from '../electron/uninstallVerification';
import { describeCleanup, describeScan } from '../src/utils/operationResults';
import { APP_VERSION } from '../src/version';
import type { LeftoverItem, LeftoverDeleteResult } from '../src/types';

const fixtureParent = path.resolve('.test-build');
fs.mkdirSync(fixtureParent, { recursive: true });
const fixtureRoot = fs.mkdtempSync(path.join(fixtureParent, 'safety-'));
after(() => {
  assert.equal(path.dirname(fixtureRoot), fixtureParent);
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

test('shared publisher root is never proposed; invalid names cannot escape the root', () => {
  const root = path.join(fixtureRoot, 'roaming');
  const candidates = buildCleanupCandidates(root, ['ExampleApp', '..', '../outside', 'C:\\Windows', 'ExampleVendor'], 'ExampleVendor');
  assert.deepEqual(candidates, [path.join(root, 'ExampleApp'), path.join(root, 'ExampleVendor', 'ExampleApp')]);
  for (const name of ['CON', 'NUL.txt', 'App:stream', 'App/', 'A', 'App.']) assert.equal(isSafeName(name), false);
});

test('path checks reject roots, sibling prefixes and traversal', () => {
  const root = path.join(fixtureRoot, 'allowed');
  fs.mkdirSync(root);
  assert.equal(checkCleanupPath(root, [root]).safe, false);
  assert.equal(checkCleanupPath(root + '-sibling', [root]).safe, false);
  assert.equal(checkCleanupPath(root + path.sep + '..' + path.sep + 'outside', [root]).safe, false);
  assert.equal(checkCleanupPath('relative/App', [root]).safe, false);
  assert.equal(checkCleanupPath(path.join(root, 'ExampleApp'), [root]).safe, true);
  assert.equal(checkCleanupPath(path.join(root, 'Windows', 'child'), [root], path.join(root, 'Windows')).safe, false);
});

test('junctions and junction ancestors are blocked; nested junction prevents deletion', async () => {
  const root = path.join(fixtureRoot, 'links');
  const outside = path.join(fixtureRoot, 'outside');
  fs.mkdirSync(root);
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'keep.txt'), 'preserve');
  fs.symlinkSync(outside, path.join(root, 'LinkedApp'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(checkCleanupPath(path.join(root, 'LinkedApp'), [root]).safe, false);
  assert.equal(checkCleanupPath(path.join(root, 'LinkedApp', 'keep.txt'), [root]).safe, false);
  const nested = path.join(root, 'AppWithLink');
  fs.mkdirSync(nested);
  fs.symlinkSync(outside, path.join(nested, 'nested'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(() => assertNoLinkedChildren(nested), /junction/);
  assert.equal(fs.readFileSync(path.join(outside, 'keep.txt'), 'utf8'), 'preserve');
});

test('Registry cleanup rejects system subtrees, other hives and traversal', () => {
  for (const key of ['HKLM', 'HKCU\\Software', 'HKLM\\SYSTEM\\Example', 'HKLM\\Software\\Microsoft\\Windows',
    'HKLM\\Software\\WOW6432Node\\Microsoft\\Windows', 'HKCU\\Software\\Classes\\Example',
    'HKCU\\Software\\..\\Example', 'HKCR\\Software\\Example', 'HKCU\\Software\\']) {
    assert.equal(checkCleanupRegistry(key).safe, false, key);
  }
  assert.equal(checkCleanupRegistry('HKCU\\Software\\ExampleApp').safe, true);
  assert.equal(checkCleanupRegistry('HKLM\\Software\\ExampleVendor\\ExampleApp').safe, true);
});

test('launcher exit zero while program remains installed is not success', async () => {
  const result = await verifyUninstall(async () => true, 0, 3, async () => {});
  assert.equal(result.success, false);
  assert.equal(result.verified, false);
  assert.match(result.error!, /iptal edilmiş/);
});

test('verification waits for delayed removal and stops after disappearance', async () => {
  let checks = 0;
  let waits = 0;
  const result = await verifyUninstall(async () => ++checks < 3, 0, 6, async () => { waits++; });
  assert.equal(result.verified, true);
  assert.equal(checks, 3);
  assert.equal(waits, 2);
});

test('3010 reports reboot pending without claiming verified removal', async () => {
  const result = await verifyUninstall(async () => true, 3010, 1);
  assert.equal(result.success, true);
  assert.equal(result.verified, false);
  assert.equal(result.rebootRequired, true);
  const removed = await verifyUninstall(async () => false, 3010, 1);
  assert.equal(removed.verified, true);
  assert.equal(removed.rebootRequired, true);
});

test('verification query failures remain errors', async () => {
  const result = await verifyUninstall(async () => { throw new Error('Access denied'); }, 0, 1);
  assert.equal(result.success, false);
  assert.match(result.error!, /Access denied/);
});

test('failed/partial scans are errors; successful empty scans are distinct', () => {
  assert.equal(describeScan({ success: false, items: [], error: 'Access denied' }).type, 'error');
  assert.match(describeScan({ success: false, items: [], error: 'Access denied' }).text, /Access denied/);
  assert.equal(describeScan({ success: true, items: [], warnings: ['Registry inaccessible'] }).type, 'error');
  assert.equal(describeScan({ success: true, items: [] }).type, 'info');
});

const partialResult: LeftoverDeleteResult = {
  success: false, deletedCount: 1, failedCount: 1,
  results: [
    { id: 'ok', path: 'App/cache', success: true },
    { id: 'locked', path: 'App/locked', success: false, error: 'Access denied' }
  ]
};
test('partial cleanup identifies only actual successes and preserves errors', () => {
  const outcome = describeCleanup(partialResult);
  assert.deepEqual(outcome.deletedIds, ['ok']);
  assert.equal(outcome.failedCount, 1);
  assert.match(outcome.error!, /Access denied/);
});

function bundle(entry: string, external: string[]) {
  return buildSync({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs',
    write: false, external, logLevel: 'silent' }).outputFiles[0].text;
}
const mainBundle = bundle('electron/main.ts', ['electron']);
function createMainSandbox(directory: string, powershell: (script: string) => string | Promise<string>) {
  const handlers = new Map<string, (...args: any[]) => Promise<any>>();
  const roots = ['roaming', 'local', 'programdata'].map((name) => path.join(directory, name));
  roots.forEach((root) => fs.mkdirSync(root, { recursive: true }));
  const userData = path.join(directory, 'userData');
  const execute: any = () => { throw new Error('Unexpected real subprocess'); };
  execute[promisify.custom] = async (file: string, args: string[]) => {
    assert.equal(file, 'powershell.exe');
    const script = Buffer.from(args.at(-1)!, 'base64').toString('utf16le');
    return { stdout: await powershell(script), stderr: '' };
  };
  const module = { exports: {} };
  vm.runInNewContext(mainBundle, {
    module, exports: module.exports, __dirname: path.resolve('electron'), Buffer, console,
    setTimeout: (callback: () => void) => { callback(); return 0; },
    process: { ...process, platform: 'win32', on() {},
      env: { APPDATA: roots[0], LOCALAPPDATA: roots[1], PROGRAMDATA: roots[2], WINDIR: path.join(directory, 'Windows') } },
    require: (name: string) => name === 'electron' ? {
      app: { getPath: () => userData, whenReady: () => ({ then() {} }), on() {} },
      ipcMain: { handle: (channel: string, handler: any) => handlers.set(channel, handler) }
    } : name === 'node:child_process' ? {
      execFile: execute,
      exec: (_command: string, _options: unknown, callback: any) => callback(null, '', '')
    } : require(name)
  });
  return { roots, handlers, logFile: path.join(userData, 'logs', 'sift-uninstaller.log') };
}
const appRecord = { displayName: 'ExampleApp', publisher: 'ExampleVendor', category: 'desktop',
  hive: 'HKCU', registryKey: 'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ExampleApp',
  uninstallString: 'test-uninstaller.exe' };

test('IPC scan excludes shared folders and logs partial Registry failure', async () => {
  const sandbox = createMainSandbox(path.join(fixtureRoot, 'ipc-scan'), async (script) => {
    if (script.includes('$hives')) return JSON.stringify([appRecord]);
    throw new Error('Registry access denied');
  });
  fs.mkdirSync(path.join(sandbox.roots[0], 'ExampleVendor'));
  fs.writeFileSync(path.join(sandbox.roots[0], 'ExampleVendor', 'other-app-data.txt'), 'keep');
  fs.mkdirSync(path.join(sandbox.roots[0], 'ExampleApp'));
  const listed = await sandbox.handlers.get('programs:get-installed')!();
  const result = await sandbox.handlers.get('leftovers:scan')!(null, { appId: listed.programs[0].id });
  assert.equal(result.success, false);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].path, path.join(sandbox.roots[0], 'ExampleApp'));
  assert.ok(result.warnings.length > 0);
  assert.match(fs.readFileSync(sandbox.logFile, 'utf8'), /Registry access denied/);
});

test('IPC cleanup deletes only fixture target and refuses replayed IDs', async () => {
  const sandbox = createMainSandbox(path.join(fixtureRoot, 'ipc-delete'), async () => JSON.stringify([appRecord]));
  const target = path.join(sandbox.roots[0], 'ExampleApp');
  fs.mkdirSync(target);
  const listed = await sandbox.handlers.get('programs:get-installed')!();
  const scan = await sandbox.handlers.get('leftovers:scan')!(null, { appId: listed.programs[0].id, options: { scanRegistry: false } });
  assert.equal(scan.success, true);
  const result = await sandbox.handlers.get('leftovers:delete')!(null, { items: [scan.items[0], { id: 'unknown' }] });
  assert.equal(result.deletedCount, 1);
  assert.equal(result.failedCount, 1);
  assert.equal(fs.existsSync(target), false);
  const replay = await sandbox.handlers.get('leftovers:delete')!(null, { items: [scan.items[0]] });
  assert.equal(replay.deletedCount, 0);
  assert.equal(replay.failedCount, 1);
});

test('uninstall IPC verifies desktop and Store presence after process exit', async () => {
  for (const category of ['desktop', 'store']) {
    const record = { ...appRecord, category, packageFullName: 'ExampleApp_1.0_x64__vendor' };
    let verified = 0;
    const sandbox = createMainSandbox(path.join(fixtureRoot, 'ipc-verify-' + category), async (script) => {
      if (script.includes('$hives')) return JSON.stringify([record]);
      if (script.includes('Remove-AppxPackage')) return '';
      assert.ok(script.includes('Test-Path') || script.includes('Get-AppxPackage'));
      verified++;
      return 'REMOVED';
    });
    const listed = await sandbox.handlers.get('programs:get-installed')!();
    const result = await sandbox.handlers.get('programs:uninstall')!(null, { appId: listed.programs[0].id });
    assert.equal(result.verified, true);
    assert.equal(verified, 1);
  }
});

test('uninstall IPC keeps cancelled programs unverified despite exit zero', async () => {
  const sandbox = createMainSandbox(path.join(fixtureRoot, 'ipc-cancel'), async (script) =>
    script.includes('$hives') ? JSON.stringify([appRecord]) : 'INSTALLED');
  const listed = await sandbox.handlers.get('programs:get-installed')!();
  const result = await sandbox.handlers.get('programs:uninstall')!(null, { appId: listed.programs[0].id });
  assert.equal(result.success, false);
  assert.equal(result.verified, false);
});

test('Windows read-only inventory and installed-state queries use valid PowerShell', { skip: process.platform !== 'win32' }, async () => {
  const queries: string[] = [];
  const sandbox = createMainSandbox(path.join(fixtureRoot, 'windows-readonly'), async (script) => {
    queries.push(script);
    // No real uninstaller or deletion command is allowed in this live read-only test.
    assert.ok(!script.includes('Remove-AppxPackage') && !script.includes('reg.exe') && !script.includes('Remove-Item'));
    return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
      { windowsHide: true, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 30000 });
  });
  const listed = await sandbox.handlers.get('programs:get-installed')!();
  assert.equal(listed.success, true, listed.error);
  for (const category of ['desktop', 'store']) {
    const program = listed.programs.find((item: any) => item.category === category && (category === 'store' || item.uninstallString));
    if (!program) continue;
    // Execute the production handler with a mocked uninstaller (exit zero).
    // The Windows presence check runs for real and must keep the installed app listed.
    const before = queries.length;
    if (category === 'store') {
      // Store uninstall is deliberately not run; probe the same read-only query directly.
      const quoted = "'" + program.displayName.replace(/'/g, "''") + "'";
      const stdout = await (async () => execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        "$ErrorActionPreference = 'Stop'; $packages = @(Get-AppxPackage -Name " + quoted + " -ErrorAction Stop); if ($packages.Count -gt 0) { 'INSTALLED' } else { 'REMOVED' }"],
        { windowsHide: true, encoding: 'utf8', timeout: 30000 }))();
      assert.equal(stdout.trim(), 'INSTALLED');
    } else {
      const result = await sandbox.handlers.get('programs:uninstall')!(null, { appId: program.id });
      assert.equal(result.verified, false);
      assert.equal(result.success, false);
      assert.ok(queries.length > before);
    }
  }
});

test('cleanup UI keeps partial failures visible without closing the dialog', async () => {
  const state: unknown[] = [];
  let cursor = 0;
  const fakeReact = {
    ...React,
    useState(initial: any) {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
      return [state[index], (next: any) => { state[index] = typeof next === 'function' ? next(state[index]) : next; }];
    },
    useRef: () => ({ current: true }),
    useEffect() {}
  };
  const module = { exports: {} as any };
  vm.runInNewContext(bundle('src/components/LeftoverCleanerModal.tsx', ['react', 'react/jsx-runtime', 'lucide-react']), {
    module, exports: module.exports, console, setTimeout,
    window: { api: { isElectron: true, deleteLeftovers: async () => partialResult } },
    require: (name: string) => name === 'react' ? fakeReact : require(name)
  });
  let closed = 0;
  const callbacks: any[] = [];
  const props = {
    appName: 'ExampleApp', scanWarning: 'Tarama eksik kaldı.',
    initialItems: [
      { id: 'ok', type: 'file', path: 'App/cache', targetScope: '%AppData%', selected: false },
      { id: 'locked', type: 'file', path: 'App/locked', targetScope: '%AppData%', selected: false }
    ] as LeftoverItem[],
    onClose: () => closed++,
    onCleanSuccess: (...args: any[]) => callbacks.push(args)
  };
  const render = () => { cursor = 0; return module.exports.LeftoverCleanerModal(props); };
  const nodes = (node: any): any[] => {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(nodes);
    return [node, ...nodes(node.props?.children)];
  };
  const textOf = (node: any): string => {
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(textOf).join('');
    return node?.props ? textOf(node.props.children) : '';
  };
  nodes(render()).find((node) => node.type === 'button' && textOf(node).includes('Tümünü Seç')).props.onClick();
  await nodes(render()).find((node) => node.type === 'button' && textOf(node).includes('Seçili Kalıntıları Sil')).props.onClick();
  const output = textOf(render());
  assert.match(output, /App\/locked/);
  assert.match(output, /Access denied/);
  assert.match(output, /Tarama eksik kaldı/);
  assert.equal(closed, 0);
  assert.equal(callbacks[0][0], 1);
  assert.equal(callbacks[0][1][0].id, 'ok');
});

test('package, UI and builder describe the same Windows release', () => {
  const config = require(path.resolve('electron-builder.config.cjs'));
  const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
  assert.equal(require('semver').valid(manifest.version), manifest.version);
  assert.equal(manifest.version, lock.version);
  assert.equal(APP_VERSION, '0.5.1.7');
  assert.equal(config.buildVersion, APP_VERSION);
  assert.equal(config.buildNumber, '7');
  assert.equal(config.extraMetadata.shortVersionWindows, APP_VERSION);
  assert.ok(config.nsis.artifactName.includes('$' + '{buildVersion}'));
  assert.equal(manifest.license, 'MIT');
  assert.equal(lock.packages[''].license, 'MIT');
  assert.ok(config.files.includes('LICENSE'));
  assert.ok(fs.readFileSync('LICENSE', 'utf8').startsWith('MIT License'));
});
