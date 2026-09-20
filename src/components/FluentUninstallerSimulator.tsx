import React, { useState, useEffect, useRef } from 'react';
import { 
  Trash2, 
  Package, 
  Sparkles, 
  Settings, 
  User, 
  Search, 
  SlidersHorizontal, 
  Check, 
  RotateCw, 
  AlertTriangle, 
  X, 
  ShieldCheck, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Sun, 
  Moon,
  Loader2,
  ShieldAlert,
  Info
} from 'lucide-react';
import { LeftoverCleanerModal } from './LeftoverCleanerModal';
import type { 
  InstalledProgram, 
  SystemInfo, 
  LeftoverItem, 
  RegistryHive 
} from '../types';

export interface FluentAppItem {
  id: string;
  name: string;
  iconBg: string;
  iconText: string;
  size: string;
  sizeBytes: number;
  publisher: string;
  uninstallString: string;
  registryKey: string;
  hive: RegistryHive;
  isReal?: boolean;
}

const DEMO_REGISTRY_APPS: FluentAppItem[] = [
  { 
    id: 'demo-1', 
    name: 'Google Chrome', 
    iconBg: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300', 
    iconText: '🌐', 
    size: '540 MB', 
    sizeBytes: 540 * 1024 * 1024,
    publisher: 'Google LLC',
    uninstallString: '"C:\\Program Files\\Google\\Chrome\\Application\\128.0.6613.120\\Installer\\setup.exe" --uninstall',
    registryKey: 'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Google Chrome',
    hive: 'HKCU',
    isReal: false
  },
  { 
    id: 'demo-2', 
    name: 'Microsoft Visual Studio Code', 
    iconBg: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300', 
    iconText: '💻', 
    size: '850 MB', 
    sizeBytes: 850 * 1024 * 1024,
    publisher: 'Microsoft Corporation',
    uninstallString: '"C:\\Users\\User\\AppData\\Local\\Programs\\Microsoft VS Code\\unins000.exe"',
    registryKey: 'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{F8A4A118-0E78-4384-B6E3-E5F64E3D857A}_is1',
    hive: 'HKCU',
    isReal: false
  },
  { 
    id: 'demo-3', 
    name: 'Spotify', 
    iconBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300', 
    iconText: '🎵', 
    size: '210 MB', 
    sizeBytes: 210 * 1024 * 1024,
    publisher: 'Spotify AB',
    uninstallString: '"C:\\Users\\User\\AppData\\Roaming\\Spotify\\Spotify.exe" /uninstall',
    registryKey: 'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Spotify',
    hive: 'HKCU',
    isReal: false
  },
  { 
    id: 'demo-4', 
    name: 'Git version 2.46.0', 
    iconBg: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300', 
    iconText: '📦', 
    size: '128 MB', 
    sizeBytes: 128 * 1024 * 1024,
    publisher: 'The Git Development Community',
    uninstallString: '"C:\\Program Files\\Git\\unins000.exe"',
    registryKey: 'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Git_is1',
    hive: 'HKLM',
    isReal: false
  },
  { 
    id: 'demo-5', 
    name: '7-Zip 24.08 (x64)', 
    iconBg: 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300', 
    iconText: '📁', 
    size: '5.2 MB', 
    sizeBytes: 5.2 * 1024 * 1024,
    publisher: 'Igor Pavlov',
    uninstallString: '"C:\\Program Files\\7-Zip\\Uninstall.exe"',
    registryKey: 'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\7-Zip',
    hive: 'HKLM',
    isReal: false
  },
  { 
    id: 'demo-6', 
    name: 'Discord', 
    iconBg: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300', 
    iconText: '💬', 
    size: '320 MB', 
    sizeBytes: 320 * 1024 * 1024,
    publisher: 'Discord Inc.',
    uninstallString: '"C:\\Users\\User\\AppData\\Local\\Discord\\Update.exe" --uninstall -s',
    registryKey: 'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Discord',
    hive: 'HKCU',
    isReal: false
  },
  { 
    id: 'demo-7', 
    name: 'Steam', 
    iconBg: 'bg-slate-200 text-slate-800 dark:bg-zinc-700 dark:text-zinc-200', 
    iconText: '🎮', 
    size: '1.4 GB', 
    sizeBytes: 1.4 * 1024 * 1024 * 1024,
    publisher: 'Valve Corporation',
    uninstallString: '"C:\\Program Files (x86)\\Steam\\uninstall.exe"',
    registryKey: 'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam',
    hive: 'WOW6432Node',
    isReal: false
  },
  { 
    id: 'demo-8', 
    name: 'Node.js (v20.15.1)', 
    iconBg: 'bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300', 
    iconText: '🟢', 
    size: '78 MB', 
    sizeBytes: 78 * 1024 * 1024,
    publisher: 'OpenJS Foundation',
    uninstallString: 'MsiExec.exe /I{455F5C8B-8DEB-41DE-8533-547B2AA9DCBD}',
    registryKey: 'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{455F5C8B-8DEB-41DE-8533-547B2AA9DCBD}',
    hive: 'HKLM',
    isReal: false
  }
];

interface FluentUninstallerSimulatorProps {
  onSwitchToCode?: (lang: 'pyqt5' | 'wpf') => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const FluentUninstallerSimulator: React.FC<FluentUninstallerSimulatorProps> = ({ 
  isDarkMode = false,
  onToggleDarkMode
}) => {
  const isMountedRef = useRef(true);
  const timeoutIdsRef = useRef<number[]>([]);

  const safeSetTimeout = (callback: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      if (isMountedRef.current) {
        callback();
      }
    }, ms);
    timeoutIdsRef.current.push(id);
    return id;
  };

  const isElectronEnvironment = typeof window !== 'undefined' && Boolean(window.api?.isElectron);

  const [apps, setApps] = useState<FluentAppItem[]>(() => isElectronEnvironment ? [] : DEMO_REGISTRY_APPS);
  const [isLoadingRegistry, setIsLoadingRegistry] = useState(false);
  const [isElectronConnected, setIsElectronConnected] = useState(isElectronEnvironment);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [registryReadError, setRegistryReadError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAppId, setSelectedAppId] = useState<string | null>(() => isElectronEnvironment ? null : 'demo-1');

  // Filtreleme (Dropdown menüsü)
  const [filterType, setFilterType] = useState<'ALL' | 'HKLM' | 'HKCU' | 'LARGE'>('ALL');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // Derin Temizlik State'leri (Alt Panel)
  const [isScanning, setIsScanning] = useState(false);
  const [progressValue, setProgressValue] = useState<number>(0);
  const [panelStatus, setPanelStatus] = useState<string>('Hazır - Bir program seçip "Derin Temizlik" yapabilirsiniz.');
  const [panelTitle, setPanelTitle] = useState<string>('Gelişmiş Temizleme Paneli');
  const [foundFilesCount, setFoundFilesCount] = useState<number>(0);
  const [foundRegCount, setFoundRegCount] = useState<number>(0);
  const [canClean, setCanClean] = useState(false);

  // Kalıntı Temizleyici Modal State'leri
  const [isLeftoverModalOpen, setIsLeftoverModalOpen] = useState(false);
  const [leftoverTargetAppName, setLeftoverTargetAppName] = useState<string>('');
  const [scannedLeftoverItems, setScannedLeftoverItems] = useState<LeftoverItem[]>([]);

  // Aktif Kaldırma İşlemi (Satır kilidi ve asenkron takip)
  const [activeUninstallingAppId, setActiveUninstallingAppId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ text: string; type: 'info' | 'success' | 'process' | 'error' } | null>(null);

  // Modal Dialog State'leri
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [confirmUninstallApp, setConfirmUninstallApp] = useState<FluentAppItem | null>(null);

  // Dark Mode
  const [localDarkMode, setLocalDarkMode] = useState(isDarkMode);
  useEffect(() => {
    setLocalDarkMode(isDarkMode);
  }, [isDarkMode]);

  const handleToggleTheme = () => {
    if (onToggleDarkMode) {
      onToggleDarkMode();
    } else {
      setLocalDarkMode((prev) => !prev);
    }
  };

  const dark = onToggleDarkMode ? isDarkMode : localDarkMode;

  // Ayarlar Seçenekleri
  const [settingCreateRestorePoint, setSettingCreateRestorePoint] = useState(true);
  const [settingScanRegistry, setSettingScanRegistry] = useState(true);
  const [settingScanAppData, setSettingScanAppData] = useState(true);
  const [settingSilentUninstall, setSettingSilentUninstall] = useState(false);

  // Sıralama (Sort)
  const [sortField, setSortField] = useState<'name' | 'size' | 'publisher'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Temizlik ve unmount koruması
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      timeoutIdsRef.current.forEach((id) => window.clearTimeout(id));
      timeoutIdsRef.current = [];
    };
  }, []);

  // Dışarı tıklanınca filtre menüsünü kapat
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setIsFilterMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Sistem Bilgisi ve Registry'i Başlangıçta Oku
  useEffect(() => {
    async function initSystemAndRegistry() {
      if (typeof window !== 'undefined' && window.api && window.api.isElectron) {
        setIsElectronConnected(true);
        try {
          if (typeof window.api.getSystemInfo === 'function') {
            const info = await window.api.getSystemInfo();
            if (isMountedRef.current) {
              setSystemInfo(info);
            }
          }
        } catch (err: unknown) {
          console.warn('Sistem bilgisi alınamadı:', err);
        }

        await fetchProgramsFromRegistry();
      } else {
        // Tarayıcı Demo ortamı
        setIsElectronConnected(false);
        setSystemInfo({
          isWindows: false,
          isElevated: false,
          platform: 'browser-web',
          osVersion: 'Browser Preview'
        });
      }
    }

    initSystemAndRegistry();
  }, []);

  // Registry'den Program Listesini Okuma Fonksiyonu
  const fetchProgramsFromRegistry = async () => {
    if (!window.api || !window.api.isElectron || typeof window.api.getInstalledPrograms !== 'function') {
      return;
    }

    setIsLoadingRegistry(true);
    setRegistryReadError(null);
    setNotification({ text: 'Windows Registry (HKLM, WOW6432Node, HKCU) taranıyor...', type: 'process' });

    try {
      const result = await window.api.getInstalledPrograms();
      if (!isMountedRef.current) return;

      if (result.success) {
        const iconColors = [
          'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
          'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300',
          'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
          'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
          'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
          'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
        ];

        const mapped: FluentAppItem[] = result.programs.map((p: InstalledProgram, index: number) => {
          const firstLetter = p.displayName ? p.displayName.trim().charAt(0).toUpperCase() : '📦';
          const sizeInBytes = p.estimatedSize ? p.estimatedSize * 1024 : 0;
          return {
            id: p.id,
            name: p.displayName,
            iconBg: iconColors[index % iconColors.length],
            iconText: firstLetter,
            size: p.sizeFormatted || (sizeInBytes > 0 ? `${Math.round(sizeInBytes / (1024 * 1024))} MB` : 'Belirtilmemiş'),
            sizeBytes: sizeInBytes,
            publisher: p.publisher || 'Bilinmeyen Yayıncı',
            uninstallString: p.uninstallString || '',
            registryKey: p.registryKey || '',
            hive: p.registryHive || 'HKLM',
            isReal: true
          };
        });

        setApps(mapped);
        if (mapped.length > 0) {
          setSelectedAppId(mapped[0].id);
        } else {
          setSelectedAppId(null);
        }

        setNotification({ 
          text: `Kayıt defterinden ${mapped.length} geçerli kurulu program yüklendi.`, 
          type: 'success' 
        });
        safeSetTimeout(() => setNotification(null), 3500);
      } else {
        // Hata durumunda sahte veri ile maskeleme YAPMA!
        setApps([]);
        setSelectedAppId(null);
        setRegistryReadError(result.error || 'Kayıt defteri okunamadı.');
        setNotification({ 
          text: `Registry okunamadı: ${result.error || 'Bilinmeyen hata'}`, 
          type: 'error' 
        });
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      const msg = err instanceof Error ? err.message : String(err);
      setApps([]);
      setSelectedAppId(null);
      setRegistryReadError(msg);
      setNotification({ text: `Hata: ${msg}`, type: 'error' });
    } finally {
      if (isMountedRef.current) {
        setIsLoadingRegistry(false);
      }
    }
  };

  const handleSort = (field: 'name' | 'size' | 'publisher') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Arama ve Filtreleme
  const filteredApps = apps
    .filter((app) => {
      const matchQuery = 
        app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.publisher.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.registryKey.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchQuery) return false;

      if (filterType === 'HKLM') return app.hive === 'HKLM' || app.hive === 'WOW6432Node';
      if (filterType === 'HKCU') return app.hive === 'HKCU';
      if (filterType === 'LARGE') return app.sizeBytes >= 500 * 1024 * 1024;
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name, 'tr', { sensitivity: 'base' });
      } else if (sortField === 'size') {
        comparison = a.sizeBytes - b.sizeBytes;
      } else if (sortField === 'publisher') {
        comparison = a.publisher.localeCompare(b.publisher, 'tr', { sensitivity: 'base' });
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const selectedApp = apps.find((a) => a.id === selectedAppId);

  // Uygulamaları Yenile
  const handleReloadApps = async () => {
    if (isElectronEnvironment) {
      await fetchProgramsFromRegistry();
    } else {
      setNotification({ text: 'Demo verileri sıfırlanıyor...', type: 'process' });
      safeSetTimeout(() => {
        setApps(DEMO_REGISTRY_APPS);
        setSelectedAppId('demo-1');
        setFilterType('ALL');
        setNotification({ text: 'Demo program listesi yüklendi.', type: 'success' });
        safeSetTimeout(() => setNotification(null), 2500);
      }, 400);
    }
  };

  // Kaldırma Onay Modalını Aç
  const promptUninstall = (app: FluentAppItem) => {
    if (activeUninstallingAppId) {
      setNotification({ 
        text: 'Zaten arka planda bir kaldırma işlemi yürütülüyor. Lütfen tamamlanmasını bekleyin.', 
        type: 'error' 
      });
      return;
    }
    setConfirmUninstallApp(app);
  };

  // GERÇEK KALDIRMA İŞLEMİ (Electron IPC)
  const executeUninstall = async (app: FluentAppItem) => {
    setConfirmUninstallApp(null);
    setActiveUninstallingAppId(app.id);

    // 1. Geri yükleme noktası isteği varsa dene
    if (settingCreateRestorePoint) {
      if (isElectronEnvironment && window.api?.createRestorePoint) {
        setNotification({ text: `'${app.name}' için Windows Sistem Geri Yükleme Noktası oluşturuluyor...`, type: 'process' });
        try {
          const rp = await window.api.createRestorePoint(`SiftUninstaller - ${app.name}`);
          if (!rp.success) {
            // Gerçeği bildir, sahte başarı üretme
            setNotification({ 
              text: `Geri yükleme noktası uyarısı: ${rp.error || 'Sistem Koruması devre dışı'}. Kaldırmaya devam ediliyor...`, 
              type: 'info' 
            });
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn('Restore point error:', msg);
        }
      }
    }

    setNotification({
      text: `'${app.name}' kaldırıcı süreci çalıştırıldı. Çıkış kodu bekleniyor...`,
      type: 'process'
    });

    // 2. Gerçek Electron IPC üzerinden çalıştırma
    if (isElectronEnvironment && window.api?.uninstallProgram) {
      try {
        const result = await window.api.uninstallProgram(app.id, { silent: settingSilentUninstall });

        if (!isMountedRef.current) return;
        setActiveUninstallingAppId(null);

        if (result.success) {
          // Başarılı: Listeden kaldır
          setApps((prev) => prev.filter((a) => a.id !== app.id));
          if (selectedAppId === app.id) setSelectedAppId(null);

          setNotification({
            text: `'${app.name}' başarıyla kaldırıldı (Çıkış kodu: ${result.exitCode ?? 0}). Kalıntı taraması başlatılıyor...`,
            type: 'success'
          });

          // Otomatik kalıntı taraması başlat
          triggerDeepClean(app);
        } else {
          // Başarısız: Kesinlikle listeden SİLME, hata mesajını göster
          setNotification({
            text: `Kaldırma başarısız oldu: ${result.error || 'İşlem hatayla sonlandı'}. Program listede tutuldu.`,
            type: 'error'
          });
        }
      } catch (err: unknown) {
        if (!isMountedRef.current) return;
        setActiveUninstallingAppId(null);
        const msg = err instanceof Error ? err.message : String(err);
        setNotification({
          text: `Kaldırma sürecinde beklenmeyen hata: ${msg}`,
          type: 'error'
        });
      }
    } else {
      // Tarayıcı Önizleme / Demo Modu Simülasyonu
      safeSetTimeout(() => {
        if (!isMountedRef.current) return;
        setActiveUninstallingAppId(null);
        setApps((prev) => prev.filter((a) => a.id !== app.id));
        if (selectedAppId === app.id) setSelectedAppId(null);
        setNotification({
          text: `[Demo Modu] '${app.name}' arayüzden kaldırıldı. Kalıntı taraması başlatılıyor...`,
          type: 'success'
        });
        triggerDeepClean(app);
      }, 1500);
    }
  };

  // Gelişmiş Kalıntı Arama (Hem alt panel hem modal için)
  const triggerDeepClean = async (targetApp: FluentAppItem) => {
    setIsScanning(true);
    setPanelTitle(`Gelişmiş Temizlik: '${targetApp.name}'`);
    setPanelStatus('Doğrulanmış aday kalıntılar taranıyor (%AppData%, %LocalAppData%, C:\\ProgramData, Registry)...');
    setProgressValue(20);
    setCanClean(false);
    setFoundFilesCount(0);
    setFoundRegCount(0);

    if (isElectronEnvironment && window.api?.scanLeftovers) {
      try {
        setProgressValue(50);
        const scanRes = await window.api.scanLeftovers(targetApp.id, {
          scanAppData: settingScanAppData,
          scanRegistry: settingScanRegistry
        });

        if (!isMountedRef.current) return;

        setProgressValue(100);
        setIsScanning(false);

        if (scanRes.success && scanRes.items.length > 0) {
          const files = scanRes.items.filter((i) => i.type === 'folder' || i.type === 'file').length;
          const regs = scanRes.items.filter((i) => i.type === 'registry_key').length;
          setFoundFilesCount(files);
          setFoundRegCount(regs);
          setCanClean(true);
          setPanelStatus(`${files} dosya/klasör ve ${regs} kayıt defteri kalıntı adayı bulundu.`);
          setScannedLeftoverItems(scanRes.items);
          setLeftoverTargetAppName(targetApp.name);
          // Kullanıcı onayı için modalı aç
          setIsLeftoverModalOpen(true);
        } else {
          setCanClean(false);
          setPanelStatus('Kalıntı bulunamadı. Sistem temiz görünüyor.');
          setNotification({ text: `'${targetApp.name}' için ek kalıntı tespit edilmedi.`, type: 'info' });
          safeSetTimeout(() => setNotification(null), 3000);
        }
      } catch (err: unknown) {
        if (!isMountedRef.current) return;
        setIsScanning(false);
        const msg = err instanceof Error ? err.message : String(err);
        setPanelStatus(`Tarama hatası: ${msg}`);
      }
    } else {
      // Demo ortamı için temsili güvenli örnekler (seçilmemiş olarak)
      safeSetTimeout(() => {
        if (!isMountedRef.current) return;
        setProgressValue(100);
        setIsScanning(false);
        const demoItems: LeftoverItem[] = [
          {
            id: 'demo-leftover-1',
            type: 'folder',
            path: `C:\\Users\\User\\AppData\\Local\\${targetApp.name.replace(/\s+/g, '')}`,
            targetScope: '%LocalAppData%',
            sizeOrDetails: '14.2 MB (42 dosya)',
            selected: false // Varsayılan olarak SEÇİLİ DEĞİL
          },
          {
            id: 'demo-leftover-2',
            type: 'folder',
            path: `C:\\Users\\User\\AppData\\Roaming\\${targetApp.name.replace(/\s+/g, '')}`,
            targetScope: '%AppData%',
            sizeOrDetails: '2.1 MB',
            selected: false
          },
          {
            id: 'demo-leftover-3',
            type: 'registry_key',
            path: `HKCU\\Software\\${targetApp.name.replace(/\s+/g, '')}`,
            targetScope: 'HKCU\\Software',
            sizeOrDetails: 'Kayıt Defteri Anahtarı',
            selected: false
          }
        ];

        setFoundFilesCount(2);
        setFoundRegCount(1);
        setCanClean(true);
        setPanelStatus('2 dosya/klasör ve 1 kayıt defteri kalıntı adayı bulundu.');
        setScannedLeftoverItems(demoItems);
        setLeftoverTargetAppName(targetApp.name);
        setIsLeftoverModalOpen(true);
      }, 700);
    }
  };

  // Alt Paneldeki "Kalıntıyı Temizle" Butonuna Basıldığında
  const handleOpenLeftoverModalFromPanel = () => {
    if (scannedLeftoverItems.length > 0) {
      setIsLeftoverModalOpen(true);
    } else if (selectedApp) {
      triggerDeepClean(selectedApp);
    }
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#f8fafc] dark:bg-black text-slate-800 dark:text-zinc-100 rounded-none border-0 overflow-hidden font-sans relative transition-colors duration-200">
      
      {/* Windows 11 Pencere Çerçevesi Üst Başlık Çubuğu */}
      <div className="bg-white/95 dark:bg-[#16181C]/95 backdrop-blur px-4 py-2.5 flex items-center border-b border-slate-200 dark:border-zinc-800 select-none shrink-0 transition-colors duration-200">
        <div className="flex items-center space-x-2.5">
          <div className="w-4 h-4 rounded-md bg-sky-500 flex items-center justify-center text-[10px] text-white font-bold shadow-sm">
            U
          </div>
          <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 tracking-tight">
            Sift Uninstaller
          </span>
          {isElectronConnected ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-medium flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Windows Desktop • Registry Aktif
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700 font-medium flex items-center gap-1" title="Gerçek Windows Registry için masaüstü Electron sürümünü başlatın">
              <Info className="w-3 h-3" />
              Demo Modu (Tarayıcı Önizleme)
            </span>
          )}
        </div>

      </div>

      {/* Tarayıcıda Açıkça Belirtilen Demo Modu Bilgilendirme Şeridi */}
      {!isElectronConnected && (
        <div className="bg-amber-500/10 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/50 px-4 py-2 text-xs flex items-center justify-between text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Demo Modu:</strong> Şu anda web tarayıcısında çalışıyorsunuz. Gösterilen veriler temsilidir. Windows Registry (HKLM, HKCU, WOW6432Node) üzerinden gerçek programları listelemek ve kaldırmak için masaüstü Electron sürümünü (<code>npm run electron:dev</code> veya Setup.exe) başlatın.
            </span>
          </div>
          <span className="hidden md:inline-block text-[10px] px-2 py-0.5 rounded bg-amber-200/70 dark:bg-amber-900/60 font-medium text-amber-900 dark:text-amber-200 shrink-0 ml-2">
            Tarayıcı Önizleme
          </span>
        </div>
      )}

      {/* Canlı İşlem ve Bildirim Rozeti */}
      {notification && (
        <div className={`px-4 py-2.5 flex items-center justify-between text-xs transition-all border-b ${
          notification.type === 'process'
            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-900/50'
            : notification.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-900/50'
            : notification.type === 'error'
            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border-rose-200 dark:border-rose-900/50'
            : 'bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200 border-sky-100 dark:border-sky-900/50'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'process' ? (
              <RotateCw className="w-3.5 h-3.5 animate-spin text-amber-600 dark:text-amber-400 shrink-0" />
            ) : notification.type === 'error' ? (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
            ) : (
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            )}
            <span className="font-medium">{notification.text}</span>
          </div>
          <button 
            onClick={() => setNotification(null)} 
            className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 cursor-pointer ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Ana Gövde */}
      <div className="p-5 sm:p-6 flex-1 flex flex-col space-y-4 overflow-hidden bg-slate-50/50 dark:bg-black">
        {/* ========================================================================= */}
        {/* 1. ÜST EYLEM ÇUBUĞU (ACTION BAR)                                         */}
        {/* ========================================================================= */}
        <div className="bg-white dark:bg-[#16181C] p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
          {/* Sol Taraf: Butonlar */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* "Programı Kaldır" butonu */}
            <button
              onClick={() => {
                if (selectedApp) {
                  promptUninstall(selectedApp);
                } else {
                  setNotification({ text: 'Lütfen tablodan kaldırmak istediğiniz bir programı seçin.', type: 'error' });
                }
              }}
              disabled={activeUninstallingAppId !== null || !selectedApp}
              className="px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-sky-100 hover:bg-sky-200 dark:bg-sky-950/60 dark:hover:bg-sky-900/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 flex items-center gap-2 transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Seçili programı güvenli şekilde kaldır"
            >
              <Trash2 className="w-4 h-4 text-sky-700 dark:text-sky-400" />
              <span>Programı Kaldır</span>
              {selectedApp && (
                <span className="hidden lg:inline text-[11px] font-normal bg-white/70 dark:bg-zinc-800/70 px-1.5 py-0.5 rounded text-sky-900 dark:text-sky-200 ml-1">
                  ({selectedApp.name.substring(0, 14)}...)
                </span>
              )}
            </button>

            {/* "Uygulamalar" (Registry Yeniden Tara) butonu */}
            <button
              onClick={handleReloadApps}
              disabled={isLoadingRegistry}
              className="px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              title="Registry'den kurulu programları yeniden tara ve yükle"
            >
              <Package className={`w-4 h-4 text-slate-500 dark:text-zinc-400 ${isLoadingRegistry ? 'animate-spin' : ''}`} />
              <span>Uygulamalar</span>
            </button>

            {/* "Derin Temizlik" butonu */}
            <button
              onClick={() => {
                const target = selectedApp || apps[0];
                if (target) {
                  triggerDeepClean(target);
                } else {
                  setNotification({ text: 'Temizlenecek bir program seçiniz.', type: 'error' });
                }
              }}
              disabled={isScanning || apps.length === 0}
              className="px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              title="Artık dosyaları ve kayıt defteri kalıntılarını tara"
            >
              <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              <span>Derin Temizlik</span>
            </button>
          </div>

          {/* Sağ Taraf: Tema, Ayarlar ve Profil */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Gece/Gündüz Modu İkon Butonu */}
            <button
              onClick={handleToggleTheme}
              className="w-9 h-9 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 flex items-center justify-center transition-all cursor-pointer border border-slate-200/60 dark:border-zinc-700 active:scale-95 shadow-sm"
              title={dark ? 'Açık Moda Geç' : 'Gece Moduna Geç (Twitter Siyahı)'}
            >
              {dark ? (
                <Sun className="w-4 h-4 text-amber-400 transition-transform rotate-0 hover:rotate-45" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600 transition-transform -rotate-12 hover:rotate-0" />
              )}
            </button>

            {/* Ayarlar Çark İkonu */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="w-9 h-9 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 flex items-center justify-center transition-colors cursor-pointer border border-slate-200/60 dark:border-zinc-700"
              title="Gelişmiş Yapılandırma Ayarları"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Profil ve Yetki Butonu */}
            <button
              onClick={() => setIsProfileOpen(true)}
              className="w-9 h-9 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 flex items-center justify-center transition-colors cursor-pointer border border-slate-200/60 dark:border-zinc-700"
              title="Yönetici Yetkisi ve Sistem Durumu"
            >
              <User className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. ARAMA VE FİLTRE ÇUBUĞU (SEARCH BAR)                                     */}
        {/* ========================================================================= */}
        <div className="relative">
          <div className="w-full bg-white dark:bg-[#16181C] px-4 py-2.5 rounded-full border border-slate-200/80 dark:border-zinc-800 shadow-sm flex items-center gap-3">
            <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Program veya yayıncı ara (örn: Chrome, Visual Studio, Discord...)"
              className="w-full bg-transparent border-none outline-none text-xs sm:text-sm text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 font-sans"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer font-medium"
              >
                Temizle
              </button>
            )}

            {/* Filtre Dropdown Butonu */}
            <div className="relative" ref={filterDropdownRef}>
              <button
                onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors shrink-0 cursor-pointer ${
                  filterType !== 'ALL'
                    ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800'
                    : 'bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300'
                }`}
                title="Filtreleme Seçenekleri"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                <span>
                  {filterType === 'ALL' && 'Filtrele'}
                  {filterType === 'HKLM' && 'Sistem (HKLM)'}
                  {filterType === 'HKCU' && 'Kullanıcı (HKCU)'}
                  {filterType === 'LARGE' && '> 500 MB'}
                </span>
              </button>

              {/* Filtre Menüsü */}
              {isFilterMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#16181C] border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl z-20 py-1.5 text-xs">
                  <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                    Kayıt Defteri Kökü
                  </div>
                  <button
                    onClick={() => { setFilterType('ALL'); setIsFilterMenuOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-zinc-800/60 ${filterType === 'ALL' ? 'text-sky-600 dark:text-sky-400 font-semibold' : 'text-slate-700 dark:text-zinc-300'}`}
                  >
                    <span>Tüm Programlar</span>
                    {filterType === 'ALL' && <Check className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => { setFilterType('HKLM'); setIsFilterMenuOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-zinc-800/60 ${filterType === 'HKLM' ? 'text-sky-600 dark:text-sky-400 font-semibold' : 'text-slate-700 dark:text-zinc-300'}`}
                  >
                    <span>Sistem (HKLM)</span>
                    {filterType === 'HKLM' && <Check className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => { setFilterType('HKCU'); setIsFilterMenuOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-zinc-800/60 ${filterType === 'HKCU' ? 'text-sky-600 dark:text-sky-400 font-semibold' : 'text-slate-700 dark:text-zinc-300'}`}
                  >
                    <span>Kullanıcı (HKCU)</span>
                    {filterType === 'HKCU' && <Check className="w-3.5 h-3.5" />}
                  </button>
                  <div className="border-t border-slate-100 dark:border-zinc-800 my-1" />
                  <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                    Boyut Filtresi
                  </div>
                  <button
                    onClick={() => { setFilterType('LARGE'); setIsFilterMenuOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-zinc-800/60 ${filterType === 'LARGE' ? 'text-sky-600 dark:text-sky-400 font-semibold' : 'text-slate-700 dark:text-zinc-300'}`}
                  >
                    <span>Büyük Dosyalar (&gt; 500 MB)</span>
                    {filterType === 'LARGE' && <Check className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. ANA LİSTE (DATA GRID / TABLE - 4 SÜTUN)                                */}
        {/* ========================================================================= */}
        <div className="flex-1 bg-white dark:bg-[#16181C] rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/70 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider sticky top-0 bg-white/95 dark:bg-[#16181C]/95 backdrop-blur z-10 select-none">
                  <th 
                    className="py-3 px-5 cursor-pointer hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Uygulama Adı</span>
                      {sortField === 'name' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300 dark:text-zinc-600 opacity-60" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="py-3 px-5 text-right cursor-pointer hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                    onClick={() => handleSort('size')}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Boyut</span>
                      {sortField === 'size' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300 dark:text-zinc-600 opacity-60" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="py-3 px-5 cursor-pointer hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                    onClick={() => handleSort('publisher')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Geliştirici/Şirket</span>
                      {sortField === 'publisher' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300 dark:text-zinc-600 opacity-60" />
                      )}
                    </div>
                  </th>
                  <th className="py-3 px-5 text-right">Eylemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80 text-xs sm:text-sm">
                {isLoadingRegistry ? (
                  <tr>
                    <td colSpan={4} className="py-16 text-center text-slate-400 dark:text-zinc-500">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <Loader2 className="w-7 h-7 animate-spin text-sky-500" />
                        <p className="font-medium text-slate-700 dark:text-zinc-300">Windows Kayıt Defteri taranıyor...</p>
                        <p className="text-xs text-slate-400 dark:text-zinc-500">HKLM, WOW6432Node ve HKCU uninstall anahtarları çözümleniyor.</p>
                      </div>
                    </td>
                  </tr>
                ) : registryReadError ? (
                  <tr>
                    <td colSpan={4} className="py-14 text-center">
                      <div className="flex flex-col items-center justify-center space-y-2 text-rose-600 dark:text-rose-400">
                        <AlertTriangle className="w-8 h-8" />
                        <p className="font-semibold text-sm">Kayıt Defteri Okunamadı</p>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md">{registryReadError}</p>
                        <button
                          onClick={handleReloadApps}
                          className="mt-2 px-4 py-2 bg-sky-500 text-white rounded-xl text-xs font-semibold hover:bg-sky-600 transition-colors cursor-pointer"
                        >
                          Yeniden Dene
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : filteredApps.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Search className="w-6 h-6 text-slate-300 dark:text-zinc-600" />
                        <p>Kurulu program bulunamadı veya arama kriterine uymuyor.</p>
                        {filterType !== 'ALL' && (
                          <button
                            onClick={() => setFilterType('ALL')}
                            className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-medium cursor-pointer"
                          >
                            Filtreyi Sıfırla
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredApps.map((app) => {
                    const isSelected = selectedAppId === app.id;
                    const isUninstalling = activeUninstallingAppId === app.id;

                    return (
                      <tr
                        key={app.id}
                        onClick={() => setSelectedAppId(app.id)}
                        className={`group transition-colors cursor-pointer select-none ${
                          isSelected
                            ? 'bg-sky-50/80 dark:bg-zinc-800/80 text-sky-950 dark:text-zinc-100 font-medium'
                            : 'hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 text-slate-700 dark:text-zinc-300'
                        } ${isUninstalling ? 'opacity-60 bg-amber-50/50 dark:bg-amber-950/20' : ''}`}
                      >
                        {/* 1. Sütun: Uygulama Adı */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 ${app.iconBg}`}>
                              {app.iconText}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                                <span>{app.name}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-normal ${
                                  app.hive === 'HKCU' 
                                    ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60' 
                                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700'
                                }`}>
                                  {app.hive}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono hidden md:block">
                                {app.registryKey.substring(0, 48)}...
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Sütun: Boyut */}
                        <td className="py-3.5 px-5 text-right font-mono text-slate-500 dark:text-zinc-400">
                          {app.size}
                        </td>

                        {/* 3. Sütun: Geliştirici/Şirket */}
                        <td className="py-3.5 px-5 text-slate-600 dark:text-zinc-300">
                          {app.publisher}
                        </td>

                        {/* 4. Sütun: Eylemler */}
                        <td className="py-3.5 px-5 text-right">
                          {isUninstalling ? (
                            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-xs">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Kaldırılıyor...</span>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                promptUninstall(app);
                              }}
                              disabled={activeUninstallingAppId !== null}
                              className="p-2 rounded-lg text-slate-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all opacity-70 group-hover:opacity-100 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                              title={`${app.name} uygulamasını kaldır`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. GELİŞMİŞ TEMİZLEME PANELİ (BOTTOM PANEL)                               */}
        {/* ========================================================================= */}
        <div className="bg-white dark:bg-[#16181C] p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Sol Kısım: Başlık, Durum ve Progress Bar */}
          <div className="w-full sm:flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-zinc-100">
                {panelTitle}
              </span>
              <span className="text-xs font-mono text-slate-500 dark:text-zinc-400">
                {isScanning ? `Tarama: %${progressValue}` : panelStatus}
              </span>
            </div>

            {/* İlerleme Çubuğu */}
            <div className="w-full bg-slate-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden border border-slate-200/60 dark:border-zinc-700/60">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  progressValue === 100 ? 'bg-emerald-500' : 'bg-sky-500'
                }`}
                style={{ width: `${progressValue}%` }}
              />
            </div>
          </div>

          {/* Sağ Kısım: "Kalıntıyı Temizle" Butonu */}
          <button
            onClick={handleOpenLeftoverModalFromPanel}
            disabled={!canClean}
            className={`w-full sm:w-auto px-6 py-2.5 font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 shrink-0 ${
              canClean
                ? 'bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white shadow-sky-500/20 cursor-pointer'
                : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 border border-slate-200 dark:border-zinc-700 cursor-not-allowed'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {canClean
                ? `Kalıntıları İncele ve Sil (${foundFilesCount + foundRegCount})`
                : 'Kalıntıyı Temizle'}
            </span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* 5. ALT BİLGİ ÇUBUĞU (STATUS BAR)                                          */}
        {/* ========================================================================= */}
        <div className="pt-2 pb-1 border-t border-slate-200/80 dark:border-zinc-800 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 select-none">
          <div className="flex items-center gap-3">
            <span>Toplam Program: <strong className="text-slate-800 dark:text-zinc-200">{apps.length}</strong></span>
            <span>•</span>
            <span className="text-slate-500 dark:text-zinc-400 hidden sm:inline">
              Filtrelenen: <strong className="text-slate-700 dark:text-zinc-300">{filteredApps.length}</strong>
            </span>
            <span>•</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              {isElectronConnected ? 'Windows Native Entegrasyon' : 'Tarayıcı Demo Modu'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span>Sift Uninstaller © 2026</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: KALDIRMA ONAY DİALOGU                                            */}
      {/* ========================================================================= */}
      {confirmUninstallApp && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#16181C] rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100">Programı Kaldır</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Orijinal sistem kaldırıcı çalıştırılacak</p>
                </div>
              </div>
              <button 
                onClick={() => setConfirmUninstallApp(null)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-black p-3 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs space-y-2">
              <div className="font-semibold text-slate-800 dark:text-zinc-100">{confirmUninstallApp.name}</div>
              <div className="text-slate-500 dark:text-zinc-400">Yayıncı: {confirmUninstallApp.publisher} • Boyut: {confirmUninstallApp.size}</div>
              <div className="font-mono text-[11px] text-slate-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 p-2 rounded border border-slate-200 dark:border-zinc-800 overflow-x-auto break-all">
                {confirmUninstallApp.uninstallString || 'Doğrudan kaldırma komutu'}
              </div>
            </div>

            <div className="text-xs text-slate-500 dark:text-zinc-400 space-y-1">
              <p>• Kaldırıcı işlem sonlanana kadar uygulama penceresi durumu izleyecek.</p>
              {settingSilentUninstall && (
                <p className="text-sky-600 dark:text-sky-400 font-medium">• Sessiz kaldırma aktif (desteklenen MSI/Inno/NSIS için).</p>
              )}
              {settingCreateRestorePoint && (
                <p className="text-emerald-600 dark:text-emerald-400">• Kaldırma öncesi Sistem Geri Yükleme noktası oluşturulacak.</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <button
                onClick={() => setConfirmUninstallApp(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                onClick={() => executeUninstall(confirmUninstallApp)}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer"
              >
                Kaldırıcıyı Başlat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: KALINTI TEMİZLEME DİALOGU                                        */}
      {/* ========================================================================= */}
      {isLeftoverModalOpen && (
        <LeftoverCleanerModal
          appName={leftoverTargetAppName}
          initialItems={scannedLeftoverItems}
          onClose={() => setIsLeftoverModalOpen(false)}
          onCleanSuccess={(cleanedCount) => {
            setIsLeftoverModalOpen(false);
            setCanClean(false);
            setFoundFilesCount(0);
            setFoundRegCount(0);
            setPanelStatus(`Temizlik tamamlandı: ${cleanedCount} adet kalıntı öğe başarıyla silindi.`);
            setNotification({
              text: `Kalıntı temizliği başarıyla tamamlandı: ${cleanedCount} öğe silindi.`,
              type: 'success'
            });
            safeSetTimeout(() => setNotification(null), 4000);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: AYARLAR MODALI                                                   */}
      {/* ========================================================================= */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#16181C] rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100">Uninstaller Yapılandırma Ayarları</h3>
              </div>
              <button 
                onClick={() => setIsSettingsOpen(false)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/50 cursor-pointer">
                <div>
                  <div className="font-semibold text-slate-800 dark:text-zinc-100">Sistem Geri Yükleme Noktası</div>
                  <div className="text-slate-500 dark:text-zinc-400">Kaldırma öncesi Windows SystemRestore noktası oluştur</div>
                </div>
                <input 
                  type="checkbox" 
                  checked={settingCreateRestorePoint} 
                  onChange={(e) => setSettingCreateRestorePoint(e.target.checked)} 
                  className="w-4 h-4 text-sky-600 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/50 cursor-pointer">
                <div>
                  <div className="font-semibold text-slate-800 dark:text-zinc-100">Kayıt Defteri (Registry) Kalıntı Taraması</div>
                  <div className="text-slate-500 dark:text-zinc-400">HKCU\Software ve HKLM\Software anahtarlarını doğrulanmış olarak tara</div>
                </div>
                <input 
                  type="checkbox" 
                  checked={settingScanRegistry} 
                  onChange={(e) => setSettingScanRegistry(e.target.checked)} 
                  className="w-4 h-4 text-sky-600 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/50 cursor-pointer">
                <div>
                  <div className="font-semibold text-slate-800 dark:text-zinc-100">AppData & ProgramData Taraması</div>
                  <div className="text-slate-500 dark:text-zinc-400">%AppData%, %LocalAppData% ve C:\ProgramData dizinlerini tara</div>
                </div>
                <input 
                  type="checkbox" 
                  checked={settingScanAppData} 
                  onChange={(e) => setSettingScanAppData(e.target.checked)} 
                  className="w-4 h-4 text-sky-600 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/50 cursor-pointer">
                <div>
                  <div className="font-semibold text-slate-800 dark:text-zinc-100">Sessiz (Silent) Kaldırma Modu</div>
                  <div className="text-slate-500 dark:text-zinc-400">Yalnızca tanınan yükleyiciler için (/qn, /VERYSILENT, /S) ekle</div>
                </div>
                <input 
                  type="checkbox" 
                  checked={settingSilentUninstall} 
                  onChange={(e) => setSettingSilentUninstall(e.target.checked)} 
                  className="w-4 h-4 text-sky-600 rounded"
                />
              </label>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-zinc-800">
              <button
                onClick={() => {
                  setIsSettingsOpen(false);
                  setNotification({ text: 'Ayarlar başarıyla güncellendi.', type: 'success' });
                  safeSetTimeout(() => setNotification(null), 2500);
                }}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-600 text-white transition-colors cursor-pointer"
              >
                Kaydet ve Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: YÖNETİCİ PROFİLİ VE SİSTEM DURUMU MODALI                          */}
      {/* ========================================================================= */}
      {isProfileOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#16181C] rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100">Sistem ve Oturum Durumu</h3>
              </div>
              <button 
                onClick={() => setIsProfileOpen(false)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-black rounded-xl border border-slate-200 dark:border-zinc-800">
                <div className="w-10 h-10 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 flex items-center justify-center font-bold text-sm">
                  {systemInfo?.isElevated ? 'ADM' : 'USR'}
                </div>
                <div>
                  <div className="font-semibold text-slate-800 dark:text-zinc-100">
                    {systemInfo?.isElevated ? 'Administrator' : 'Kullanıcı Oturumu'}
                  </div>
                  <div className={`font-medium flex items-center gap-1 ${
                    systemInfo?.isElevated ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    {systemInfo?.isElevated ? (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Yönetici Yetkisi (Elevated)</span>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Standart Yetki (UAC Gerekebilir)</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-slate-500 dark:text-zinc-400 space-y-1.5 p-1 font-mono text-[11px]">
                <p>• Platform: <strong className="text-slate-700 dark:text-zinc-200 font-sans">{systemInfo?.platform || 'Bilinmiyor'}</strong></p>
                <p>• Windows Çekirdeği: <strong className="text-slate-700 dark:text-zinc-200 font-sans">{systemInfo?.isWindows ? 'Evet' : 'Hayır (Önizleme)'}</strong></p>
                <p>• HKLM Yazma İzni: <strong className="text-slate-700 dark:text-zinc-200 font-sans">{systemInfo?.isElevated ? 'Etkin' : 'Kısıtlı'}</strong></p>
                <p>• IPC Durumu: <strong className="text-slate-700 dark:text-zinc-200 font-sans">{isElectronConnected ? 'Electron Köprüsü Aktif' : 'Tarayıcı Simülasyonu'}</strong></p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-zinc-800">
              <button
                onClick={() => setIsProfileOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-600 text-white transition-colors cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
