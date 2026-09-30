import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { exec, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { assertNoLinkedChildren, buildCleanupCandidates, checkCleanupPath, checkCleanupRegistry, isSafeName } from './cleanupSafety';
import { randomUUID } from 'node:crypto';
import { verifyUninstall } from './uninstallVerification';
import { APP_VERSION } from '../src/version';
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
  RegistryHive
} from '../src/types';

const execFileAsync = promisify(execFile);

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

function getLogFilePath(): string {
  const logDirectory = path.join(app.getPath('userData'), 'logs');
  fs.mkdirSync(logDirectory, { recursive: true });
  return path.join(logDirectory, 'sift-uninstaller.log');
}

function writeLog(level: LogLevel, event: string, details?: unknown): void {
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
  } catch (error) {
    console.error('Log dosyasına yazılamadı:', error);
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
// Renderer yalnızca burada üretilen adayların kimliklerini gönderebilir.
const cachedLeftoversMap = new Map<string, LeftoverItem>();

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    show: false,
    width: 1200,
    height: 820,
    minWidth: 900,
    minHeight: 650,
    title: 'Sift Uninstaller',
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // Geliştirmede script Vite'ı önce başlatır; paketli sürüm yalnızca dist'i açar.
  const useDevServer = !app.isPackaged && process.env.SIFT_DEV_SERVER === '1';
  if (useDevServer) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:3000');
    if (process.env.SIFT_OPEN_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`Renderer yüklenemedi (${errorCode}): ${errorDescription} - ${validatedURL}`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
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
  return checkCleanupPath(targetPath, scopeRoot ? [scopeRoot] : getCleanupRoots(), process.env.WINDIR);
}

function isRegistryKeySafeToDelete(regKey: string) {
  return checkCleanupRegistry(regKey);
}

// ---------------------------------------------------------------------------
// IPC HANDLERS
// ---------------------------------------------------------------------------

// 1. Sistem ve Yetki Durumu
ipcMain.handle('app:get-system-info', async (): Promise<SystemInfo> => {
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
ipcMain.handle('programs:get-installed', async (): Promise<InstalledProgramsResult> => {
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
    const psScript = `
      [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
      $hives = @(
        @{ Hive='HKLM'; Path='HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' },
        @{ Hive='WOW6432Node'; Path='HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' },
        @{ Hive='HKCU'; Path='HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' }
      )
      $apps = @()
      foreach ($h in $hives) {
        $parent = $h.Path -replace '\\\\\*$',''
        if (Test-Path $parent) {
          Get-ItemProperty -Path $h.Path -ErrorAction SilentlyContinue | ForEach-Object {
            $dn = $_.DisplayName
            $sc = $_.SystemComponent
            $pk = $_.ParentKeyName
            if ($dn -and ($dn.Trim().Length -gt 0)) {
              $releaseType = [string]$_.ReleaseType
              $isSystem = ($sc -eq 1) -or (-not [string]::IsNullOrWhiteSpace([string]$pk)) -or ($releaseType -match 'Update|Hotfix|Security')
              $apps += [PSCustomObject]@{
                displayName = $dn.Trim()
                displayVersion = [string]$_.DisplayVersion
                publisher = [string]$_.Publisher
                uninstallString = [string]$_.UninstallString
                quietUninstallString = [string]$_.QuietUninstallString
                estimatedSize = if ($_.EstimatedSize) { [int]$_.EstimatedSize } else { 0 }
                displayIcon = [string]$_.DisplayIcon
                installDate = [string]$_.InstallDate
                installLocation = [string]$_.InstallLocation
                registryKey = ($_.PSPath -replace '^Microsoft\\.PowerShell\\.Core\\\\Registry::','').Trim()
                hive = $h.Hive
                category = if ($isSystem) { 'system' } else { 'desktop' }
                isSystemComponent = [bool]$isSystem
                packageFullName = ''
              }
            }
          }
        }
      }
      Get-AppxPackage -ErrorAction SilentlyContinue |
        Where-Object { (-not $_.IsFramework) -and (-not $_.NonRemovable) } |
        ForEach-Object {
          $apps += [PSCustomObject]@{
            displayName = [string]$_.Name
            displayVersion = [string]$_.Version
            publisher = if ($_.PublisherId) { [string]$_.PublisherId } else { [string]$_.Publisher }
            uninstallString = ''
            quietUninstallString = ''
            estimatedSize = 0
            displayIcon = ''
            installDate = ''
            installLocation = [string]$_.InstallLocation
            registryKey = 'APPX\\' + [string]$_.PackageFullName
            hive = 'APPX'
            category = 'store'
            isSystemComponent = $false
            packageFullName = [string]$_.PackageFullName
          }
        }
      $apps | ConvertTo-Json -Compress -Depth 4
    `;

    const { stdout } = await runPowerShell(psScript);

    if (!stdout || !stdout.trim()) {
      return { success: true, programs: [] };
    }

    const rawList = JSON.parse(stdout.trim());
    const arrayList = Array.isArray(rawList) ? rawList : [rawList];

    cachedProgramsMap.clear();

    const programs: InstalledProgram[] = arrayList.map((item, idx) => {
      const id = `win-app-${idx}-${Buffer.from(`${item.category || 'desktop'}-${item.displayName}`).toString('hex').slice(0, 16)}`;
      
      const sizeBytes = (item.estimatedSize || 0) * 1024;
      const sizeFormatted = sizeBytes > 0
        ? (sizeBytes >= 1024 * 1024 * 1024
            ? `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
            : `${Math.round(sizeBytes / (1024 * 1024))} MB`)
        : 'Belirtilmemiş';

      const program: InstalledProgram = {
        id,
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
        packageFullName: item.packageFullName || undefined
      };

      // Doğrulama için önbelleğe al
      cachedProgramsMap.set(id, program);
      return program;
    });

    writeLog('INFO', 'Program listesi yüklendi', {
      total: programs.length,
      desktop: programs.filter((program) => program.category === 'desktop').length,
      store: programs.filter((program) => program.category === 'store').length,
      system: programs.filter((program) => program.category === 'system').length
    });

    return { success: true, programs };
  } catch (err: unknown) {
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
    script = `$ErrorActionPreference = 'Stop'; $packages = @(Get-AppxPackage -Name ${toPowerShellLiteral(program.displayName)} -ErrorAction Stop); if ($packages.Count -gt 0) { 'INSTALLED' } else { 'REMOVED' }`;
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

ipcMain.handle('programs:uninstall', async (_event, args: { appId: string; options?: UninstallOptions }): Promise<UninstallResult> => {
  const { appId, options } = args;

  // Güvenlik doğrulaması: Uygulama önceden Registry taramasında bulunmuş olmalıdır
  const program = cachedProgramsMap.get(appId);
  if (!program) {
    return {
      success: false,
      error: 'Güvenlik ihlali: Kaldırılmak istenen uygulama doğrulanmış Registry listesinde bulunamadı.'
    };
  }

  if (program.category === 'store') {
    if (!program.packageFullName) {
      writeLog('ERROR', 'Store uygulaması kaldırılamadı', { appId, error: 'Paket kimliği eksik' });
      return { success: false, error: 'Microsoft Store paket kimliği bulunamadı.' };
    }

    writeLog('INFO', 'Store uygulaması kaldırma işlemi başlatıldı', {
      app: program.displayName,
      packageFullName: program.packageFullName
    });
    try {
      await runPowerShell(
        `Remove-AppxPackage -Package ${toPowerShellLiteral(program.packageFullName)} -ErrorAction Stop`,
        8 * 1024 * 1024
      );
      const result = await verifyUninstall(() => isProgramStillInstalled(program));
      writeLog(result.verified ? 'INFO' : 'ERROR', 'Store kaldırma doğrulaması', { app: program.displayName, ...result });
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      writeLog('ERROR', 'Store uygulaması kaldırılamadı', { app: program.displayName, error: message });
      return { success: false, exitCode: -1, error: `Store uygulaması kaldırılamadı: ${message}` };
    }
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

  return new Promise((resolve) => {
    writeLog('INFO', 'Program kaldırma işlemi başlatıldı', {
      app: program.displayName,
      category: program.category || 'desktop',
      silent: Boolean(options?.silent)
    });
    // Windows üzerinde doğrudan çalıştırma
    exec(commandToRun, { windowsHide: false }, async (error, stdout, stderr) => {
      if (error && error.code !== 3010) {
        resolve({
          success: false,
          exitCode: error.code || -1,
          error: `Kaldırıcı işlem hatayla sonlandı (Çıkış kodu: ${error.code ?? 'Bilinmiyor'}). ${error.message}`
        });
        writeLog('ERROR', 'Program kaldırılamadı', {
          app: program.displayName,
          exitCode: error.code ?? -1,
          error: error.message,
          stderr: stderr?.trim()
        });
        return;
      }

      const result = await verifyUninstall(() => isProgramStillInstalled(program), error?.code === 3010 ? 3010 : 0);
      writeLog(result.verified ? 'INFO' : 'WARN', 'Program kaldırma doğrulaması', {
        app: program.displayName,
        ...result,
        stdout: stdout?.trim(),
        stderr: stderr?.trim()
      });
      resolve(result);
    });
  });
});

// 4. Program-specific leftovers; errors remain distinct from a complete empty scan.
ipcMain.handle('leftovers:scan', async (_event, args: { appId: string; options?: LeftoverScanOptions }): Promise<LeftoverScanResult> => {
  const program = cachedProgramsMap.get(args.appId);
  if (!program) {
    writeLog('ERROR', 'Kalıntı taraması başlatılamadı', { appId: args.appId });
    return { success: false, items: [], error: 'Uygulama önbellekte bulunamadı.' };
  }

  const scanAppData = args.options?.scanAppData !== false;
  const scanRegistry = args.options?.scanRegistry !== false;
  const appName = program.displayName.trim();
  const publisher = program.publisher?.trim() || '';
  const cleanName = appName.replace(/\s*\(.*?\)\s*/g, '').replace(/version\s*[\d.]+/gi, '').trim();
  const terms = [...new Set([cleanName, appName])].filter(isSafeName)
    .filter((term) => term.toLowerCase() !== publisher.toLowerCase());
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
          add({ type: stat.isDirectory() ? 'folder' : 'file', path: target, targetScope: scope,
            sizeOrDetails: stat.isDirectory() ? 'Klasör ve alt dosyalar' : Math.round(stat.size / 1024) + ' KB' });
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
            const { stdout } = await runPowerShell(
              '$ErrorActionPreference = \'Stop\'; if (Test-Path -LiteralPath ' + toPowerShellLiteral(key) +
              ' -ErrorAction Stop) { Get-Item -LiteralPath ' + toPowerShellLiteral(key) +
              ' -ErrorAction Stop | Out-Null; Write-Output \'EXISTS\' } else { Write-Output \'MISSING\' }',
              1024 * 1024,
              10000
            );
            if (stdout.trim() === 'EXISTS') {
              add({ type: 'registry_key', path: normalized, targetScope: scope, sizeOrDetails: 'Kayıt Defteri Anahtarı' });
            } else if (stdout.trim() !== 'MISSING') {
              warn(key, 'Registry sorgusu beklenen sonucu döndürmedi.');
            }
          } catch (error) { warn(key, error); }
        }
      }
    }
  }

  for (const item of items) cachedLeftoversMap.set(item.id, item);
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
ipcMain.handle('leftovers:delete', async (_event, args: { items: Array<Pick<LeftoverItem, 'id'>> }): Promise<LeftoverDeleteResult> => {
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

  for (const item of items) {
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
        if (fs.existsSync(item.path)) {
          await fs.promises.rm(item.path, { recursive: true, force: true });
        }
        deletedCount++;
        cachedLeftoversMap.delete(item.id);
        results.push({ id: item.id, path: item.path, success: true });
        writeLog('INFO', 'Kalıntı silindi', { type: item.type, path: item.path });
      } catch (err: unknown) {
        failedCount++;
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ id: item.id, path: item.path, success: false, error: msg });
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
        // reg.exe delete "<Key>" /f ile anahtarı sil
        await execFileAsync('reg.exe', ['delete', item.path, '/f'], { windowsHide: true });
        deletedCount++;
        cachedLeftoversMap.delete(item.id);
        results.push({ id: item.id, path: item.path, success: true });
        writeLog('INFO', 'Registry kalıntısı silindi', { path: item.path });
      } catch (err: unknown) {
        failedCount++;
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ id: item.id, path: item.path, success: false, error: msg });
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

// 6. Sistem Geri Yükleme Noktası (Desteklenmiyorsa gerçeği söyle, sahte başarı üretme)
ipcMain.handle('system:create-restore-point', async (_event, args?: { description?: string }): Promise<RestorePointResult> => {
  if (process.platform !== 'win32') {
    return {
      success: false,
      supported: false,
      error: 'Sistem Geri Yükleme Noktası yalnızca Windows işletim sisteminde desteklenir.'
    };
  }

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
    await runPowerShell(
      `Checkpoint-Computer -Description ${toPowerShellLiteral(desc)} -RestorePointType 'APPLICATION_UNINSTALL' -ErrorAction Stop`,
      1024 * 1024
    );

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

ipcMain.handle('logs:open-folder', async (): Promise<{ success: boolean; path?: string; error?: string }> => {
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
app.whenReady().then(async () => {
  writeLog('INFO', 'Sift Uninstaller başlatıldı', {
    version: APP_VERSION,
    platform: process.platform,
    packaged: app.isPackaged
  });
  // Geliştirme sunucusu dışında uygulama yalnızca yükseltilmiş yönetici
  // belirteciyle çalışır. Standart açılış kendisini UAC ile yeniden başlatır.
  const requiresElevation = process.platform === 'win32' && process.env.SIFT_DEV_SERVER !== '1';
  if (requiresElevation && !(await checkIsElevated())) {
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
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
