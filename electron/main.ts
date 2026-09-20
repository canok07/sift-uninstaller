import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { exec, execFile } from 'node:child_process';
import { promisify } from 'node:util';
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

/**
 * PowerShell betiğini cmd.exe tırnaklama kurallarına sokmadan çalıştırır.
 * -EncodedCommand UTF-16LE beklediği için betik bu biçimde kodlanır.
 */
async function runPowerShell(script: string, maxBuffer = 32 * 1024 * 1024) {
  const encodedScript = Buffer.from(script, 'utf16le').toString('base64');
  return execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodedScript],
    { windowsHide: true, maxBuffer, encoding: 'utf8' }
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
function isPathSafeToDelete(targetPath: string): { safe: boolean; reason?: string } {
  if (!targetPath || typeof targetPath !== 'string') {
    return { safe: false, reason: 'Geçersiz veya boş yol' };
  }

  const normalized = path.normalize(targetPath).trim();
  const lower = normalized.toLowerCase();

  // 1. Sürücü kökleri (Örn: C:\, D:\, /)
  if (/^[a-zA-Z]:\\?$/.test(normalized) || normalized === '/' || normalized === '\\') {
    return { safe: false, reason: 'Sürücü kök dizini silinemez' };
  }

  // 2. Kritik Windows ve Sistem Dizinleri
  const blacklistedSubstrings = [
    '\\windows',
    '\\system32',
    '\\syswow64',
    '\\winsxs',
    '\\boot',
    '\\recovery',
    '\\perflogs'
  ];
  for (const bl of blacklistedSubstrings) {
    if (lower === `c:${bl}` || lower.startsWith(`c:${bl}\\`)) {
      return { safe: false, reason: 'Windows sistem çekirdek dizinleri silinemez' };
    }
  }

  // 3. Kullanıcı ve Program Dosyaları Kökleri
  const systemRoots = [
    'c:\\program files',
    'c:\\program files (x86)',
    'c:\\users',
    'c:\\programdata'
  ];
  for (const root of systemRoots) {
    if (lower === root || lower === `${root}\\`) {
      return { safe: false, reason: 'Ana sistem klasörünün kendisi silinemez' };
    }
  }

  // 4. Kullanıcı Profil Kökü (Örn: C:\Users\Username)
  const userProfile = process.env.USERPROFILE?.toLowerCase();
  if (userProfile && (lower === userProfile || lower === `${userProfile}\\`)) {
    return { safe: false, reason: 'Kullanıcı profil ana dizini silinemez' };
  }

  // 5. AppData ve LocalAppData Ana Klasörlerinin Kendisi
  const appData = process.env.APPDATA?.toLowerCase();
  const localAppData = process.env.LOCALAPPDATA?.toLowerCase();
  const programData = process.env.ALLUSERSPROFILE?.toLowerCase() || 'c:\\programdata';

  if (appData && (lower === appData || lower === `${appData}\\`)) {
    return { safe: false, reason: 'AppData ana klasörü silinemez' };
  }
  if (localAppData && (lower === localAppData || lower === `${localAppData}\\`)) {
    return { safe: false, reason: 'LocalAppData ana klasörü silinemez' };
  }
  if (programData && (lower === programData || lower === `${programData}\\`)) {
    return { safe: false, reason: 'ProgramData ana klasörü silinemez' };
  }

  // En az 2 seviye derinlikte olmalıdır (Örn: %AppData%\ProgramName)
  const segments = normalized.split(/[\\/]/).filter(Boolean);
  if (segments.length < 3) {
    return { safe: false, reason: 'Yol derinliği güvenlik için yetersiz (en az 3 kademe gereklidir)' };
  }

  return { safe: true };
}

function isRegistryKeySafeToDelete(regKey: string): { safe: boolean; reason?: string } {
  if (!regKey || typeof regKey !== 'string') {
    return { safe: false, reason: 'Geçersiz registry anahtarı' };
  }
  const cleanKey = regKey.trim().toUpperCase();

  // Root veya 1. seviye Software anahtarları asla silinemez
  const forbiddenKeys = [
    'HKLM',
    'HKCU',
    'HKCR',
    'HKU',
    'HKEY_LOCAL_MACHINE',
    'HKEY_CURRENT_USER',
    'HKEY_CLASSES_ROOT',
    'HKEY_USERS',
    'HKLM\\SOFTWARE',
    'HKCU\\SOFTWARE',
    'HKLM\\SOFTWARE\\MICROSOFT',
    'HKCU\\SOFTWARE\\MICROSOFT',
    'HKLM\\SOFTWARE\\WOW6432NODE',
    'HKLM\\SOFTWARE\\WOW6432NODE\\MICROSOFT',
    'HKLM\\SYSTEM',
    'HKLM\\SAM',
    'HKLM\\SECURITY'
  ];

  if (forbiddenKeys.includes(cleanKey)) {
    return { safe: false, reason: 'Kayıt defteri kök veya sistem seviyesi anahtarlar silinemez' };
  }

  const parts = cleanKey.split('\\').filter(Boolean);
  if (parts.length < 3) {
    return { safe: false, reason: 'Registry anahtarı güvenlik sınırının üzerinde (çok genel)' };
  }

  return { safe: true };
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
    // PowerShell ile HKLM (64-bit), HKLM (Wow6432Node 32-bit) ve HKCU uninstall anahtarlarını güvenle sorguluyoruz
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
            if ($dn -and ($dn.Trim().Length -gt 0) -and ($sc -ne 1) -and (-not $pk)) {
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
              }
            }
          }
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
      const id = `win-app-${idx}-${Buffer.from(item.displayName).toString('hex').slice(0, 12)}`;
      
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
        installLocation: item.installLocation || undefined
      };

      // Doğrulama için önbelleğe al
      cachedProgramsMap.set(id, program);
      return program;
    });

    return { success: true, programs };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      programs: [],
      error: `Kayıt defteri okunamadı: ${message}`
    };
  }
});

// 3. Gerçek Kaldırma İşlemi (Güvenli, doğrulanmış ve asenkron çıkış takibi)
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
    // Windows üzerinde doğrudan çalıştırma
    exec(commandToRun, { windowsHide: false }, (error, stdout, stderr) => {
      if (error) {
        // Hata kodu 3010: Yeniden başlatma gerekiyor (Reboot Required) - MSI standardında başarılı kabul edilir
        if (error.code === 3010) {
          resolve({
            success: true,
            exitCode: 3010,
            message: 'Kaldırma tamamlandı (Sistemin yeniden başlatılması gerekebilir).'
          });
          return;
        }

        resolve({
          success: false,
          exitCode: error.code || -1,
          error: `Kaldırıcı işlem hatayla sonlandı (Çıkış kodu: ${error.code ?? 'Bilinmiyor'}). ${error.message}`
        });
        return;
      }

      resolve({
        success: true,
        exitCode: 0,
        message: 'Program başarıyla sistemden kaldırıldı.'
      });
    });
  });
});

// 4. Güvenli Kalıntı Arama (Yalnızca doğrulanmış hedefler, varsayılan false seçim)
ipcMain.handle('leftovers:scan', async (_event, args: { appId: string; options?: LeftoverScanOptions }): Promise<LeftoverScanResult> => {
  const { appId, options } = args;
  const program = cachedProgramsMap.get(appId);
  if (!program) {
    return {
      success: false,
      items: [],
      error: 'Uygulama önbellekte bulunamadı.'
    };
  }

  const scanAppData = options?.scanAppData !== false;
  const scanRegistry = options?.scanRegistry !== false;

  const appName = program.displayName.trim();
  const publisher = program.publisher?.trim() || '';

  // Aday isim varyasyonları
  const cleanName = appName.replace(/\s*\(.*?\)\s*/g, '').replace(/version\s*[\d.]+/gi, '').trim();
  const searchTerms = Array.from(new Set([cleanName, appName])).filter((t) => t.length >= 3);

  const foundCandidates: LeftoverItem[] = [];
  cachedLeftoversMap.clear();
  let candidateIndex = 0;

  // A. Dosya Sistemi Taraması (%AppData%, %LocalAppData%, C:\ProgramData)
  if (scanAppData && process.platform === 'win32') {
    const scopes: Array<{ envPath: string | undefined; scope: LeftoverItem['targetScope'] }> = [
      { envPath: process.env.APPDATA, scope: '%AppData%' },
      { envPath: process.env.LOCALAPPDATA, scope: '%LocalAppData%' },
      { envPath: process.env.ALLUSERSPROFILE || 'C:\\ProgramData', scope: 'C:\\ProgramData' }
    ];

    for (const { envPath, scope } of scopes) {
      if (!envPath || !fs.existsSync(envPath)) continue;

      for (const term of searchTerms) {
        const potentialDirs = [
          path.join(envPath, term),
          publisher ? path.join(envPath, publisher, term) : null,
          publisher ? path.join(envPath, publisher) : null
        ].filter(Boolean) as string[];

        for (const dir of potentialDirs) {
          if (fs.existsSync(dir)) {
            const safety = isPathSafeToDelete(dir);
            if (safety.safe && !foundCandidates.some((c) => c.path.toLowerCase() === dir.toLowerCase())) {
              candidateIndex++;
              try {
                const stat = fs.statSync(dir);
                foundCandidates.push({
                  id: `leftover-${candidateIndex}`,
                  type: stat.isDirectory() ? 'folder' : 'file',
                  path: dir,
                  targetScope: scope,
                  sizeOrDetails: stat.isDirectory() ? 'Klasör ve alt dosyalar' : `${Math.round(stat.size / 1024)} KB`,
                  selected: false // Varsayılan olarak SEÇİLİ DEĞİL
                });
              } catch {
                // Okuma hatası olursa atla
              }
            }
          }
        }
      }
    }
  }

  // B. Registry Kalıntı Taraması (HKCU\Software ve HKLM\Software)
  if (scanRegistry && process.platform === 'win32') {
    const regRoots = [
      { hive: 'HKCU:\\Software', scope: 'HKCU\\Software' as const },
      { hive: 'HKLM:\\SOFTWARE', scope: 'HKLM\\Software' as const }
    ];

    for (const { hive, scope } of regRoots) {
      for (const term of searchTerms) {
        const testKeys = [
          `${hive}\\${term}`,
          publisher ? `${hive}\\${publisher}\\${term}` : null
        ].filter(Boolean) as string[];

        for (const regKey of testKeys) {
          try {
            const { stdout } = await runPowerShell(
              `if (Test-Path -LiteralPath ${toPowerShellLiteral(regKey)}) { Write-Output 'EXISTS' }`,
              1024 * 1024
            );
            if (stdout.includes('EXISTS')) {
              const cleanPath = regKey.replace('HKCU:\\', 'HKCU\\').replace('HKLM:\\', 'HKLM\\');
              const safety = isRegistryKeySafeToDelete(cleanPath);
              if (safety.safe && !foundCandidates.some((c) => c.path.toLowerCase() === cleanPath.toLowerCase())) {
                candidateIndex++;
                foundCandidates.push({
                  id: `leftover-${candidateIndex}`,
                  type: 'registry_key',
                  path: cleanPath,
                  targetScope: scope,
                  sizeOrDetails: 'Kayıt Defteri Anahtarı',
                  selected: false // Varsayılan olarak SEÇİLİ DEĞİL
                });
              }
            }
          } catch {
            // Anahtar yoksa veya sorgulanamazsa devam et
          }
        }
      }
    }
  }

  for (const candidate of foundCandidates) {
    cachedLeftoversMap.set(candidate.id, candidate);
  }

  return {
    success: true,
    items: foundCandidates,
    message: `${foundCandidates.length} adet güvenli kalıntı adayı tespit edildi.`
  };
});

// 5. Kalıntıları Silme (Her öğe bağımsız try-catch ile raporlanır, asla sistem dosyası silinmez)
ipcMain.handle('leftovers:delete', async (_event, args: { items: Array<Pick<LeftoverItem, 'id'>> }): Promise<LeftoverDeleteResult> => {
  const requestedItems = Array.isArray(args.items) ? args.items : [];
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
  if (requestedItems.length === 0) {
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
      const safety = isPathSafeToDelete(item.path);
      if (!safety.safe) {
        failedCount++;
        results.push({
          id: item.id,
          path: item.path,
          success: false,
          error: `Güvenlik Engeli: ${safety.reason}`
        });
        continue;
      }

      try {
        if (fs.existsSync(item.path)) {
          await fs.promises.rm(item.path, { recursive: true, force: true });
        }
        deletedCount++;
        results.push({ id: item.id, path: item.path, success: true });
      } catch (err: unknown) {
        failedCount++;
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ id: item.id, path: item.path, success: false, error: msg });
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
        continue;
      }

      try {
        // reg.exe delete "<Key>" /f ile anahtarı sil
        await execFileAsync('reg.exe', ['delete', item.path, '/f'], { windowsHide: true });
        deletedCount++;
        results.push({ id: item.id, path: item.path, success: true });
      } catch (err: unknown) {
        failedCount++;
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ id: item.id, path: item.path, success: false, error: msg });
      }
    }
  }

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
    return {
      success: false,
      supported: false,
      error: `Windows Sistem Koruması başarısız oldu (Devre dışı bırakılmış veya frekans sınırı aşılmış olabilir): ${message}`
    };
  }
});

// Electron Yaşam Döngüsü
app.whenReady().then(async () => {
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
