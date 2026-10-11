import { app, BrowserWindow, dialog, ipcMain, Menu, shell, nativeImage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { assertNoLinkedChildren, buildCleanupCandidates, checkCleanupPath, checkCleanupRegistry, isSafeName, treeFingerprint, inspectCleanupTree, parentFingerprint } from './cleanupSafety';
import { randomUUID } from 'node:crypto';
import { getProgramId, getProgramRevision } from './programIdentity';
import { OperationLock } from './operationLock';
import type { IpcMainInvokeEvent } from 'electron';
import { verifyUninstall } from './uninstallVerification';
import { APP_VERSION } from '../src/version';
import { INVENTORY_SCRIPT, parseInventory } from './inventory';
import { createReportLimiter, trustedRenderer, validateRendererReport } from './rendererDiagnostics';
import { findIconFile, IconQueue } from './programIcons';
import { UninstallTask } from './uninstallTask';
import { hasVerifiedRemoval } from '../src/utils/uninstallFlow';
import { validIPC } from './ipcSafety';
import { secureWindow } from './windowSafety';
import { CleanupBackups, noLinks, validateRegBackup, type BackupRecord } from './cleanupBackups';
import { parseUninstallCommand } from './uninstallCommand';
import { UninstallJournal } from './uninstallJournal';
import { cleanupConflict, cleanupTerms, leftoverEvidence } from './cleanupOwnership';
import { RestorePointWait } from './restorePointWait';
import type { 
  InstalledProgram, 
  InstalledProgramsResult, 
  SystemInfo, 
  UninstallOptions, 
  UninstallResult, 
  LeftoverItem, 
  LeftoverScanOptions, 
  LeftoverScanResult, 
  LeftoverDeleteResult, 
  RestorePointResult,
  BackupListResult,
  BackupRestoreResult,
  RegistryHive
} from '../src/types';

const execFileAsync = promisify(execFile);

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

function getLogFilePath(): string {
  const logDirectory = path.join(app.getPath('userData'), 'logs');
  fs.mkdirSync(logDirectory, { recursive: true });
  return path.join(logDirectory, 'sift-uninstaller.log');
}

function writeLog(level: LogLevel, event: string, details?: unknown): boolean {
  try {
    const logFile = getLogFilePath();
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > 5 * 1024 * 1024) {
      const oldLogFile = `${logFile}.old`;
      if (fs.existsSync(oldLogFile)) fs.rmSync(oldLogFile, { force: true });
      fs.renameSync(logFile, oldLogFile);
    }

    const detailText = details === undefined
      ? ''
      : ` | ${typeof details === 'string' ? details : JSON.stringify(details)}`;
    fs.appendFileSync(
      logFile,
      `[${new Date().toISOString()}] [${level}] ${event}${detailText}\r\n`,
      'utf8'
    );
    return true;
  } catch (error) {
    console.error('Log dosyasına yazılamadı:', error);
    return false;
  }
}

process.on('uncaughtException', (error) => {
  writeLog('ERROR', 'Yakalanmamış ana süreç hatası', error.stack || error.message);
});

process.on('unhandledRejection', (reason) => {
  writeLog('ERROR', 'İşlenmemiş Promise hatası', reason instanceof Error ? reason.stack || reason.message : String(reason));
});

/**
 * PowerShell betiğini cmd.exe tırnaklama kurallarına sokmadan çalıştırır.
 * -EncodedCommand UTF-16LE beklediği için betik bu biçimde kodlanır.
 */
async function runPowerShell(script: string, maxBuffer = 32 * 1024 * 1024, timeout?: number) {
  const encodedScript = Buffer.from(script, 'utf16le').toString('base64');
  return execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodedScript],
    { windowsHide: true, maxBuffer, encoding: 'utf8', timeout }
  );
}

function toPowerShellLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

// Güvenlik: Renderer tarafından rastgele shell komutları çalıştırılmasını engellemek için,
// Registry'den okunan meşru uygulamalar ana süreç hafızasında saklanır.
const cachedProgramsMap = new Map<string, InstalledProgram>();
const iconCache = new Map<string, Promise<{ dataUrl?: string }>>();
const iconQueue = new IconQueue();
// Renderer yalnızca burada üretilen adayların kimliklerini gönderebilir.
const cachedLeftoversMap = new Map<string, LeftoverItem>();
const targetSnapshots = new Map<string, { tree: string; parent?: string }>();
const verifiedRemovals = new Map<string, InstalledProgram>();
let cleanupSession: { program: InstalledProgram; scanId: string } | null = null;
const operationLock = new OperationLock();
const uninstallJournal = new UninstallJournal(path.join(app.getPath('userData'), 'uninstall-tracking.json'), readProcessToken, isProgramStillInstalled);
const uninstallTask = new UninstallTask(undefined, undefined, activity => {
  if (activity.active) {
    try { uninstallJournal.finish(activity.operationId); }
    catch (error) { writeLog('ERROR', 'Kaldırma takip kaydı tamamlanamadı', String(error)); }
    if (activity.stopReason) writeLog('WARN', 'Beklemesi bırakılan kaldırıcı/doğrulama takibi sona erdi; temizlik izni verilmedi', activity);
  }
});
function uninstallActivity() { return uninstallTask.activity.active ? uninstallTask.activity : uninstallJournal.activity; }

function handleExclusive<T>(channel: string, failure: (error: string) => T,
  handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<T>): void {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!trustedRenderer(event, mainWindow, rendererURL) || !validIPC(channel, args)) return failure('Geçersiz veya yetkisiz işlem isteği.');
    if (uninstallActivity().active) return failure('Önceki kaldırıcı veya doğrulama hâlâ takip ediliyor. Windows kaldırma penceresinden işlemi tamamlayın veya iptal edin.');
    const release = operationLock.acquire(channel);
    if (!release) return failure('Başka bir işlem sürüyor. Tamamlanmasını bekleyin.');
    try { return await handler(event, ...args); }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeLog('ERROR', channel, message);
      return failure(message);
    } finally { release(); }
  });
}

function invalidateCleanup(): void {
  cachedLeftoversMap.clear();
  targetSnapshots.clear();
  cleanupSession = null;
}

function authorizeCleanup(program: InstalledProgram, result: UninstallResult): UninstallResult {
  if (hasVerifiedRemoval(result) && !result.rebootRequired) {
    verifiedRemovals.set(program.id, { ...program });
  }
  return result;
}

async function assertCleanupAllowed(program: InstalledProgram): Promise<void> {
  if (verifiedRemovals.get(program.id)?.revision !== program.revision) {
    throw new Error('Temizlik yalnızca bu oturumda kaldırıldığı doğrulanan program için yapılabilir.');
  }
  if (await isProgramStillInstalled(program)) {
    verifiedRemovals.delete(program.id);
    invalidateCleanup();
    throw new Error('Program kurulu veya yeniden kurulmuş. Kullanılan verileri korumak için temizlik engellendi.');
  }
}

let mainWindow: BrowserWindow | null = null;
let rendererURL = '';

function createWindow() {
  mainWindow = new BrowserWindow({
    show: false,
    width: 1200,
    height: 820,
    minWidth: 900,
    minHeight: 650,
    title: 'Sift Uninstaller',
    icon: app.isPackaged ? path.join(process.resourcesPath, 'icon.ico') : path.join(__dirname, '../build/icon.ico'),
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false
    }
  });

  secureWindow(mainWindow);

  // Geliştirmede script Vite'ı önce başlatır; paketli sürüm yalnızca dist'i açar.
  const useDevServer = !app.isPackaged && process.env.SIFT_DEV_SERVER === '1';
  if (useDevServer) {
    const developmentURL = new URL(process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:3000');
    if (developmentURL.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(developmentURL.hostname) || developmentURL.port !== '3000' || developmentURL.username || developmentURL.password || developmentURL.pathname !== '/' || developmentURL.search || developmentURL.hash) throw new Error('Geliştirme yalnızca güvenilen yerel 3000 portundan açılır.');
    rendererURL = developmentURL.href;
    mainWindow.loadURL(rendererURL);
    if (process.env.SIFT_OPEN_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    rendererURL = pathToFileURL(path.join(__dirname, '../dist/index.html')).href;
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    writeLog('ERROR', 'Arayüz yüklenemedi', { errorCode, errorDescription, url: validatedURL.split(/[?#]/)[0] });
    console.error(`Renderer yüklenemedi (${errorCode}): ${errorDescription} - ${validatedURL}`);
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    writeLog('ERROR', 'Arayüz işlemi kapandı', { reason: details.reason, exitCode: details.exitCode });
  });
  // Module/MIME failures can occur before the renderer error listeners exist.
  mainWindow.webContents.on('console-message', details => {
    if (details.level !== 'error') return;
    const report = validateRendererReport({ kind: 'error', message: details.message.slice(0, 4000) });
    if (report && acceptReport()) writeLog('ERROR', 'Arayüz konsol hatası', report);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  const window = mainWindow;
  let closeConfirmed = false, closePromptPending = false;
  window.on('close', event => {
    if (!uninstallActivity().active || closeConfirmed) return;
    event.preventDefault();
    if (closePromptPending) return;
    closePromptPending = true;
    void dialog.showMessageBox(window, { type: 'warning', title: 'Kaldırıcı Takibi Sürüyor',
      message: 'Sift kapatılsın mı?',
      detail: 'Kapatmak Windows kaldırıcısını durdurmaz. Yeniden açılışta kayıtlı süreç kimliği kontrol edilir; bağımsız alt süreçler takip edilemeyebilir. Temizlik otomatik açılmaz. Önce Windows kaldırma penceresinde işlemi tamamlamanız veya iptal etmeniz önerilir.',
      buttons: ['Açık tut', 'Sift’i kapat'], defaultId: 0, cancelId: 0, noLink: true
    }).then(({ response }) => {
      if (response === 1 && !window.isDestroyed()) { closeConfirmed = true; window.close(); }
    }).catch(error => writeLog('ERROR', 'Kapatma onayı gösterilemedi', String(error)))
      .finally(() => { closePromptPending = false; });
  });
}

// ---------------------------------------------------------------------------
// GÜVENLİK VE SİSTEM YARDIMCI FONKSİYONLARI
// ---------------------------------------------------------------------------

async function checkIsElevated(): Promise<boolean> {
  if (process.platform !== 'win32') {
    return false;
  }
  try {
    const { stdout } = await runPowerShell(`
      $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
      $principal = [Security.Principal.WindowsPrincipal]::new($identity)
      $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    `, 1024 * 1024);
    return stdout.trim().toLowerCase() === 'true';
  } catch {
    return false;
  }
}

async function relaunchAsAdministrator(): Promise<boolean> {
  try {
    await runPowerShell(
      `Start-Process -FilePath ${toPowerShellLiteral(process.execPath)} -Verb RunAs -ErrorAction Stop`,
      1024 * 1024
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Yıkıcı silme işlemlerinde sistem kök dizinlerinin veya geniş klasörlerin
 * kazara silinmesini engelleyen katı güvenlik filtresi (Whitelisting / Blacklisting)
 */
function getCleanupRoots(): string[] {
  return [process.env.APPDATA, process.env.LOCALAPPDATA, process.env.PROGRAMDATA || process.env.ALLUSERSPROFILE]
    .filter((value): value is string => Boolean(value));
}

function isPathSafeToDelete(targetPath: string, scopeRoot?: string) {
  const relative = path.relative(app.getPath('userData'), path.resolve(targetPath));
  if (!relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))) return { safe: false, reason: 'Sift verileri ve yedekleri korunuyor.' };
  return checkCleanupPath(targetPath, scopeRoot ? [scopeRoot] : getCleanupRoots(), process.env.WINDIR);
}

function isRegistryKeySafeToDelete(regKey: string) {
  return checkCleanupRegistry(regKey);
}

const backups = () => new CleanupBackups(path.join(app.getPath('userData'), 'cleanup-backups'));
function candidateTerms(program: InstalledProgram) {
  return cleanupTerms(program).filter(isSafeName).filter(term => term.toLowerCase() !== program.publisher?.trim().toLowerCase());
}
async function currentOwnershipPrograms(): Promise<InstalledProgram[]> {
  const { stdout } = await runPowerShell(INVENTORY_SCRIPT, 32 * 1024 * 1024, 30000);
  const inventory = parseInventory(stdout);
  if (inventory.sources.some(source => source.status === 'error')) throw new Error('Kurulu programların tüm kaynakları doğrulanamadı; veri sahipliği kontrolü için temizlik/geri alma engellendi.');
  return inventory.programs.map(item => ({ ...item, id: getProgramId(item), registryHive: item.hive } as InstalledProgram));
}
function assertOwnership(target: string, program: InstalledProgram, installed: InstalledProgram[]) {
  const term = target.split(/[\\/]/).at(-1) || '';
  const reason = cleanupConflict(target, term, program, installed);
  if (reason) throw new Error(reason);
}
async function registryDigest(key: string) {
  const directory = path.join(app.getPath('userData'), 'scan-checks');
  noLinks(directory); fs.mkdirSync(directory, { recursive: true });
  const temporary = path.join(directory, randomUUID() + '.reg');
  try {
    await execFileAsync('reg.exe', ['export', key, temporary, '/y'], { windowsHide: true, timeout: 10000 });
    noLinks(temporary);
    return validateRegBackup(fs.readFileSync(temporary), key);
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}

function assertBackupTarget(record: BackupRecord) {
  if (getProgramId(record.program) !== record.program.id) throw new Error('Yedek program kimliği geçersiz.');
  const terms = candidateTerms(record.program), publisher = record.program.publisher?.trim() || '';
  if (record.type === 'registry_key') {
    const candidates = ['HKCU\\Software', 'HKLM\\SOFTWARE'].flatMap(root => terms.flatMap(term => [root + '\\' + term, ...(isSafeName(publisher) ? [root + '\\' + publisher + '\\' + term] : [])]));
    if (!isRegistryKeySafeToDelete(record.originalPath).safe || !candidates.some(key => key.toLowerCase() === record.originalPath.toLowerCase())) throw new Error('Registry yedeğinin hedefi doğrulanamadı.');
  } else if (!isPathSafeToDelete(record.originalPath).safe || !getCleanupRoots().flatMap(root => buildCleanupCandidates(root, terms, publisher)).some(file => path.resolve(file).toLowerCase() === path.resolve(record.originalPath).toLowerCase())) {
    throw new Error('Dosya yedeğinin hedefi doğrulanamadı.');
  }
}

// ---------------------------------------------------------------------------
// IPC HANDLERS
// ---------------------------------------------------------------------------

const acceptReport = createReportLimiter();
ipcMain.handle('programs:get-uninstall-activity', async (event, ...args) => {
  if (!trustedRenderer(event, mainWindow, rendererURL) || !validIPC('programs:get-uninstall-activity', args)) throw new Error('Geçersiz kaldırma durumu isteği.');
  return uninstallTask.activity.active ? uninstallTask.activity : uninstallJournal.poll();
});
ipcMain.handle('programs:cancel-uninstall-wait', (event, ...args) => {
  const input = args[0];
  if (!trustedRenderer(event, mainWindow, rendererURL) || !validIPC('programs:cancel-uninstall-wait', args)) return { success: false, error: 'Geçersiz iptal isteği.' };
  const activity = uninstallTask.activity;
  if (uninstallJournal.activity.active) {
    try {
      const result = uninstallJournal.acknowledge(input.operationId);
      if (result.success) { verifiedRemovals.clear(); invalidateCleanup(); writeLog('WARN', 'Önceki takip açık onayla kapatıldı; temizlik verilmedi'); }
      return result;
    } catch (error) { return { success: false, error: String(error) }; }
  }
  const result = uninstallTask.cancel(input.operationId);
  if (result.success) writeLog('WARN', 'Kullanıcı Sift beklemesini iptal etti; Windows işlemi öldürülmedi', activity);
  return result;
});
ipcMain.handle('logs:renderer-error', (event, ...args) => {
  const input = args[0];
  if (!trustedRenderer(event, mainWindow, rendererURL) || !validIPC('logs:renderer-error', args)) return { success: false };
  const report = validateRendererReport(input);
  if (!report || !acceptReport()) return { success: false };
  return { success: writeLog('ERROR', 'Arayüz hatası', report) };
});

ipcMain.handle('programs:get-icon', async (event, ...args) => {
  const input = args[0];
  if (!trustedRenderer(event, mainWindow, rendererURL) || !validIPC('programs:get-icon', args)) return {};
  const program = cachedProgramsMap.get(input.appId);
  if (!program || program.revision !== input.revision) return {};
  const key = program.id + ':' + program.revision;
  if (!iconCache.has(key)) iconCache.set(key, iconQueue.run(async () => {
    try {
      // Refreshing the inventory invalidates queued requests too.
      if (cachedProgramsMap.get(program.id)?.revision !== program.revision) return {};
      const file = findIconFile(program);
      if (!file) return {};
      const image = /\.(png|ico)$/i.test(file) ? nativeImage.createFromPath(file) : await app.getFileIcon(file, { size: 'small' });
      if (image.isEmpty()) return {};
      const dataUrl = image.resize({ width: 32, height: 32 }).toDataURL();
      return dataUrl.startsWith('data:image/png;base64,') && dataUrl.length <= 128 * 1024 ? { dataUrl } : {};
    } catch (error) {
      writeLog('WARN', 'Program simgesi okunamadı', { app: program.displayName, error: String(error) });
      return {};
    }
  }));
  return iconCache.get(key);
});

// 1. Sistem ve Yetki Durumu
ipcMain.handle('app:get-system-info', async (event, ...args): Promise<SystemInfo> => {
  if (!trustedRenderer(event, mainWindow, rendererURL) || !validIPC('app:get-system-info', args)) throw new Error('Geçersiz sistem bilgisi isteği.');
  const isWindows = process.platform === 'win32';
  const isElevated = await checkIsElevated();
  return {
    isWindows,
    isElevated,
    platform: process.platform,
    osVersion: process.getSystemVersion ? process.getSystemVersion() : undefined
  };
});

// 2. Gerçek Kurulu Program Listesini Windows Registry'den Oku
handleExclusive<InstalledProgramsResult>('programs:get-installed', error => ({ success: false, programs: [], error }), async (): Promise<InstalledProgramsResult> => {
  cachedProgramsMap.clear();
  iconCache.clear();
  verifiedRemovals.clear();
  invalidateCleanup();
  if (process.platform !== 'win32') {
    return {
      success: false,
      programs: [],
      error: 'Windows Registry taraması yalnızca Windows işletim sisteminde kullanılabilir.'
    };
  }

  try {
    // Registry programlarını, Windows sistem bileşenlerini ve mevcut kullanıcının
    // kaldırılabilir MSIX/AppX paketlerini tek doğrulanmış listede topluyoruz.
    const { stdout } = await runPowerShell(INVENTORY_SCRIPT);
    const inventory = parseInventory(stdout);
    const arrayList = inventory.programs;
    const failedSources = inventory.sources.filter(source => source.status === 'error');
    const partial = failedSources.length > 0;
    const available = inventory.sources.some(source => source.status !== 'error');
    for (const source of failedSources) writeLog('ERROR', 'Program tarama kaynağı okunamadı', source);
    for (const warning of inventory.warnings) writeLog('WARN', 'Program bilgisi uyarısı', warning);
    if (!available) return { success: false, programs: [], sources: inventory.sources, partial: true,
      warnings: inventory.warnings, error: 'Hiçbir program kaynağı okunamadı.' };

    cachedProgramsMap.clear();

    const inventoryRevision = randomUUID();
    const programs: InstalledProgram[] = arrayList.map((item) => {
      const id = getProgramId(item);
      
      const sizeBytes = (item.estimatedSize || 0) * 1024;
      const sizeFormatted = sizeBytes > 0
        ? (sizeBytes >= 1024 * 1024 * 1024
            ? `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
            : `${Math.round(sizeBytes / (1024 * 1024))} MB`)
        : 'Belirtilmemiş';

      const program: InstalledProgram = {
        id,
        revision: '',
        displayName: item.displayName,
        displayVersion: item.displayVersion || undefined,
        publisher: item.publisher || 'Bilinmeyen Yayıncı',
        estimatedSize: item.estimatedSize || 0,
        sizeFormatted,
        uninstallString: item.uninstallString || '',
        quietUninstallString: item.quietUninstallString || '',
        registryKey: item.registryKey || '',
        registryHive: (item.hive as RegistryHive) || 'HKLM',
        displayIcon: item.displayIcon || undefined,
        installDate: item.installDate || undefined,
        installLocation: item.installLocation || undefined,
        isSystemComponent: Boolean(item.isSystemComponent),
        category: item.category === 'store' || item.category === 'system' ? item.category : 'desktop',
        packageFullName: item.packageFullName || undefined,
        packageName: item.packageName || undefined
      };

      program.revision = getProgramRevision(program) + ':' + inventoryRevision;
      return program;
    });
    for (const program of programs) {
      if (cachedProgramsMap.has(program.id)) throw new Error('Tekrarlanan program kimliği bulundu; listeyi yeniden tarayın.');
      cachedProgramsMap.set(program.id, program);
    }

    writeLog('INFO', 'Program listesi yüklendi', {
      total: programs.length,
      desktop: programs.filter((program) => program.category === 'desktop').length,
      store: programs.filter((program) => program.category === 'store').length,
      system: programs.filter((program) => program.category === 'system').length
    });

    return { success: true, programs, sources: inventory.sources, partial, warnings: inventory.warnings };
  } catch (err: unknown) {
    cachedProgramsMap.clear();
    const message = err instanceof Error ? err.message : String(err);
    writeLog('ERROR', 'Kayıt defteri taraması başarısız', message);
    return {
      success: false,
      programs: [],
      error: `Kayıt defteri okunamadı: ${message}`
    };
  }
});

// 3. Gerçek Kaldırma İşlemi (Güvenli, doğrulanmış ve asenkron çıkış takibi)
async function isProgramStillInstalled(program: InstalledProgram): Promise<boolean> {
  let script: string;
  if (program.category === 'store') {
    if (!program.packageName) throw new Error('Store doğrulaması için teknik paket adı eksik.');
    script = `$ErrorActionPreference = 'Stop'; $packages = @(Get-AppxPackage -Name ${toPowerShellLiteral(program.packageName)} -ErrorAction Stop); if ($packages.Count -gt 0) { 'INSTALLED' } else { 'REMOVED' }`;
  } else {
    if (!program.registryKey) throw new Error('Kaldırma doğrulaması için Registry anahtarı bulunamadı.');
    const key = `Registry::${program.registryKey}`;
    script = `$ErrorActionPreference = 'Stop'; if (Test-Path -LiteralPath ${toPowerShellLiteral(key)} -ErrorAction Stop) { 'INSTALLED' } else { 'REMOVED' }`;
  }
  const { stdout } = await runPowerShell(script, 1024 * 1024, 10000);
  if (stdout.trim() === 'INSTALLED') return true;
  if (stdout.trim() === 'REMOVED') return false;
  throw new Error('Windows kaldırma doğrulaması beklenen sonucu döndürmedi.');
}

async function runTrackedUninstall(program: InstalledProgram, launch: () => ReturnType<typeof spawn>): Promise<UninstallResult> {
  const operationId = uninstallJournal.begin(program);
  const result = await uninstallTask.run({ appId: program.id, appName: program.displayName, operationId }, () => {
    const child = launch();
    void uninstallJournal.attach(operationId, child.pid).catch(error => writeLog('ERROR', 'Kaldırıcı süreç kimliği kaydedilemedi', String(error)));
    return child;
  },
    (code, stopped) => verifyUninstall(() => isProgramStillInstalled(program), code, 12, undefined, stopped));
  writeLog(result.cancelled || result.timedOut ? 'WARN' : result.verified ? 'INFO' : 'ERROR',
    'Program kaldırma takip sonucu', { app: program.displayName, ...result });
  return authorizeCleanup(program, result);
}
async function readProcessToken(pid: number): Promise<string | null> {
  if (!Number.isInteger(pid) || pid <= 0 || pid > 2147483647) throw new Error('Geçersiz süreç kimliği.');
  const script = `$ErrorActionPreference='Stop'; try { $siftProcess=Get-Process -Id ${pid} -ErrorAction Stop } catch { if ($_.FullyQualifiedErrorId -notlike 'NoProcessFoundForGivenId*') { throw }; 'SIFT_PROCESS_MISSING'; return }; $siftProcess.StartTime.ToUniversalTime().Ticks.ToString() + ':' + $siftProcess.ProcessName`;
  const { stdout } = await runPowerShell(script, 1024 * 1024, 10000);
  const token = stdout.trim();
  if (token === 'SIFT_PROCESS_MISSING') return null;
  if (!/^\d{16,19}:[^\x00-\x1f]{1,200}$/.test(token)) throw new Error('Süreç başlangıç kimliği okunamadı.');
  return token;
}

handleExclusive<UninstallResult>('programs:uninstall', error => ({ success: false, error }), async (_event, args: { appId: string; options?: UninstallOptions }): Promise<UninstallResult> => {
  const { appId, options } = args;

  // Güvenlik doğrulaması: Uygulama önceden Registry taramasında bulunmuş olmalıdır
  const program = cachedProgramsMap.get(appId);
  if (!program) {
    return {
      success: false,
      error: 'Güvenlik ihlali: Kaldırılmak istenen uygulama doğrulanmış Registry listesinde bulunamadı.'
    };
  }
  if (!options?.expectedRevision || options.expectedRevision !== program.revision) {
    return { success: false, error: 'Program kaydı değişti veya onay güncel değil. Listeyi yenileyip yeniden onaylayın.' };
  }
  verifiedRemovals.delete(appId);
  invalidateCleanup();

  if (program.category === 'store') {
    if (!program.packageFullName) {
      writeLog('ERROR', 'Store uygulaması kaldırılamadı', { appId, error: 'Paket kimliği eksik' });
      return { success: false, error: 'Microsoft Store paket kimliği bulunamadı.' };
    }

    writeLog('INFO', 'Store uygulaması kaldırma işlemi başlatıldı', {
      app: program.displayName,
      packageFullName: program.packageFullName
    });
    const script = `$ErrorActionPreference = 'Stop'; Remove-AppxPackage -Package ${toPowerShellLiteral(program.packageFullName)} -ErrorAction Stop`;
    return runTrackedUninstall(program, () => spawn('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
      { windowsHide: true, stdio: 'ignore' }));
  }

  let commandToRun = (program.uninstallString || program.quietUninstallString || '').trim();
  if (!commandToRun) {
    return {
      success: false,
      error: 'Bu program için kayıtlı bir kaldırma komutu (UninstallString) bulunamadı.'
    };
  }

  const isMsi = /msiexec(\.exe)?/i.test(commandToRun);
  const isInno = /unins\d{3}\.exe/i.test(commandToRun) || /_is1/i.test(program.registryKey);
  const isNsis = /uninstall\.exe/i.test(commandToRun) && !isInno;

  // 1. MSI Komut Dönüştürme: /I{GUID} -> /X{GUID}
  if (isMsi) {
    commandToRun = commandToRun.replace(/\/I\s*\{/gi, '/X{');
    if (!/\/X/i.test(commandToRun)) {
      commandToRun = commandToRun.replace(/msiexec(\.exe)?/i, '$& /X');
    }
    if (options?.silent) {
      commandToRun += ' /qn /norestart';
    }
  } else if (options?.silent) {
    // 2. Yalnızca tanınan yükleyici türlerine sessiz bayrak ekleme
    if (isInno) {
      commandToRun += ' /VERYSILENT /NORESTART';
    } else if (isNsis) {
      commandToRun += ' /S';
    }
    // Tanınmıyorsa keyfi bayrak eklenmez
  }

  writeLog('INFO', 'Program kaldırma işlemi başlatıldı', {
    app: program.displayName, category: program.category || 'desktop', silent: Boolean(options?.silent)
  });
  // No timeout/AbortSignal is passed to spawn: neither a deadline nor cancellation
  // may kill an MSI/Store transaction. Ignored streams also avoid maxBuffer kills.
  const command = parseUninstallCommand(commandToRun, process.env);
  return runTrackedUninstall(program, () => spawn(command.executable, command.args, { shell: false, windowsHide: false, stdio: 'ignore' }));
});

// 4. Program-specific leftovers; errors remain distinct from a complete empty scan.
handleExclusive<LeftoverScanResult>('leftovers:scan', error => ({ success: false, items: [], error }), async (_event, args: { appId: string; options?: LeftoverScanOptions }): Promise<LeftoverScanResult> => {
  invalidateCleanup();
  const program = verifiedRemovals.get(args.appId);
  if (!program) {
    writeLog('ERROR', 'Kalıntı taraması başlatılamadı', { appId: args.appId });
    return { success: false, items: [], error: 'Kurulu programın kullanılan verileri kalıntı değildir. Önce programı kaldırın; kaldırma doğrulandıktan sonra temizlik açılır.' };
  }
  await assertCleanupAllowed(program);

  const scanAppData = args.options?.scanAppData !== false;
  const scanRegistry = args.options?.scanRegistry !== false;
  const appName = program.displayName.trim();
  const publisher = program.publisher?.trim() || '';
  const ownershipPrograms = await currentOwnershipPrograms();
  const terms = candidateTerms(program).filter(term => !cleanupConflict('', term, program, ownershipPrograms));
  const items: LeftoverItem[] = [];
  const warnings: string[] = [];
  cachedLeftoversMap.clear();
  const scanId = randomUUID();
  const warn = (target: string, error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(target + ': ' + message);
    writeLog('ERROR', 'Kalıntı tarama hatası', { app: appName, target, error: message });
  };
  const add = (item: Omit<LeftoverItem, 'id' | 'selected'>) => {
    if (items.some((candidate) => candidate.path.toLowerCase() === item.path.toLowerCase())) return;
    items.push({ ...item, id: 'leftover-' + scanId + '-' + items.length, selected: false });
  };
  writeLog('INFO', 'Kalıntı taraması başlatıldı', { app: appName, scanAppData, scanRegistry });

  if (!scanAppData && !scanRegistry) warn('Tarama', 'En az bir tarama alanı seçilmelidir.');
  if (!terms.length) warn('Program adı', 'Program için güvenli bir hedef adı oluşturulamadı.');
  if (scanAppData) {
    const scopes: Array<{ root: string | undefined; scope: LeftoverItem['targetScope'] }> = [
      { root: process.env.APPDATA, scope: '%AppData%' },
      { root: process.env.LOCALAPPDATA, scope: '%LocalAppData%' },
      { root: process.env.PROGRAMDATA || process.env.ALLUSERSPROFILE, scope: 'C:\\ProgramData' }
    ];
    for (const { root, scope } of scopes) {
      if (!root) { warn(scope, 'Temizlik kök klasörü bulunamadı.'); continue; }
      try { fs.readdirSync(root); } catch (error) { warn(root, error); continue; }
      for (const target of buildCleanupCandidates(root, terms, publisher)) {
        try {
          assertOwnership(target, program, ownershipPrograms);
          // lstat reports access errors instead of turning them into an empty result.
          let stat: fs.Stats;
          try { stat = fs.lstatSync(target); } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
            throw error;
          }
          const safety = isPathSafeToDelete(target, root);
          if (!safety.safe) {
            writeLog('WARN', 'Tarama hedefi korunuyor', { path: target, reason: safety.reason });
            continue;
          }
          const measured = inspectCleanupTree(target);
          const snapshot = { tree: measured.fingerprint, parent: parentFingerprint(target) };
          targetSnapshots.set(target.toLowerCase(), snapshot);
          add({ type: stat.isDirectory() ? 'folder' : 'file', path: target, targetScope: scope,
            sizeBytes: measured.sizeBytes, fileCount: measured.fileCount,
            evidence: leftoverEvidence(program, path.basename(target), path.dirname(target).toLowerCase() !== root.toLowerCase()) });
        } catch (error) { warn(target, error); }
      }
    }
  }

  if (scanRegistry) {
    for (const { hive, scope } of [
      { hive: 'HKCU:\\Software', scope: 'HKCU\\Software' as const },
      { hive: 'HKLM:\\SOFTWARE', scope: 'HKLM\\Software' as const }
    ]) {
      for (const term of terms) {
        const keys = [hive + '\\' + term, ...(isSafeName(publisher) ? [hive + '\\' + publisher + '\\' + term] : [])];
        for (const key of keys) {
          const normalized = key.replace('HKCU:\\', 'HKCU\\').replace('HKLM:\\', 'HKLM\\');
          const safety = isRegistryKeySafeToDelete(normalized);
          if (!safety.safe) {
            writeLog('WARN', 'Registry tarama hedefi korunuyor', { path: normalized, reason: safety.reason });
            continue;
          }
          try {
            assertOwnership(normalized, program, ownershipPrograms);
            const { stdout } = await runPowerShell(
              '$ErrorActionPreference = \'Stop\'; if (Test-Path -LiteralPath ' + toPowerShellLiteral(key) +
              ' -ErrorAction Stop) { Get-Item -LiteralPath ' + toPowerShellLiteral(key) +
              ' -ErrorAction Stop | Out-Null; Write-Output \'EXISTS\' } else { Write-Output \'MISSING\' }',
              1024 * 1024,
              10000
            );
            if (stdout.trim() === 'EXISTS') {
              targetSnapshots.set(normalized.toLowerCase(), { tree: await registryDigest(normalized) });
              add({ type: 'registry_key', path: normalized, targetScope: scope,
                evidence: leftoverEvidence(program, term, key.toLowerCase() !== (hive + '\\' + term).toLowerCase()) });
            } else if (stdout.trim() !== 'MISSING') {
              warn(key, 'Registry sorgusu beklenen sonucu döndürmedi.');
            }
          } catch (error) { warn(key, error); }
        }
      }
    }
  }

  for (const item of items) cachedLeftoversMap.set(item.id, item);
  cleanupSession = { program: { ...program }, scanId };
  writeLog(warnings.length ? 'ERROR' : 'INFO', 'Kalıntı taraması tamamlandı',
    { app: appName, foundCount: items.length, warningCount: warnings.length, targets: items.map((item) => item.path) });
  return {
    success: warnings.length === 0,
    items,
    warnings,
    ...(warnings.length ? { error: 'Tarama eksik kaldı. Ayrıntılar: ' + warnings.join(' | ') } : {}),
    message: items.length + ' kalıntı adayı bulundu.'
  };
});

// 5. Kalıntıları Silme (Her öğe bağımsız try-catch ile raporlanır, asla sistem dosyası silinmez)
handleExclusive<LeftoverDeleteResult>('leftovers:delete', error => ({ success: false, deletedCount: 0, failedCount: 1, results: [], error }), async (_event, args: { items: Array<Pick<LeftoverItem, 'id'>> }): Promise<LeftoverDeleteResult> => {
  const requestedItems = Array.isArray(args.items) ? [...new Map(args.items.map((item) => [item.id, item])).values()] : [];
  const items = requestedItems
    .map(({ id }) => cachedLeftoversMap.get(id))
    .filter((item): item is LeftoverItem => Boolean(item));

  const unknownResults = requestedItems
    .filter(({ id }) => !cachedLeftoversMap.has(id))
    .map(({ id }) => ({
      id,
      path: '(doğrulanmamış hedef)',
      success: false,
      error: 'Bu hedef geçerli tarama sonucunda bulunmadı.'
    }));
  writeLog('INFO', 'Kalıntı temizliği başlatıldı', {
    requestedCount: requestedItems.length,
    verifiedCount: items.length
  });
  for (const result of unknownResults) {
    writeLog('ERROR', 'Doğrulanmamış temizlik hedefi engellendi', result);
  }
  if (requestedItems.length === 0) {
    writeLog('WARN', 'Kalıntı temizliği hedef seçilmeden çağrıldı');
    return {
      success: true,
      deletedCount: 0,
      failedCount: 0,
      results: unknownResults
    };
  }

  const results: LeftoverDeleteResult['results'] = [...unknownResults];
  let deletedCount = 0;
  let failedCount = unknownResults.length;
  const session = cleanupSession;
  if (items.length && !session) throw new Error('Temizlik oturumu artık geçerli değil.');
  if (session) await assertCleanupAllowed(session.program);
  const ownershipPrograms = items.length ? await currentOwnershipPrograms() : [];
  for (const item of items) {
    if (session) {
      try { assertOwnership(item.path, session.program, ownershipPrograms); }
      catch (error) { failedCount++; results.push({ id: item.id, path: item.path, success: false, error: String(error) }); continue; }
    }
    let journal: BackupRecord | undefined;
    const store = backups();
    const failedBackup = (error: unknown) => {
      if (!journal) return;
      try { store.save({ ...journal, state: 'failed', error: String(error).slice(0, 2000) }); }
      catch (failure) { writeLog('ERROR', 'Yedek durum kaydı yazılamadı', String(failure)); }
    };
    if (!session || !item.id.startsWith('leftover-' + session.scanId + '-')) {
      throw new Error('Temizlik hedefi bu programın tarama oturumuna ait değil.');
    }
    if (item.type === 'folder' || item.type === 'file') {
      try {
        const safety = isPathSafeToDelete(item.path);
        if (!safety.safe) {
          failedCount++;
          results.push({
            id: item.id,
            path: item.path,
            success: false,
            error: `Güvenlik Engeli: ${safety.reason}`
          });
          writeLog('ERROR', 'Dosya sistemi hedefi güvenlik kontrolünde engellendi', {
            path: item.path,
            reason: safety.reason
          });
          continue;
        }

        await assertNoLinkedChildren(item.path);
        const recheck = isPathSafeToDelete(item.path);
        if (!recheck.safe) throw new Error(recheck.reason);
        const snapshot = targetSnapshots.get(item.path.toLowerCase());
        if (!snapshot || !fs.existsSync(item.path)) throw new Error('Hedef kayboldu veya tarama kaydı geçersiz; yeniden tarayın.');
        journal = store.prepare(item, session.program);
        journal.digest = treeFingerprint(item.path, true);
        store.save(journal);
        await assertCleanupAllowed(session.program);
        // No await between this final identity/link check and the move.
        const finalSafety = isPathSafeToDelete(item.path);
        if (!finalSafety.safe || snapshot.parent !== parentFingerprint(item.path) || snapshot.tree !== treeFingerprint(item.path)) throw new Error('Hedef taramadan sonra değişti; veri korunuyor.');
        fs.renameSync(item.path, store.payload(journal));
        journal.state = 'completed'; store.save(journal);
        deletedCount++;
        cachedLeftoversMap.delete(item.id);
        results.push({ id: item.id, path: item.path, success: true, backupId: journal.id });
        writeLog('INFO', 'Kalıntı yedeğe taşındı', { type: item.type, path: item.path, backupId: journal.id });
      } catch (err: unknown) {
        failedBackup(err);
        failedCount++;
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ id: item.id, path: item.path, success: false, backupId: journal?.id, error: msg });
        writeLog('ERROR', 'Dosya sistemi kalıntısı silinemedi', { path: item.path, error: msg });
      }
    } else if (item.type === 'registry_key') {
      const safety = isRegistryKeySafeToDelete(item.path);
      if (!safety.safe) {
        failedCount++;
        results.push({
          id: item.id,
          path: item.path,
          success: false,
          error: `Güvenlik Engeli: ${safety.reason}`
        });
        writeLog('ERROR', 'Registry hedefi güvenlik kontrolünde engellendi', {
          path: item.path,
          reason: safety.reason
        });
        continue;
      }

      try {
        await assertCleanupAllowed(session.program);
        journal = store.prepare(item, session.program);
        const backupPath = store.payload(journal);
        await execFileAsync('reg.exe', ['export', item.path, backupPath, '/y'], { windowsHide: true, timeout: 10000 });
        if (!fs.existsSync(backupPath) || fs.statSync(backupPath).size === 0) throw new Error('Registry yedeği oluşturulamadı; hedef korunuyor.');
        journal.digest = validateRegBackup(fs.readFileSync(backupPath), item.path);
        if (journal.digest !== targetSnapshots.get(item.path.toLowerCase())?.tree) throw new Error('Registry hedefi taramadan sonra değişti; anahtar korunuyor.');
        journal.state = 'backed-up'; store.save(journal);
        await assertCleanupAllowed(session.program);
        if (await registryDigest(item.path) !== journal.digest) throw new Error('Registry hedefi temizlik sırasında değişti; anahtar korunuyor.');
        await execFileAsync('reg.exe', ['delete', item.path, '/f'], { windowsHide: true });
        journal.state = 'completed'; store.save(journal);
        deletedCount++;
        cachedLeftoversMap.delete(item.id);
        results.push({ id: item.id, path: item.path, success: true, backupId: journal.id });
        writeLog('INFO', 'Registry kalıntısı silindi', { path: item.path });
      } catch (err: unknown) {
        failedBackup(err);
        failedCount++;
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ id: item.id, path: item.path, success: false, backupId: journal?.id, error: msg });
        writeLog('ERROR', 'Registry kalıntısı silinemedi', { path: item.path, error: msg });
      }
    }
  }

  writeLog(failedCount === 0 ? 'INFO' : 'ERROR', 'Kalıntı temizliği tamamlandı', {
    requestedCount: requestedItems.length,
    deletedCount,
    failedCount
  });

  return {
    success: failedCount === 0,
    deletedCount,
    failedCount,
    results
  };
});

handleExclusive<BackupListResult>('backups:list', error => ({ success: false, entries: [], warnings: [], error }), async () => ({ success: true, ...backups().list() }));
handleExclusive<BackupRestoreResult>('backups:delete', error => ({ success: false, error }), async (_event, input: { id: string; token: string }) => {
  backups().delete(input.id, input.token);
  writeLog('WARN', 'Kullanıcı onayıyla tek temizlik yedeği kalıcı silindi', { id: input.id });
  return { success: true, message: 'Yalnızca seçilen yedek kalıcı silindi; özgün/geri alınmış hedefe dokunulmadı.' };
});
handleExclusive<BackupRestoreResult>('backups:restore', error => ({ success: false, error }), async (_event, input: { id: string }) => {
  const store = backups(), record = store.read(input.id);
  if (record.state === 'restored') return { success: false, error: 'Bu yedek daha önce geri alındı.' };
  assertBackupTarget(record);
  assertOwnership(record.originalPath, record.program, await currentOwnershipPrograms());
  if (await isProgramStillInstalled(record.program)) return { success: false, error: 'Program yeniden kurulu; mevcut verilerini korumak için geri alma engellendi.' };
  store.verify(record);
  try {
    if (record.type === 'registry_key') {
      const key = record.originalPath.replace(/^HKCU\\/i, 'Registry::HKEY_CURRENT_USER\\').replace(/^HKLM\\/i, 'Registry::HKEY_LOCAL_MACHINE\\');
      const { stdout } = await runPowerShell(`$ErrorActionPreference = 'Stop'; if (Test-Path -LiteralPath ${toPowerShellLiteral(key)} -ErrorAction Stop) { 'EXISTS' } else { 'MISSING' }`, 1024 * 1024, 10000);
      if (stdout.trim() !== 'MISSING') throw new Error('Registry hedefi mevcut veya durum doğrulanamadı; üzerine yazılmadı.');
      store.save({ ...record, state: 'restoring', error: undefined });
      // Import only the validated snapshot under its original, absent Software key.
      store.verify(record);
      await execFileAsync('reg.exe', ['import', store.payload(record)], { windowsHide: true, timeout: 10000 });
    } else {
      if (fs.existsSync(record.originalPath)) throw new Error('Hedefte veri mevcut; üzerine yazılmadı.');
      store.save({ ...record, state: 'restoring', error: undefined });
      store.restoreFiles(record, getCleanupRoots(), process.env.WINDIR);
    }
    store.save({ ...record, state: 'restored', error: undefined });
    invalidateCleanup(); verifiedRemovals.clear();
    writeLog('INFO', 'Temizlik yedeği geri alındı', { id: record.id, app: record.appName });
    return { success: true, message: 'Özgün hedef geri alındı. Yedek kopyası diskte korundu; programın kendisi yeniden kurulmadı.' };
  } catch (error) {
    store.save({ ...record, state: 'failed', error: String(error).slice(0, 2000) });
    writeLog('ERROR', 'Yedek geri alınamadı', { id: record.id, error: String(error) });
    throw error;
  }
});

// 6. Sistem Geri Yükleme Noktası (Desteklenmiyorsa gerçeği söyle, sahte başarı üretme)
const restorePointWait = new RestorePointWait();
handleExclusive<RestorePointResult>('system:create-restore-point', error => ({ success: false, supported: false, error }), async (_event, args?: { description?: string }): Promise<RestorePointResult> => {
  if (process.platform !== 'win32') {
    return {
      success: false,
      supported: false,
      error: 'Sistem Geri Yükleme Noktası yalnızca Windows işletim sisteminde desteklenir.'
    };
  }

  const result = await restorePointWait.run(async () => {
  const isElevated = await checkIsElevated();
  if (!isElevated) {
    return {
      success: false,
      supported: false,
      error: 'Sistem Geri Yükleme noktası oluşturmak için Yönetici Yetkisi (Run as Administrator) gereklidir.'
    };
  }

  try {
    const desc = args?.description || 'SiftUninstaller Kaldirma Oncesi';
    writeLog('INFO', 'Sistem geri yükleme noktası isteği başlatıldı', { description: desc });
    await runPowerShell(
      `$WarningPreference = 'Stop'; Checkpoint-Computer -Description ${toPowerShellLiteral(desc)} -RestorePointType 'APPLICATION_UNINSTALL' -ErrorAction Stop`,
      1024 * 1024
    );
    writeLog('INFO', 'Sistem geri yükleme noktası isteği tamamlandı', { description: desc });
    return {
      success: true,
      supported: true,
      description: `Geri yükleme noktası oluşturuldu: ${desc}`
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    writeLog('ERROR', 'Sistem geri yükleme noktası oluşturulamadı', message);
    return {
      success: false,
      supported: false,
      error: `Windows Sistem Koruması başarısız oldu (Devre dışı bırakılmış veya frekans sınırı aşılmış olabilir): ${message}`
    };
  }
  });
  if (result.backgroundPending) writeLog('WARN', 'Geri yükleme sonucu beklemesi sonlandırıldı; işlem zorla kesilmedi', result.error);
  return result;
});

ipcMain.handle('logs:open-folder', async (event, ...args): Promise<{ success: boolean; path?: string; error?: string }> => {
  if (!trustedRenderer(event, mainWindow, rendererURL) || !validIPC('logs:open-folder', args)) return { success: false, error: 'Geçersiz günlük isteği.' };
  try {
    const logFile = getLogFilePath();
    if (!fs.existsSync(logFile)) {
      writeLog('INFO', 'Log dosyası oluşturuldu');
    }
    shell.showItemInFolder(logFile);
    return { success: true, path: logFile };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    writeLog('ERROR', 'Log klasörü açılamadı', message);
    return { success: false, error: message };
  }
});

// Electron Yaşam Döngüsü
const ownsInstance = app.requestSingleInstanceLock();
if (!ownsInstance) app.quit();
else app.whenReady().then(async () => {
  writeLog('INFO', 'Sift Uninstaller başlatıldı', {
    version: APP_VERSION,
    platform: process.platform,
    packaged: app.isPackaged
  });
  // Geliştirme sunucusu dışında uygulama yalnızca yükseltilmiş yönetici
  // belirteciyle çalışır. Standart açılış kendisini UAC ile yeniden başlatır.
  const requiresElevation = process.platform === 'win32' && (app.isPackaged || process.env.SIFT_DEV_SERVER !== '1');
  if (requiresElevation && !(await checkIsElevated())) {
    app.releaseSingleInstanceLock();
    const relaunched = await relaunchAsAdministrator();
    if (!relaunched) {
      dialog.showErrorBox(
        'Yönetici Yetkisi Gerekli',
        'Sift Uninstaller yalnızca yönetici yetkisiyle çalışabilir. UAC isteği reddedildi.'
      );
    }
    app.quit();
    return;
  }

  Menu.setApplicationMenu(null);
  uninstallJournal.load();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('second-instance', () => {
  if (mainWindow?.isMinimized()) mainWindow.restore();
  mainWindow?.focus();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
