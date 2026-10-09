import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { promisify } from 'node:util';
import { buildSync } from 'esbuild';
import * as React from 'react';
import { buildCleanupCandidates, checkCleanupPath, checkCleanupRegistry, assertNoLinkedChildren, isSafeName } from '../electron/cleanupSafety';
import { verifyUninstall } from '../electron/uninstallVerification';
import { describeCleanup, describeScan } from '../src/utils/operationResults';
import { APP_VERSION } from '../src/version';
import { getProgramId, getProgramRevision } from '../electron/programIdentity';
import { OperationLock } from '../electron/operationLock';
import { confirmRestoreFailure, hasVerifiedRemoval, describeUninstall } from '../src/utils/uninstallFlow';
import { UninstallTask, UNINSTALL_TIMEOUT_MS } from '../electron/uninstallTask';
import { UninstallMonitor, CancelWaitModal } from '../src/components/UninstallMonitor';
import { readSettings, saveSettings, defaultSettings } from '../src/utils/settings';
import { readHistory, appendHistory, HISTORY_KEY, HISTORY_LIMIT } from '../src/utils/operationHistory';
import { OperationHistoryModal } from '../src/components/OperationHistoryModal';
import { renderToStaticMarkup } from 'react-dom/server';
import { pathToFileURL } from 'node:url';
import { parseInventory, SOURCE_IDS } from '../electron/inventory';
import { trustedRenderer, validateRendererReport, createReportLimiter } from '../electron/rendererDiagnostics';
import { parseDisplayIcon, findIconFile, isWithinIconRoot, IconQueue } from '../electron/programIcons';
import { makeErrorReport, installErrorHandlers } from '../src/utils/rendererErrors';
import { InventoryStatus } from '../src/components/InventoryStatus';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { validIPC } from '../electron/ipcSafety';
import { secureWindow } from '../electron/windowSafety';
import { parseUninstallCommand } from '../electron/uninstallCommand';
import { CleanupBackups, validateRegBackup } from '../electron/cleanupBackups';
import { treeFingerprint } from '../electron/cleanupSafety';
import { describeInventory } from '../src/utils/operationResults';
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
function createMainSandbox(directory: string, powershell: (script: string) => string | Promise<string>,
  mockExec?: (command: string, options: unknown, callback: any) => void,
  mockReg?: (args: string[]) => string | Promise<string>, boot = true, mockSpawn?: (...args: any[]) => any) {
  let ready: Promise<unknown> = Promise.resolve();
  let window: any;
  const image = { isEmpty: () => false, resize() { return this; }, toDataURL: () => 'data:image/png;base64,aGVsbG8=' };
  class MockWindow {
    webContents = { mainFrame: { url: '' }, on() {}, openDevTools() {}, setWindowOpenHandler() {},
      session: { setPermissionRequestHandler() {}, setPermissionCheckHandler() {} } };
    constructor() { window = this; }
    loadFile(file: string) { this.webContents.mainFrame.url = pathToFileURL(file).href; }
    loadURL(url: string) { this.webContents.mainFrame.url = url; }
    once() {} on() {} isDestroyed() { return false; }
  }
  const handlers = new Map<string, (...args: any[]) => Promise<any>>();
  const rawHandlers = new Map<string, (...args: any[]) => Promise<any>>();
  const roots = ['roaming', 'local', 'programdata'].map((name) => path.join(directory, name));
  roots.forEach((root) => fs.mkdirSync(root, { recursive: true }));
  const userData = path.join(directory, 'userData');
  const execute: any = () => { throw new Error('Unexpected real subprocess'); };
  execute[promisify.custom] = async (file: string, args: string[]) => {
    if (file === 'reg.exe' && mockReg) return { stdout: await mockReg(args), stderr: '' };
    assert.equal(file, 'powershell.exe');
    const script = Buffer.from(args.at(-1)!, 'base64').toString('utf16le');
    if (script.includes('WindowsIdentity')) return { stdout: 'True', stderr: '' }; // fixture admin state, not real UAC
    let stdout = await powershell(script);
    // Legacy fixture shorthand only; production requires the complete source envelope.
    if (script.includes('$hives') && stdout.trim().startsWith('[')) {
      const programs = JSON.parse(stdout).map((p: any) => p.category === 'store' ? { packageName: p.displayName, ...p } : p);
      stdout = JSON.stringify({ version: 1, programs, sources: ['HKLM', 'WOW6432Node', 'HKCU', 'APPX'].map(id => ({ id, status: 'ok', count: programs.filter((p: any) => p.hive === id).length })), warnings: [] });
    }
    return { stdout, stderr: '' };
  };
  const module = { exports: {} };
  vm.runInNewContext(mainBundle, {
    module, exports: module.exports, __dirname: path.resolve('electron'), Buffer, console,
    setTimeout: (callback: () => void, ms: number) => {
      if (ms >= UNINSTALL_TIMEOUT_MS) return setTimeout(callback, ms);
      queueMicrotask(callback); return 0;
    }, clearTimeout,
    process: { ...process, platform: 'win32', resourcesPath: directory, on() {},
      env: { APPDATA: roots[0], LOCALAPPDATA: roots[1], PROGRAMDATA: roots[2], WINDIR: path.join(directory, 'Windows'), SIFT_DEV_SERVER: boot ? '1' : undefined } },
    require: (name: string) => name === 'electron' ? {
      app: { isPackaged: true, getPath: () => userData, whenReady: () => ({ then(callback: any) { if (boot) ready = Promise.resolve().then(callback); } }), on() {}, requestSingleInstanceLock: () => true,
        getFileIcon: async () => image },
      BrowserWindow: MockWindow, Menu: { setApplicationMenu() {} }, nativeImage: { createFromPath: () => image },
      ipcMain: { handle: (channel: string, handler: any) => {
        rawHandlers.set(channel, handler);
        handlers.set(channel, async (event?: any, ...args: any[]) => {
          await ready;
          const trusted = event === undefined || (event === null && ['programs:uninstall', 'leftovers:scan', 'leftovers:delete'].includes(channel)) ? { sender: window.webContents, senderFrame: window.webContents.mainFrame } : event;
          // Simulate the preload's ID-only cleanup request for older UI fixtures.
          if (channel === 'leftovers:delete' && args[0]?.items) args[0] = { items: args[0].items.map(({ id }: any) => ({ id })) };
          return handler(trusted, ...args);
        });
      } }
    } : name === 'node:child_process' ? {
      execFile: execute,
      spawn: mockSpawn || ((command: string, args: any, options?: any) => {
        const child = new EventEmitter();
        queueMicrotask(async () => {
          try {
            if (command === 'powershell.exe') await powershell(Buffer.from(args.at(-1), 'base64').toString('utf16le'));
            if (mockExec) mockExec(command, options || args, (error: any) => child.emit('close', error?.code || 0));
            else child.emit('close', 0);
          } catch (error) { child.emit('error', error); }
        });
        return child;
      })
    } : require(name)
  });
  return { roots, handlers, rawHandlers, get ready() { return ready; }, get event() { return { sender: window?.webContents, senderFrame: window?.webContents.mainFrame }; },
    backupRoot: path.join(userData, 'cleanup-backups'), logFile: path.join(userData, 'logs', 'sift-uninstaller.log') };
}
const appRecord = { displayName: 'ExampleApp', publisher: 'ExampleVendor', category: 'desktop',
  hive: 'HKCU', registryKey: 'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ExampleApp',
  uninstallString: 'C:\\Fixture\\test-uninstaller.exe' };

async function uninstallListed(sandbox: ReturnType<typeof createMainSandbox>, program: any) {
  return sandbox.handlers.get('programs:uninstall')!(null, { appId: program.id, options: { expectedRevision: program.revision } });
}

test('IPC scan excludes shared folders and logs partial Registry failure', async () => {
  const sandbox = createMainSandbox(path.join(fixtureRoot, 'ipc-scan'), async (script) => {
    if (script.includes('$hives')) return JSON.stringify([appRecord]);
    if (script.includes("'INSTALLED'")) return 'REMOVED';
    throw new Error('Registry access denied');
  });
  fs.mkdirSync(path.join(sandbox.roots[0], 'ExampleVendor'));
  fs.writeFileSync(path.join(sandbox.roots[0], 'ExampleVendor', 'other-app-data.txt'), 'keep');
  fs.mkdirSync(path.join(sandbox.roots[0], 'ExampleApp'));
  const listed = await sandbox.handlers.get('programs:get-installed')!();
  assert.equal((await uninstallListed(sandbox, listed.programs[0])).verified, true);
  const result = await sandbox.handlers.get('leftovers:scan')!(null, { appId: listed.programs[0].id });
  assert.equal(result.success, false);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].path, path.join(sandbox.roots[0], 'ExampleApp'));
  assert.ok(result.warnings.length > 0);
  assert.match(fs.readFileSync(sandbox.logFile, 'utf8'), /Registry access denied/);
});

test('IPC cleanup deletes only fixture target and refuses replayed IDs', async () => {
  const sandbox = createMainSandbox(path.join(fixtureRoot, 'ipc-delete'), async script => script.includes('$hives') ? JSON.stringify([appRecord]) : 'REMOVED');
  const target = path.join(sandbox.roots[0], 'ExampleApp');
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, 'keepable.txt'), 'recoverable');
  const listed = await sandbox.handlers.get('programs:get-installed')!();
  await uninstallListed(sandbox, listed.programs[0]);
  const scan = await sandbox.handlers.get('leftovers:scan')!(null, { appId: listed.programs[0].id, options: { scanRegistry: false } });
  assert.equal(scan.success, true);
  const result = await sandbox.handlers.get('leftovers:delete')!(null, { items: [scan.items[0], { id: 'unknown' }] });
  assert.equal(result.deletedCount, 1);
  assert.equal(result.failedCount, 1);
  assert.equal(fs.existsSync(target), false);
  const backupDirectory = path.join(sandbox.backupRoot, fs.readdirSync(sandbox.backupRoot)[0]);
  assert.equal(fs.readFileSync(path.join(backupDirectory, 'payload', 'keepable.txt'), 'utf8'), 'recoverable');
  assert.equal(JSON.parse(fs.readFileSync(path.join(backupDirectory, 'manifest.json'), 'utf8')).originalPath, target);
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
    const result = await uninstallListed(sandbox, listed.programs[0]);
    assert.equal(result.verified, true);
    assert.equal(verified, 1);
  }
});

test('uninstall IPC keeps cancelled programs unverified despite exit zero', async () => {
  const sandbox = createMainSandbox(path.join(fixtureRoot, 'ipc-cancel'), async (script) =>
    script.includes('$hives') ? JSON.stringify([appRecord]) : 'INSTALLED');
  const listed = await sandbox.handlers.get('programs:get-installed')!();
  const result = await uninstallListed(sandbox, listed.programs[0]);
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
      const quoted = "'" + program.packageName.replace(/'/g, "''") + "'";
      const stdout = await (async () => execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        "$ErrorActionPreference = 'Stop'; $packages = @(Get-AppxPackage -Name " + quoted + " -ErrorAction Stop); if ($packages.Count -gt 0) { 'INSTALLED' } else { 'REMOVED' }"],
        { windowsHide: true, encoding: 'utf8', timeout: 30000 }))();
      assert.equal(stdout.trim(), 'INSTALLED');
    } else {
      const result = await uninstallListed(sandbox, program);
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
  const historyResults: any[] = [];
  const props = {
    appName: 'ExampleApp', scanWarning: 'Tarama eksik kaldı.',
    initialItems: [
      { id: 'ok', type: 'file', path: 'App/cache', targetScope: '%AppData%', selected: false },
      { id: 'locked', type: 'file', path: 'App/locked', targetScope: '%AppData%', selected: false }
    ] as LeftoverItem[],
    onClose: () => closed++,
    onCleanSuccess: (...args: any[]) => callbacks.push(args),
    onResult: (...args: any[]) => historyResults.push(args)
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
  assert.equal(historyResults.length, 1);
  assert.equal(historyResults[0][0], 'error');
  assert.match(historyResults[0][1], /Access denied/);
  assert.equal(historyResults[0][2], false);
});

test('package, UI and builder describe the same Windows release', () => {
  const config = require(path.resolve('electron-builder.config.cjs'));
  const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
  assert.equal(require('semver').valid(manifest.version), manifest.version);
  assert.equal(manifest.version, lock.version);
  assert.equal(APP_VERSION, '0.5.1.13');
  assert.equal(config.buildVersion, APP_VERSION);
  assert.equal(config.buildNumber, '13');
  assert.equal(config.extraMetadata.shortVersionWindows, APP_VERSION);
  assert.ok(config.nsis.artifactName.includes('$' + '{buildVersion}'));
  assert.equal(manifest.license, 'MIT');
  assert.equal(lock.packages[''].license, 'MIT');
  assert.ok(config.files.includes('LICENSE'));
  assert.ok(fs.readFileSync('LICENSE', 'utf8').startsWith('MIT License'));
  assert.equal(config.win.icon, 'build/icon.ico');
  assert.equal(config.nsis.installerIcon, config.win.icon);
  assert.equal(config.extraResources[0].to, 'icon.ico');
  const html = fs.readFileSync('index.html', 'utf8');
  assert.ok(html.includes('<title>Sift Uninstaller</title>') && html.includes('/icon.svg'));
  const readme = fs.readFileSync('README.md', 'utf8');
  assert.ok(readme.includes(`**${APP_VERSION}**`));
  assert.ok(readme.indexOf('## English') < readme.indexOf('## Türkçe'));
});

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}
test('operation history survives reload and retains error details, newest first, bounded to 100', () => {
  const storage = memoryStorage();
  let entries = readHistory(storage).entries;
  for (let i = 0; i < HISTORY_LIMIT + 5; i++) entries = appendHistory(entries, {
    operation: 'Kalıntı temizliği', appName: `App ${i}`, status: 'error',
    message: `Access denied: App ${i}/locked`, demo: false
  }, storage).entries;
  const reloaded = readHistory(storage);
  assert.equal(reloaded.issue, undefined);
  assert.equal(reloaded.entries.length, HISTORY_LIMIT);
  assert.equal(reloaded.entries[0].appName, 'App 104');
  assert.match(reloaded.entries[0].message, /Access denied/);
  assert.ok(Number.isFinite(Date.parse(reloaded.entries[0].timestamp)));
  assert.equal(new Set(reloaded.entries.map(entry => entry.id)).size, HISTORY_LIMIT);
});
test('corrupt/unsupported history is rejected and denied storage does not discard the session result', () => {
  const storage = memoryStorage();
  for (const corrupt of ['broken', '{"version":2,"entries":[]}', '{"version":1,"entries":[{"message":"bad"}]}']) {
    storage.setItem(HISTORY_KEY, corrupt);
    assert.deepEqual(readHistory(storage).entries, []);
    assert.ok(readHistory(storage).issue);
  }
  const denied = { setItem() { throw new Error('Quota exceeded'); } };
  const result = appendHistory([], { operation: 'Kaldırma', status: 'warning', message: 'Reboot required', demo: true }, denied);
  assert.equal(result.entries[0].message, 'Reboot required');
  assert.ok(result.issue);
  const long = appendHistory([], { operation: 'Scan', status: 'error', message: 'x'.repeat(12000), demo: false }, storage);
  assert.ok(long.entries[0].message.length <= 8000);
  assert.match(long.entries[0].message, /kısaltıldı/);
  assert.equal(readHistory(storage).entries.length, 1);
});
test('history UI renders empty state, errors, timestamps and explicit demo labels without HTML injection', () => {
  const empty = renderToStaticMarkup(React.createElement(OperationHistoryModal, { entries: [], onClose() {} }));
  assert.match(empty, /Henüz kayıtlı işlem yok/);
  const entries = appendHistory([], { operation: 'Kaldırma', status: 'error', appName: '<script>App</script>',
    message: 'Access denied <img src=x>', demo: true }, memoryStorage()).entries;
  const html = renderToStaticMarkup(React.createElement(OperationHistoryModal, { entries, issue: 'Storage unavailable', onClose() {} }));
  assert.match(html, /Hata.*Demo/);
  assert.match(html, /Access denied/);
  assert.ok(html.includes(entries[0].timestamp));
  assert.match(html, /Storage unavailable/);
  assert.ok(!html.includes('<script>') && !html.includes('<img src=x>'));
});
test('generated Windows ICO includes transparent PNG images at all requested sizes', () => {
  execFileSync(process.execPath, ['scripts/build-icon.mjs']);
  const ico = fs.readFileSync('build/icon.ico');
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 4);
  [16, 32, 48, 256].forEach((size, i) => {
    const entry = 6 + i * 16, offset = ico.readUInt32LE(entry + 12), length = ico.readUInt32LE(entry + 8);
    assert.equal(ico[entry] || 256, size);
    const image = ico.subarray(offset, offset + length);
    assert.deepEqual([...image.subarray(0, 8)], [137,80,78,71,13,10,26,10]);
    assert.equal(image.readUInt32BE(16), size);
    assert.equal(image.readUInt32BE(20), size);
    assert.equal(image[25], 6);
    if (size === 256) fs.writeFileSync(path.join(fixtureParent, 'icon-preview.png'), image);
  });
});
test('stable identities survive sorting and distinguish programs; revisions detect changed commands', () => {
  const a = { category: 'desktop' as const, registryKey: appRecord.registryKey };
  const b = { ...a, registryKey: a.registryKey.replace('ExampleApp', 'OtherApp') };
  assert.notEqual(getProgramId(a), getProgramId(b));
  assert.equal(getProgramId(a), getProgramId({ ...a, registryKey: a.registryKey.toLowerCase() }));
  assert.throws(() => getProgramId({ category: 'desktop', registryKey: '' }));
  const record = { ...appRecord, category: 'desktop' as const, id: getProgramId(a), registryHive: 'HKCU' as const };
  assert.notEqual(getProgramRevision(record), getProgramRevision({ ...record, uninstallString: 'changed.exe' }));
});
test('operation lock rejects parallel work and an old release cannot unlock newer work', () => {
  const lock = new OperationLock();
  const release = lock.acquire('uninstall')!;
  assert.equal(lock.acquire('scan'), null);
  release();
  const nextRelease = lock.acquire('scan')!;
  release();
  assert.equal(lock.active, 'scan');
  nextRelease();
  assert.equal(lock.active, null);
});
test('settings persist validated values and restore failure respects cancel or explicit continue', async () => {
  const storage = memoryStorage();
  saveSettings(storage, { ...defaultSettings, silent: true, restorePoint: false });
  assert.equal(readSettings(storage).silent, true);
  assert.equal(readSettings(storage).restorePoint, false);
  const cancelled = await confirmRestoreFailure(async () => ({ success: false, supported: false, error: 'Protection disabled' }), async () => false);
  assert.equal(cancelled.proceed, false);
  const continued = await confirmRestoreFailure(async () => { throw new Error('Denied'); }, async error => error === 'Denied');
  assert.equal(continued.proceed, true);
  assert.equal(continued.warning, 'Denied');
});

function inventoryEnvelope(programs: any[] = [appRecord], failed: string[] = []) {
  return { version: 1, programs, sources: SOURCE_IDS.map(id => ({ id,
    status: failed.includes(id) ? 'error' : 'ok', count: programs.filter(p => p.hive === id).length,
    ...(failed.includes(id) ? { error: 'Access denied: ' + id } : {}) })), warnings: [] as string[] };
}
test('inventory rejects empty/malformed replies and distinguishes complete empty sources', () => {
  for (const value of ['', 'null', '[]', '{}', '{"version":1,"programs":[],"sources":[],"warnings":[]}']) {
    assert.throws(() => parseInventory(value));
  }
  const empty = parseInventory(JSON.stringify(inventoryEnvelope([])));
  assert.equal(empty.programs.length, 0);
  assert.equal(empty.sources.length, 4);
  const bad = inventoryEnvelope();
  bad.sources[0].id = 'HKCU';
  assert.throws(() => parseInventory(JSON.stringify(bad)));
  const mismatched = inventoryEnvelope();
  mismatched.sources[0].count = 9;
  assert.throws(() => parseInventory(JSON.stringify(mismatched)));
});
test('partial inventory keeps available records, persists source errors and displays a lasting warning', async () => {
  const response = inventoryEnvelope([appRecord], ['HKLM', 'APPX']);
  const sandbox = createMainSandbox(path.join(fixtureRoot, 'inventory-partial'), async () => JSON.stringify(response));
  const listed = await sandbox.handlers.get('programs:get-installed')!();
  assert.equal(listed.success, true);
  assert.equal(listed.partial, true);
  assert.equal(listed.programs.length, 1);
  assert.match(fs.readFileSync(sandbox.logFile, 'utf8'), /Access denied: APPX/);
  const summary = describeInventory(listed);
  assert.equal(summary.status, 'warning');
  assert.match(summary.text, /HKLM/);
  const html = renderToStaticMarkup(React.createElement(InventoryStatus, { sources: listed.sources, warnings: [] }));
  assert.match(html, /Tarama eksik kaldı/);
  assert.match(html, /HKCU/);
  assert.match(html, /Access denied: APPX/);
});
test('total inventory failure is not an empty success; malformed stdout is logged', async () => {
  for (const [name, stdout] of [['all-fail', JSON.stringify(inventoryEnvelope([], [...SOURCE_IDS]))], ['blank', '']]) {
    const sandbox = createMainSandbox(path.join(fixtureRoot, name), async () => stdout);
    const listed = await sandbox.handlers.get('programs:get-installed')!();
    assert.equal(listed.success, false);
    assert.equal(listed.programs.length, 0);
    assert.ok(listed.error);
    assert.match(fs.readFileSync(sandbox.logFile, 'utf8'), /ERROR/);
  }
});
test('friendly Store name never becomes the presence-check identity', async () => {
  const store = { ...appRecord, displayName: 'Hesap Makinesi', packageName: 'Microsoft.WindowsCalculator',
    packageFullName: 'Microsoft.WindowsCalculator_1.0_x64__vendor', hive: 'APPX', category: 'store' };
  const scripts: string[] = [];
  const sandbox = createMainSandbox(path.join(fixtureRoot, 'friendly-name'), async script => {
    scripts.push(script);
    if (script.includes('$hives')) return JSON.stringify(inventoryEnvelope([store]));
    if (script.includes('Remove-AppxPackage')) return '';
    assert.ok(script.includes("-Name 'Microsoft.WindowsCalculator'"));
    assert.ok(!script.includes("-Name 'Hesap Makinesi'"));
    return 'REMOVED';
  });
  const listed = await sandbox.handlers.get('programs:get-installed')!();
  assert.equal(listed.programs[0].displayName, 'Hesap Makinesi');
  assert.equal((await uninstallListed(sandbox, listed.programs[0])).verified, true);
  assert.ok(scripts.some(script => script.includes("-Package 'Microsoft.WindowsCalculator_1.0_x64__vendor'")));
  assert.throws(() => parseInventory(JSON.stringify(inventoryEnvelope([{ ...store, packageName: '' }]))));
});
test('renderer diagnostics reject other windows/frames/navigation and bound reports and bursts', () => {
  const frame = { url: 'file:///app/index.html' }, contents = { mainFrame: frame };
  const win = { webContents: contents, isDestroyed: () => false };
  const event = { sender: contents, senderFrame: frame };
  assert.equal(trustedRenderer(event, win, frame.url), true);
  assert.equal(trustedRenderer({ ...event, sender: {} }, win, frame.url), false);
  assert.equal(trustedRenderer({ ...event, senderFrame: { url: frame.url } }, win, frame.url), false);
  assert.equal(trustedRenderer(event, win, 'https://untrusted.test'), false);
  assert.equal(validateRendererReport({ kind: 'shell', message: 'hello' }), null);
  assert.equal(validateRendererReport({ kind: 'error', message: 'x'.repeat(4001) }), null);
  const cleaned = validateRendererReport({ kind: 'error', message: 'bad\nhttps://site.test/a?token=secret#extra' })!;
  assert.equal(cleaned.message, 'bad https://site.test/a');
  let clock = 1;
  const accept = createReportLimiter(() => clock);
  for (let i = 0; i < 20; i++) assert.equal(accept(), true);
  assert.equal(accept(), false);
  clock += 60000;
  assert.equal(accept(), true);
});
test('renderer error IPC persists accepted reports and rejects invalid or untrusted input', async () => {
  const sandbox = createMainSandbox(path.join(fixtureRoot, 'renderer-log'), async () => '', undefined, undefined, true);
  await sandbox.ready;
  const report = sandbox.handlers.get('logs:renderer-error')!;
  assert.equal((await report(sandbox.event, { kind: 'react', message: 'Render failed', stack: 'Component stack' })).success, true);
  assert.match(fs.readFileSync(sandbox.logFile, 'utf8'), /Render failed.*Component stack/);
  assert.equal((await report(null, { kind: 'error', message: 'intruder' })).success, false);
  assert.equal((await report(sandbox.event, { kind: 'error', message: 'x'.repeat(8001) })).success, false);
  assert.ok(!fs.readFileSync(sandbox.logFile, 'utf8').includes('intruder'));
});
test('global error/rejection listeners capture safely and unregister; bridge failures do not loop', async () => {
  const listeners = new Map<string, any>();
  const target: any = { addEventListener: (name: string, listener: any) => listeners.set(name, listener),
    removeEventListener: (name: string) => listeners.delete(name) };
  const reports: any[] = [];
  const remove = installErrorHandlers(target, report => reports.push(report));
  listeners.get('error')({ error: new Error('click failed'), message: '' });
  listeners.get('unhandledrejection')({ reason: { password: 'do not store' } });
  assert.equal(reports[0].kind, 'error');
  assert.match(reports[0].stack, /click failed/);
  assert.ok(!JSON.stringify(reports).includes('do not store'));
  remove();
  assert.equal(listeners.size, 0);
  assert.equal(makeErrorReport('error', 'x'.repeat(10000)).message.length, 4000);
  const saved = (globalThis as any).window;
  (globalThis as any).window = { api: { reportRendererError: async (report: any) => { reports.push(report); throw new Error('Bridge unavailable'); } } };
  try {
    const boundary = new ErrorBoundary({ children: 'normal' });
    boundary.componentDidCatch(new Error('Boundary error'));
    assert.equal(reports.at(-1).kind, 'react');
    boundary.state = ErrorBoundary.getDerivedStateFromError();
    const html = renderToStaticMarkup(boundary.render());
    assert.match(html, /Arayüzde bir hata oluştu/);
    assert.match(html, /kaldırıcıyı durdurmaz/);
    await Promise.resolve();
  } finally { (globalThis as any).window = saved; }
});
test('DisplayIcon parsing permits local executable/image paths, not remote files or arbitrary schemes', () => {
  assert.equal(parseDisplayIcon('"C:\\Program Files\\App\\app.exe",-12'), 'C:\\Program Files\\App\\app.exe');
  assert.equal(parseDisplayIcon('%systemroot%\\System32\\shell32.dll,0', { SystemRoot: 'C:\\Windows' }), 'C:\\Windows\\System32\\shell32.dll');
  for (const bad of ['\\\\server\\share\\icon.png', 'https://site/icon.png', 'C:\\App\\icon.svg', 'relative.ico', 'C:\\App\\a.png:secret', '%MISSING%\\a.exe']) assert.equal(parseDisplayIcon(bad), null);
  assert.equal(isWithinIconRoot(path.join(fixtureRoot, 'pkg', 'Assets', 'a.png'), path.join(fixtureRoot, 'pkg')), true);
  assert.equal(isWithinIconRoot(path.join(fixtureRoot, 'pkg-other', 'a.png'), path.join(fixtureRoot, 'pkg')), false);
});
test('Store icon variants stay inside the package and reject junction escape', { skip: process.platform !== 'win32' }, () => {
  const root = path.join(fixtureRoot, 'package-icons'), assets = path.join(root, 'Assets');
  fs.mkdirSync(assets, { recursive: true });
  const icon = path.join(assets, 'Logo.targetsize-44_altform-unplated.png');
  fs.writeFileSync(icon, 'fixture');
  const program: any = { category: 'store', installLocation: root, displayIcon: path.join(assets, 'Logo.png') };
  assert.equal(findIconFile(program), fs.realpathSync(icon));
  fs.symlinkSync(path.join(fixtureRoot, 'outside'), path.join(root, 'Linked'), 'junction');
  fs.writeFileSync(path.join(fixtureRoot, 'outside', 'a.png'), 'outside');
  assert.equal(findIconFile({ ...program, displayIcon: path.join(root, 'Linked', 'a.png') }), null);
});
test('icon requests require cached revision, cache results and fail safely for missing icons', async () => {
  const file = path.join(fixtureRoot, 'desktop.ico');
  fs.writeFileSync(file, 'fixture');
  const sandbox = createMainSandbox(path.join(fixtureRoot, 'icon-ipc'), async () => JSON.stringify(inventoryEnvelope([{ ...appRecord, displayIcon: file }])), undefined, undefined, true);
  await sandbox.ready;
  const list = await sandbox.handlers.get('programs:get-installed')!();
  const input = { appId: list.programs[0].id, revision: list.programs[0].revision };
  const icon = sandbox.handlers.get('programs:get-icon')!;
  assert.equal((await icon(sandbox.event, input)).dataUrl, 'data:image/png;base64,aGVsbG8=');
  assert.equal((await icon(null, input)).dataUrl, undefined);
  assert.equal((await icon(sandbox.event, { ...input, revision: 'stale' })).dataUrl, undefined);
  fs.rmSync(file);
  assert.equal((await icon(sandbox.event, input)).dataUrl, 'data:image/png;base64,aGVsbG8=');
  const refreshed = await sandbox.handlers.get('programs:get-installed')!();
  assert.equal((await icon(sandbox.event, { appId: input.appId, revision: refreshed.programs[0].revision })).dataUrl, undefined);
});
test('icon queue caps native work at four and releases slots after failures', async () => {
  const queue = new IconQueue();
  let active = 0, peak = 0;
  const releases: Array<() => void> = [];
  const promises = Array.from({ length: 12 }, (_, i) => queue.run(async () => {
    active++; peak = Math.max(peak, active);
    await new Promise<void>(resolve => releases.push(resolve));
    active--;
    if (i === 2) throw new Error('Icon failure');
    return i;
  }).catch(() => -1));
  for (let batch = 0; batch < 3; batch++) {
    assert.equal(releases.length, 4);
    releases.splice(0).forEach(release => release());
    // Flush continuation, catch/finally and the queued slot transfer.
    await new Promise(resolve => setImmediate(resolve));
  }
  const results = await Promise.all(promises);
  assert.equal(peak, 4);
  assert.equal(results[2], -1);
});

function fakeClock() {
  let time = 1000;
  const timers = new Map<number, () => void>();
  let id = 0;
  return { now: () => time, setTimer: (callback: () => void) => { timers.set(++id, callback); return id; },
    clearTimer: (token: number) => timers.delete(token),
    advance(ms: number) { time += ms; const due = [...timers.values()]; timers.clear(); due.forEach(callback => callback()); },
    get size() { return timers.size; } };
}
function fakeChild() {
  const child = new EventEmitter() as EventEmitter & { pid: number; kill(): never };
  child.pid = 123;
  child.kill = () => { throw new Error('A safe wait cancellation must NEVER kill a process'); };
  return child;
}
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

test('deadline returns promptly without killing the child or authorizing late cleanup', async () => {
  const timer = fakeClock(), child = fakeChild();
  const task = new UninstallTask(timer, 50);
  let queries = 0;
  const result = task.run({ appId: 'app', appName: 'App' }, () => child, async () => { queries++; return { success: true, verified: true }; });
  timer.advance(50);
  const timedOut = await result;
  assert.equal(timedOut.timedOut, true);
  assert.equal(timedOut.backgroundPending, true);
  assert.equal(timedOut.externalStillRunning, true);
  assert.equal(hasVerifiedRemoval(timedOut), false);
  assert.equal(task.activity.active, true);
  assert.equal((await task.run({ appId: 'other', appName: 'Other' }, () => { throw new Error('Must not launch'); }, async () => ({} as any))).success, false);
  child.emit('close', 0);
  await flush();
  assert.equal(queries, 0);
  assert.equal(task.activity.active, false);
  assert.equal(timer.size, 0);
});
test('cancel tokens reject stale/repeated requests and cannot cancel a newer operation', async () => {
  const timer = fakeClock(), first = fakeChild(), task = new UninstallTask(timer, 50);
  const p1 = task.run({ appId: 'app', appName: 'App' }, () => first, async () => ({ success: true, verified: true }));
  const a1 = task.activity;
  assert.ok(a1.active);
  assert.equal(task.cancel('stale').success, false);
  assert.equal(task.cancel(a1.operationId).success, true);
  assert.equal(task.cancel(a1.operationId).success, false);
  assert.equal((await p1).cancelled, true);
  first.emit('close', 0); await flush();
  const second = fakeChild();
  const p2 = task.run({ appId: 'app', appName: 'App' }, () => second, async () => ({ success: true, verified: true }));
  assert.equal(task.cancel(a1.operationId).success, false);
  second.emit('close', 0);
  assert.equal(hasVerifiedRemoval(await p2), true);
  assert.equal(task.activity.active, false);
});
test('cancel during verification ignores a late success and holds the gate until the query drains', async () => {
  const child = fakeChild(), task = new UninstallTask(fakeClock(), 50);
  let finish!: (result: any) => void;
  const result = task.run({ appId: 'app', appName: 'App' }, () => child, () => new Promise(resolve => { finish = resolve; }));
  child.emit('close', 0); await flush();
  const activity = task.activity;
  assert.ok(activity.active);
  assert.equal(activity.phase, 'verifying');
  assert.equal(task.cancel(activity.operationId).success, true);
  const cancelled = await result;
  assert.equal(cancelled.externalStillRunning, false);
  assert.equal(cancelled.backgroundPending, true);
  assert.equal(task.activity.active, true);
  finish({ success: true, verified: true }); await flush();
  assert.equal(cancelled.verified, false);
  assert.equal(task.activity.active, false);
});
test('spawn failures, nonzero exits and verification rejection are failures with released gates', async () => {
  for (const mode of ['throw', 'error', 'code', 'verify']) {
    const task = new UninstallTask(fakeClock(), 50), child = fakeChild();
    if (mode === 'error') child.pid = undefined as any;
    const result = task.run({ appId: 'app', appName: 'App' }, () => {
      if (mode === 'throw') throw new Error('Spawn failed'); return child;
    }, async () => { throw new Error('Verification failed'); });
    if (mode === 'error') child.emit('error', new Error('ENOENT'));
    else if (mode !== 'throw') child.emit('close', mode === 'code' ? 1603 : 0);
    assert.equal((await result).success, false, mode);
    assert.equal(task.activity.active, false, mode);
  }
});
test('an error on an existing child is not evidence that the launcher stopped', async () => {
  const child = fakeChild(), task = new UninstallTask(fakeClock(), 50);
  const result = task.run({ appId: 'app', appName: 'App' }, () => child, async () => ({ success: true, verified: true }));
  child.emit('error', new Error('Unexpected process error'));
  assert.equal((await result).success, false);
  assert.equal(task.activity.active, true);
  child.emit('close', 0); await flush();
  assert.equal(task.activity.active, false);
});
test('verification checks cancellation before and after a delayed presence query', async () => {
  let stopped = false;
  let resolve!: (value: boolean) => void;
  const result = verifyUninstall(() => new Promise(r => { resolve = r; }), 0, 2, async () => {}, () => stopped);
  stopped = true; resolve(false);
  assert.equal((await result).verified, false);
  let calls = 0;
  const early = await verifyUninstall(async () => { calls++; return false; }, 0, 2, async () => {}, () => true);
  assert.equal(early.cancelled, true);
  assert.equal(calls, 0);
});
test('3010 stays a reboot warning and cancelled/timed-out/in-flight results never enable cleanup', async () => {
  const child = fakeChild(), task = new UninstallTask(fakeClock(), 50);
  const result = task.run({ appId: 'app', appName: 'App' }, () => child, code => verifyUninstall(async () => true, code, 1));
  child.emit('close', 3010);
  assert.equal(describeUninstall(await result).status, 'warning');
  for (const flag of ['cancelled', 'timedOut', 'backgroundPending']) {
    assert.equal(hasVerifiedRemoval({ success: true, verified: true, [flag]: true }), false);
  }
  assert.equal(describeUninstall({ success: false, cancelled: true }).status, 'cancelled');
  assert.equal(describeUninstall({ success: false, timedOut: true }).status, 'warning');
});
test('cancel IPC validates sender and token; pending process blocks refresh/cleanup/uninstall until close', async () => {
  const child = fakeChild();
  const sandbox = createMainSandbox(path.join(fixtureRoot, 'cancel-ipc'), async script => script.includes('$hives') ? JSON.stringify([appRecord]) : 'REMOVED',
    undefined, undefined, true, () => child);
  await sandbox.ready;
  const list = await sandbox.handlers.get('programs:get-installed')!();
  const running = uninstallListed(sandbox, list.programs[0]);
  const get = sandbox.handlers.get('programs:get-uninstall-activity')!;
  const cancel = sandbox.handlers.get('programs:cancel-uninstall-wait')!;
  const activity = await get(sandbox.event);
  assert.ok(activity.active);
  await assert.rejects(() => get(null));
  assert.equal((await cancel(null, { operationId: activity.operationId })).success, false);
  assert.equal((await cancel(sandbox.event, { operationId: '../arbitrary' })).success, false);
  assert.equal((await cancel(sandbox.event, { operationId: activity.operationId })).success, true);
  assert.equal((await running).cancelled, true);
  for (const channel of ['programs:get-installed', 'programs:uninstall', 'leftovers:scan', 'leftovers:delete']) {
    const payload = channel === 'programs:uninstall' ? { appId: list.programs[0].id, options: { expectedRevision: list.programs[0].revision } } : channel === 'leftovers:scan' ? { appId: list.programs[0].id } : { items: [] };
    const result = channel === 'programs:get-installed' ? await sandbox.handlers.get(channel)!() : await sandbox.handlers.get(channel)!(null, payload);
    assert.equal(result.success, false, channel);
    assert.match(result.error, /takip ediliyor/);
  }
  child.emit('close', 0); await flush();
  assert.equal((await get(sandbox.event)).active, false);
  assert.equal((await sandbox.handlers.get('leftovers:scan')!(null, { appId: list.programs[0].id })).success, false);
  assert.equal((await sandbox.handlers.get('programs:get-installed')!()).success, true);
  assert.match(fs.readFileSync(sandbox.logFile, 'utf8'), /Windows işlemi öldürülmedi/);
});
test('real harmless fixture child survives deadline and exits normally without kill', async () => {
  const child = spawn(process.execPath, ['-e', 'setTimeout(() => process.exit(0), 500)'], { stdio: 'ignore', windowsHide: true });
  const closed = new Promise<void>(resolve => child.once('close', () => resolve()));
  const task = new UninstallTask(undefined, 30);
  const result = await task.run({ appId: 'fixture', appName: 'Harmless test process' }, () => child, async () => ({ success: true, verified: true }));
  assert.equal(result.timedOut, true);
  assert.equal(child.killed, false);
  assert.equal(task.activity.active, true);
  await closed; await flush();
  assert.equal(child.killed, false);
  assert.equal(task.activity.active, false);
});
test('monitor and cancel confirmation explicitly say they do not stop Windows or authorize cleanup', () => {
  const activity: any = { active: true, operationId: 'test', appId: 'app', appName: '<script>App</script>',
    startedAt: Date.now(), deadlineAt: Date.now() + UNINSTALL_TIMEOUT_MS, phase: 'running', awaitingResult: true, externalStillRunning: true };
  const monitor = renderToStaticMarkup(React.createElement(UninstallMonitor, { activity, onStopWait() {} }));
  assert.match(monitor, /Beklemeyi Bırak/);
  assert.match(monitor, /10 dakika/);
  const modal = renderToStaticMarkup(React.createElement(CancelWaitModal, { activity, onClose() {}, onConfirm: async () => ({ success: true }) }));
  assert.match(modal, /Windows kaldırma işlemini durdurmaz/);
  assert.match(modal, /temizlik açılmaz/);
  assert.ok(!modal.includes('<script>'));
  const pending = renderToStaticMarkup(React.createElement(UninstallMonitor, { activity: { ...activity, awaitingResult: false }, onStopWait() {} }));
  assert.match(pending, /yeni kaldırma, yenileme ve temizlik engellendi/);
  assert.ok(!pending.includes('<button'));
});
test('installed/reinstalled programs are never treated as removable leftovers', async () => {
  let installed = false;
  const sandbox = createMainSandbox(path.join(fixtureRoot, 'reinstall'), async script => {
    if (script.includes('$hives')) return JSON.stringify([appRecord]);
    if (script.includes("'INSTALLED'")) return installed ? 'INSTALLED' : 'REMOVED';
    return 'MISSING';
  });
  const target = path.join(sandbox.roots[0], 'ExampleApp'); fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, 'keep.txt'), 'user data fixture');
  const listed = await sandbox.handlers.get('programs:get-installed')!();
  const id = listed.programs[0].id;
  assert.equal((await sandbox.handlers.get('leftovers:scan')!(null, { appId: id })).success, false);
  await uninstallListed(sandbox, listed.programs[0]);
  const scan = await sandbox.handlers.get('leftovers:scan')!(null, { appId: id, options: { scanRegistry: false } });
  assert.equal(scan.success, true);
  installed = true;
  const deletion = await sandbox.handlers.get('leftovers:delete')!(null, { items: scan.items });
  assert.equal(deletion.success, false);
  assert.match(deletion.error, /yeniden kurulmuş/);
  assert.equal(fs.readFileSync(path.join(target, 'keep.txt'), 'utf8'), 'user data fixture');
  assert.equal(fs.existsSync(sandbox.backupRoot), false);
});
test('refresh invalidates old confirmation and previously granted cleanup permission', async () => {
  const sandbox = createMainSandbox(path.join(fixtureRoot, 'refresh-auth'), async script => script.includes('$hives') ? JSON.stringify([appRecord]) : 'REMOVED');
  const old = (await sandbox.handlers.get('programs:get-installed')!()).programs[0];
  await uninstallListed(sandbox, old);
  const fresh = (await sandbox.handlers.get('programs:get-installed')!()).programs[0];
  assert.equal(old.id, fresh.id);
  assert.notEqual(old.revision, fresh.revision);
  assert.equal((await uninstallListed(sandbox, old)).success, false);
  assert.equal((await sandbox.handlers.get('leftovers:scan')!(null, { appId: old.id })).success, false);
});
test('Registry export failure protects the key; successful fixture export precedes fixture deletion', async () => {
  for (const success of [false, true]) {
    const calls: string[] = [];
    const sandbox = createMainSandbox(path.join(fixtureRoot, 'registry-export-' + success), async script => {
      if (script.includes('$hives')) return JSON.stringify([appRecord]);
      return script.includes("'INSTALLED'") ? 'REMOVED' : 'EXISTS';
    }, undefined, async args => {
      calls.push(args[0]);
      if (args[0] === 'export') {
        if (!success) throw new Error('Export fixture denied');
        assert.ok(path.resolve(args[2]).startsWith(fixtureRoot + path.sep));
        fs.writeFileSync(args[2], 'Windows Registry Editor Version 5.00\r\n\r\n[HKEY_CURRENT_USER\\Software\\ExampleApp]\r\n"Value"="fixture"\r\n');
      }
      return '';
    });
    const p = (await sandbox.handlers.get('programs:get-installed')!()).programs[0];
    await uninstallListed(sandbox, p);
    const scan = await sandbox.handlers.get('leftovers:scan')!(null, { appId: p.id, options: { scanAppData: false } });
    if (success) {
      const deletion = await sandbox.handlers.get('leftovers:delete')!(null, { items: [scan.items[0]] });
      assert.equal(deletion.success, true, JSON.stringify(deletion));
      assert.ok(calls.slice(0, -1).every(call => call === 'export'));
      assert.ok(calls.length >= 4); assert.equal(calls.at(-1), 'delete');
    } else { assert.equal(scan.items.length, 0); assert.equal(scan.success, false); assert.ok(!calls.includes('delete')); }
  }
});
test('log rotation stays in the isolated profile and preserves the previous file', async () => {
  const sandbox = createMainSandbox(path.join(fixtureRoot, 'log-rotation'), async () => JSON.stringify(inventoryEnvelope([])));
  fs.mkdirSync(path.dirname(sandbox.logFile), { recursive: true });
  fs.writeFileSync(sandbox.logFile, 'x'.repeat(5 * 1024 * 1024 + 1));
  await sandbox.handlers.get('programs:get-installed')!();
  assert.equal(fs.statSync(sandbox.logFile + '.old').size, 5 * 1024 * 1024 + 1);
  assert.match(fs.readFileSync(sandbox.logFile, 'utf8'), /Program listesi yüklendi/);
});

test('every IPC request rejects unknown fields, wrong types, excess arguments and oversized arrays', () => {
  assert.equal(validIPC('programs:uninstall', [{ appId: 'app', options: { expectedRevision: 'revision', silent: false } }]), true);
  for (const payload of [null, [], {}, { appId: 3 }, { appId: 'app', options: { expectedRevision: 'rev', silent: 'true' } }, { appId: 'app', options: { expectedRevision: 'rev' }, command: 'inject' }]) assert.equal(validIPC('programs:uninstall', [payload]), false);
  assert.equal(validIPC('leftovers:delete', [{ items: [{ id: 'one', path: 'C:\\Windows' }] }]), false);
  assert.equal(validIPC('leftovers:delete', [{ items: Array.from({ length: 501 }, () => ({ id: 'one' })) }]), false);
  assert.equal(validIPC('programs:get-installed', [{}]), false);
  assert.equal(validIPC('system:create-restore-point', [{ description: 'a'.repeat(201) }]), false);
  assert.equal(validIPC('leftovers:scan', [{ appId: 'a', options: { scanRegistry: 1 } }]), false);
});

test('all main handlers reject foreign senders before changing state or invoking subprocesses', async () => {
  let calls = 0;
  const sandbox = createMainSandbox(path.join(fixtureRoot, 'ipc-all-guards'), async () => { calls++; return ''; });
  await sandbox.ready;
  const sender = { sender: {}, senderFrame: { url: 'https://evil.example/' } };
  const payloads: Record<string, any[]> = {
    'programs:get-installed': [], 'app:get-system-info': [], 'logs:open-folder': [], 'backups:list': [],
    'programs:uninstall': [{ appId: 'app', options: { expectedRevision: 'rev' } }],
    'leftovers:scan': [{ appId: 'app' }], 'leftovers:delete': [{ items: [] }],
    'backups:restore': [{ id: '00000000-0000-0000-0000-000000000000' }],
    'system:create-restore-point': [{}], 'programs:get-icon': [{ appId: 'app', revision: 'rev' }],
    'programs:get-uninstall-activity': [], 'programs:cancel-uninstall-wait': [{ operationId: '00000000-0000-0000-0000-000000000000' }],
    'logs:renderer-error': [{ kind: 'error', message: 'foreign' }]
  };
  assert.equal(sandbox.rawHandlers.size, Object.keys(payloads).length);
  for (const [channel, args] of Object.entries(payloads)) {
    try { const result = await sandbox.rawHandlers.get(channel)!(sender, ...args); assert.notEqual(result.success, true, channel); }
    catch (error) { assert.match(String(error), /Geçersiz/); }
  }
  assert.equal(calls, 0); assert.equal(fs.existsSync(sandbox.backupRoot), false);
});

test('window security denies navigation, redirects, webviews, popups and permissions', () => {
  const events = new Map<string, any>(); let popup: any, permission: any, check: any;
  secureWindow({ webContents: { on: (name: string, cb: any) => events.set(name, cb), setWindowOpenHandler: (cb: any) => { popup = cb; }, session: {
    setPermissionRequestHandler: (cb: any) => { permission = cb; }, setPermissionCheckHandler: (cb: any) => { check = cb; }
  } } });
  for (const event of ['will-navigate', 'will-frame-navigate', 'will-redirect', 'will-attach-webview']) { let denied = false; events.get(event)({ preventDefault: () => { denied = true; } }); assert.equal(denied, true); }
  assert.equal(popup().action, 'deny'); permission(null, 'camera', (allowed: boolean) => assert.equal(allowed, false)); assert.equal(check(), false);
  assert.ok(fs.readFileSync('electron/main.ts', 'utf8').includes('sandbox: true'));
  assert.ok(fs.readFileSync('index.html', 'utf8').includes("script-src 'self'"));
  assert.ok(!fs.readFileSync('index.html', 'utf8').includes('<script>'));
});

test('uninstall commands are parsed as executable/arguments without shell interpretation', () => {
  assert.deepEqual(parseUninstallCommand('"C:\\Program Files\\Example\\uninstall.exe" /S "arg with spaces"', {}), { executable: 'C:\\Program Files\\Example\\uninstall.exe', args: ['/S', 'arg with spaces'] });
  assert.equal(parseUninstallCommand('C:\\Program Files\\Example\\uninstall.exe /S', {}).executable, 'C:\\Program Files\\Example\\uninstall.exe');
  assert.deepEqual(parseUninstallCommand('msiexec.exe /X{GUID} /qn', { WINDIR: 'C:\\Windows' }), { executable: 'C:\\Windows\\System32\\msiexec.exe', args: ['/X{GUID}', '/qn'] });
  for (const value of ['cmd.exe /c erase', 'C:\\Windows\\System32\\powershell.exe evil', '\\\\server\\share\\app.exe', 'relative.exe', 'C:\\test.cmd', '"C:\\app.exe']) assert.throws(() => parseUninstallCommand(value, {}));
});

async function cleanedFixture(name: string) {
  let installed = false;
  const directory = path.join(fixtureRoot, name);
  const powershell = async (script: string) => script.includes('$hives') ? JSON.stringify([appRecord]) : installed ? 'INSTALLED' : 'REMOVED';
  const sandbox = createMainSandbox(directory, powershell);
  const target = path.join(sandbox.roots[0], 'ExampleApp');
  fs.mkdirSync(target); fs.writeFileSync(path.join(target, 'data.txt'), 'recover this');
  const app = (await sandbox.handlers.get('programs:get-installed')!()).programs[0];
  await uninstallListed(sandbox, app);
  const scan = await sandbox.handlers.get('leftovers:scan')!(null, { appId: app.id, options: { scanRegistry: false } });
  const clean = async () => sandbox.handlers.get('leftovers:delete')!(null, { items: scan.items });
  return { sandbox, target, clean, directory, powershell, setInstalled: (value: boolean) => { installed = value; } };
}

test('cleanup journal restores from a fresh session and keeps its backup, with no replay', async () => {
  const fixture = await cleanedFixture('recovery-success');
  assert.equal((await fixture.clean()).success, true);
  const fresh = createMainSandbox(fixture.directory, fixture.powershell);
  const entries = (await fresh.handlers.get('backups:list')!()).entries;
  assert.equal(entries.length, 1); assert.equal(entries[0].state, 'completed');
  const restored = await fresh.handlers.get('backups:restore')!(fresh.event, { id: entries[0].id });
  assert.equal(restored.success, true, restored.error);
  assert.equal(fs.readFileSync(path.join(fixture.target, 'data.txt'), 'utf8'), 'recover this');
  assert.equal(fs.existsSync(path.join(fresh.backupRoot, entries[0].id, 'payload', 'data.txt')), true);
  assert.equal((await fresh.handlers.get('backups:restore')!(fresh.event, { id: entries[0].id })).success, false);
});

test('restore refuses existing targets, reinstalled apps and modified backups without erasing either', async () => {
  const fixture = await cleanedFixture('recovery-protection'); await fixture.clean();
  const entry = (await fixture.sandbox.handlers.get('backups:list')!()).entries[0];
  const restore = () => fixture.sandbox.handlers.get('backups:restore')!(fixture.sandbox.event, { id: entry.id });
  fixture.setInstalled(true); assert.equal((await restore()).success, false); fixture.setInstalled(false);
  fs.mkdirSync(fixture.target); fs.writeFileSync(path.join(fixture.target, 'new.txt'), 'new data');
  assert.equal((await restore()).success, false);
  assert.equal(fs.readFileSync(path.join(fixture.target, 'new.txt'), 'utf8'), 'new data');
  const store = new CleanupBackups(fixture.sandbox.backupRoot), record = store.read(entry.id);
  fs.writeFileSync(path.join(store.payload(record), 'data.txt'), 'tampered');
  assert.throws(() => store.verify(record), /değişmiş/);
});

test('scan-time file identity protects changed targets and ambiguous/shared names', async () => {
  const fixture = await cleanedFixture('changed-after-scan');
  fs.writeFileSync(path.join(fixture.target, 'data.txt'), 'changed after scan');
  const result = await fixture.clean(); assert.equal(result.success, false); assert.equal(result.deletedCount, 0);
  assert.equal(fs.readFileSync(path.join(fixture.target, 'data.txt'), 'utf8'), 'changed after scan');
  for (const name of ['Microsoft', 'Windows', 'Packages', 'Temp', 'Cache']) assert.equal(isSafeName(name), false);
  const sandbox = createMainSandbox(path.join(fixtureRoot, 'ambiguous-name'), async script => script.includes('$hives') ? JSON.stringify([appRecord, { ...appRecord, registryKey: appRecord.registryKey + '2' }]) : 'REMOVED');
  fs.mkdirSync(path.join(sandbox.roots[0], 'ExampleApp'));
  const programs = (await sandbox.handlers.get('programs:get-installed')!()).programs;
  await uninstallListed(sandbox, programs[0]);
  const scan = await sandbox.handlers.get('leftovers:scan')!(null, { appId: programs[0].id, options: { scanRegistry: false } });
  assert.equal(scan.items.length, 0); assert.equal(scan.success, false);
});

test('prepared/interrupted journal can be listed, while unsafe Registry exports cannot be imported', async () => {
  const fixture = await cleanedFixture('interrupted-journal'); await fixture.clean();
  const store = new CleanupBackups(fixture.sandbox.backupRoot), entry = store.list().entries[0], record = store.read(entry.id);
  store.save({ ...record, state: 'prepared' });
  const fresh = new CleanupBackups(fixture.sandbox.backupRoot);
  assert.equal(fresh.list().entries[0].state, 'prepared'); fresh.verify(fresh.read(entry.id));
  const key = 'HKCU\\Software\\ExampleApp';
  assert.ok(validateRegBackup(Buffer.from('Windows Registry Editor Version 5.00\r\n[HKEY_CURRENT_USER\\Software\\ExampleApp]\r\n"Value"="fixture"'), key));
  for (const body of ['[HKEY_LOCAL_MACHINE\\Software\\Microsoft]', ' [-HKEY_CURRENT_USER\\Software\\ExampleApp]', '[HKEY_CURRENT_USER\\Software\\Other]']) assert.throws(() => validateRegBackup(Buffer.from('Windows Registry Editor Version 5.00\r\n' + body), key));
});

test('Registry recovery validates scope and hash, refuses existing keys and imports only a fixture', async () => {
  let exists = true, imports = 0;
  const sandbox = createMainSandbox(path.join(fixtureRoot, 'registry-recovery'), async script => script.includes('$hives') ? JSON.stringify([appRecord]) : script.includes("'INSTALLED'") ? 'REMOVED' : exists ? 'EXISTS' : 'MISSING', undefined, async args => { assert.equal(args[0], 'import'); imports++; return ''; });
  const program = (await sandbox.handlers.get('programs:get-installed')!()).programs[0];
  const store = new CleanupBackups(sandbox.backupRoot);
  const record = store.prepare({ id: 'fixture', type: 'registry_key', path: 'HKCU\\Software\\ExampleApp', targetScope: 'HKCU\\Software', selected: false }, program);
  const bytes = Buffer.from('Windows Registry Editor Version 5.00\r\n[HKEY_CURRENT_USER\\Software\\ExampleApp]\r\n"Value"="fixture"');
  fs.writeFileSync(store.payload(record), bytes); record.digest = validateRegBackup(bytes, record.originalPath); record.state = 'completed'; store.save(record);
  const restore = () => sandbox.handlers.get('backups:restore')!(sandbox.event, { id: record.id });
  assert.equal((await restore()).success, false); assert.equal(imports, 0);
  exists = false; assert.equal((await restore()).success, true); assert.equal(imports, 1);
  assert.equal(store.read(record.id).state, 'restored'); assert.equal(fs.existsSync(store.payload(record)), true);
});

test('unsafe backup destination and junction substitution fail closed', async () => {
  const fixture = await cleanedFixture('recovery-unsafe'); await fixture.clean();
  const store = new CleanupBackups(fixture.sandbox.backupRoot), record = store.read(store.list().entries[0].id);
  store.save({ ...record, originalPath: path.join(fixture.sandbox.roots[0], 'Microsoft') });
  assert.equal((await fixture.sandbox.handlers.get('backups:restore')!(fixture.sandbox.event, { id: record.id })).success, false);
  const outside = path.join(fixtureRoot, 'recovery-link-outside'); fs.mkdirSync(outside);
  const junction = path.join(fixture.sandbox.backupRoot, '00000000-0000-0000-0000-000000000000');
  fs.symlinkSync(outside, junction, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => store.read(path.basename(junction)), /bağlantı/);
  assert.equal(fs.readdirSync(outside).length, 0);
});
