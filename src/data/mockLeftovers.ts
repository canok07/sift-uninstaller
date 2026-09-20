import { LeftoverItem } from '../types';

/**
 * Kaldırılan bir uygulamanın adına göre örnek gerçeğe uygun kalıntıları (leftovers) türetir.
 * Hedef taranan alanlar:
 * 1) %AppData% (Roaming)
 * 2) %LocalAppData% (Local)
 * 3) C:\ProgramData
 * 4) HKCU\Software
 * 5) HKLM\Software
 */
export function generateMockLeftovers(appName: string, publisher?: string): LeftoverItem[] {
  // Temizlenmiş ve arama için basitleştirilmiş isim
  // Örn: "Microsoft Visual Studio Code (User)" -> "Code" veya "Visual Studio Code"
  const cleanName = appName
    .replace(/\(.*?\)/g, '')
    .replace(/version\s+[\d.]+/gi, '')
    .replace(/v?[\d.]+/g, '')
    .trim();

  const folderName = cleanName.split(' ')[0] || 'App';
  const pubName = publisher ? publisher.split(' ')[0] : 'Vendor';

  const items: LeftoverItem[] = [
    // 1. %AppData% (Roaming)
    {
      id: 'appdata-1',
      type: 'folder',
      path: `C:\\Users\\Kullanici\\AppData\\Roaming\\${cleanName}`,
      targetScope: '%AppData%',
      sizeOrDetails: 'Klasör (Kullanıcı profili ve önbellek, ~14.2 MB)',
      selected: true
    },
    {
      id: 'appdata-2',
      type: 'file',
      path: `C:\\Users\\Kullanici\\AppData\\Roaming\\${cleanName}\\config.json`,
      targetScope: '%AppData%',
      sizeOrDetails: 'Yapılandırma Dosyası (28 KB)',
      selected: true
    },

    // 2. %LocalAppData% (Local)
    {
      id: 'localappdata-1',
      type: 'folder',
      path: `C:\\Users\\Kullanici\\AppData\\Local\\${cleanName}\\CrashDumps`,
      targetScope: '%LocalAppData%',
      sizeOrDetails: 'Klasör (Kilitlenme dökümleri ve telemetry, ~48.5 MB)',
      selected: true
    },
    {
      id: 'localappdata-2',
      type: 'folder',
      path: `C:\\Users\\Kullanici\\AppData\\Local\\Temp\\${cleanName}_installer.log`,
      targetScope: '%LocalAppData%',
      sizeOrDetails: 'Log Dosyası (312 KB)',
      selected: true
    },

    // 3. C:\ProgramData
    {
      id: 'programdata-1',
      type: 'folder',
      path: `C:\\ProgramData\\${pubName}\\${cleanName}`,
      targetScope: 'C:\\ProgramData',
      sizeOrDetails: 'Sistem Geneli Veri Klasörü (~8.7 MB)',
      selected: true
    },

    // 4. HKCU\Software
    {
      id: 'hkcu-1',
      type: 'registry_key',
      path: `HKEY_CURRENT_USER\\Software\\${cleanName}`,
      targetScope: 'HKCU\\Software',
      sizeOrDetails: 'Registry Anahtarı (6 alt anahtar, 18 dize değeri)',
      selected: true
    },
    {
      id: 'hkcu-2',
      type: 'registry_key',
      path: `HKEY_CURRENT_USER\\Software\\${pubName}\\${cleanName}`,
      targetScope: 'HKCU\\Software',
      sizeOrDetails: 'Registry Anahtarı (Kullanıcı Tercihleri)',
      selected: true
    },

    // 5. HKLM\Software
    {
      id: 'hklm-1',
      type: 'registry_key',
      path: `HKEY_LOCAL_MACHINE\\Software\\${pubName}\\${cleanName}`,
      targetScope: 'HKLM\\Software',
      sizeOrDetails: 'Registry Anahtarı (Sistem politikaları ve lisans izi)',
      selected: true
    },
    {
      id: 'hklm-2',
      type: 'registry_key',
      path: `HKEY_LOCAL_MACHINE\\Software\\WOW6432Node\\${cleanName}`,
      targetScope: 'HKLM\\Software',
      sizeOrDetails: '32-Bit Registry Uyumluluk Anahtarı',
      selected: true
    }
  ];

  return items;
}
