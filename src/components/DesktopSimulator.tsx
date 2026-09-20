import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  RotateCw, 
  Copy, 
  Check, 
  Layers, 
  Info, 
  Terminal, 
  FolderOpen,
  Trash2,
  AlertTriangle,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  Undo2,
  ShieldCheck,
  Sparkles,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { SAMPLE_INSTALLED_PROGRAMS } from '../data/sampleInstalledApps';
import { InstalledProgram, LeftoverItem } from '../types';
import { generateMockLeftovers } from '../data/mockLeftovers';
import { LeftoverCleanerModal } from './LeftoverCleanerModal';

interface DesktopSimulatorProps {
  onSelectCodeTab: (tab: 'pyqt5' | 'wpf') => void;
}

interface ActiveProcessInfo {
  program: InstalledProgram;
  pid: number;
  startTime: number;
  logs: string[];
  status: 'running' | 'completed' | 'cancelled';
  exitCode: number | null;
}

export const DesktopSimulator: React.FC<DesktopSimulatorProps> = ({ onSelectCodeTab }) => {
  const [programs, setPrograms] = useState<InstalledProgram[]>(SAMPLE_INSTALLED_PROGRAMS);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHive, setSelectedHive] = useState<string>('all');
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [detailProgram, setDetailProgram] = useState<InstalledProgram | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('Kayıt defteri tarandı. Hazır (Yönetici Modu Aktif).');
  const [notification, setNotification] = useState<string | null>(null);

  // Kaldırıcı Süreci (Process Execution Simülatörü)
  const [activeProcess, setActiveProcess] = useState<ActiveProcessInfo | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Kalıntı Temizliği Modalı State'i
  const [leftoverTargetApp, setLeftoverTargetApp] = useState<{ appName: string; items: LeftoverItem[] } | null>(null);

  // Zamanlayıcı (Process çalışma süresi simülasyonu)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeProcess && activeProcess.status === 'running') {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => +(prev + 0.5).toFixed(1));
      }, 500);
    }
    return () => clearInterval(interval);
  }, [activeProcess]);

  // F5 kısayol tuşu dinleyicisi
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault();
        handleRefresh();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [programs.length]);

  // Sıralama State'leri
  const [sortField, setSortField] = useState<'displayName' | 'version' | 'publisher'>('displayName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: 'displayName' | 'version' | 'publisher') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredPrograms = useMemo(() => {
    return programs
      .filter((prog) => {
        const matchesSearch =
          prog.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (prog.publisher && prog.publisher.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (prog.uninstallString && prog.uninstallString.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesHive =
          selectedHive === 'all' ||
          (selectedHive === 'hklm64' && prog.registryHive.includes('64-bit')) ||
          (selectedHive === 'hklm32' && prog.registryHive.includes('Wow6432Node')) ||
          (selectedHive === 'hkcu' && prog.registryHive.includes('HKCU'));

        return matchesSearch && matchesHive;
      })
      .sort((a, b) => {
        let comparison = 0;
        if (sortField === 'displayName') {
          comparison = a.displayName.localeCompare(b.displayName, 'tr', { sensitivity: 'base' });
        } else if (sortField === 'version') {
          comparison = (a.displayVersion || '').localeCompare(b.displayVersion || '', 'tr', { numeric: true });
        } else if (sortField === 'publisher') {
          comparison = (a.publisher || '').localeCompare(b.publisher || '', 'tr', { sensitivity: 'base' });
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [programs, searchTerm, selectedHive, sortField, sortOrder]);

  const selectedProgram = useMemo(() => {
    return programs.find((p) => p.id === selectedProgramId) || null;
  }, [programs, selectedProgramId]);

  const handleCopy = async (text: string, id: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      } else {
        setStatusMessage('Pano API bu tarayıcı bağlamında desteklenmiyor.');
      }
    } catch (err) {
      console.warn('Pano kopyalama hatası:', err);
      setStatusMessage('Metin panoya kopyalanamadı.');
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setStatusMessage('Kayıt defteri taranıyor...');
    setTimeout(() => {
      setIsRefreshing(false);
      setStatusMessage(`Tarama tamamlandı: Toplam ${programs.length} kurulu program bulundu.`);
    }, 600);
  };

  const handleResetList = () => {
    setPrograms(SAMPLE_INSTALLED_PROGRAMS);
    setSelectedProgramId(null);
    setNotification('Örnek program listesi ilk haline getirildi.');
    setStatusMessage(`Kayıt defteri sıfırlandı: ${SAMPLE_INSTALLED_PROGRAMS.length} program hazır.`);
    setTimeout(() => setNotification(null), 3500);
  };

  const parseCleanIcon = (iconPath?: string) => {
    if (!iconPath) return null;
    return iconPath.replace(/^"|"$/g, '').split(',')[0];
  };

  // Kaldırma işlemini başlatma
  const triggerUninstall = (prog: InstalledProgram) => {
    if (!prog.uninstallString) {
      setNotification(`'${prog.displayName}' için kayıt defterinde geçerli bir UninstallString komutu tanımlanmamış.`);
      setTimeout(() => setNotification(null), 4000);
      return;
    }

    const mockPid = Math.floor(1000 + Math.random() * 8000);
    setElapsedSeconds(0);

    setActiveProcess({
      program: prog,
      pid: mockPid,
      startTime: Date.now(),
      status: 'running',
      exitCode: null,
      logs: [
        `[00:00.0] [Admin] Windows Yönetici Ayrıcalığı (UAC) teyit edildi.`,
        `[00:00.1] Komut algılandı: ${prog.uninstallString}`,
        `[00:00.2] Windows kabuğu başlatılıyor (cmd.exe /c ...)`,
        `[00:00.3] Process oluşturuldu: PID ${mockPid}`,
        `[00:00.4] Orijinal kaldırıcı penceresi açıldı. Kod akışı 'process.wait()' / 'Process.WaitForExit()' çağrısında bekletiliyor...`
      ]
    });

    setStatusMessage(`'${prog.displayName}' kaldırıcı penceresi çalışıyor, kapanması bekleniyor...`);
  };

  // Kaldırıcı penceresi kapandığında tetiklenen metod
  const handleCompleteUninstall = (exitCode: number) => {
    if (!activeProcess) return;

    const targetProg = activeProcess.program;

    if (exitCode === 0) {
      // Başarılı kaldırma
      setActiveProcess((prev) => prev ? {
        ...prev,
        status: 'completed',
        exitCode: 0,
        logs: [
          ...prev.logs,
          `[${elapsedSeconds}s] Orijinal kaldırıcı penceresi kapandı.`,
          `[${elapsedSeconds}s] Exit Code: 0 (Başarılı)`,
          `[${elapsedSeconds}s] Kod akışı devam ediyor: %AppData%, %LocalAppData%, C:\\ProgramData ve Registry yollarında kalıntılar aranıyor...`
        ]
      } : null);

      setTimeout(() => {
        // Programı listeden kaldır
        setPrograms((prev) => prev.filter((p) => p.id !== targetProg.id));
        if (selectedProgramId === targetProg.id) {
          setSelectedProgramId(null);
        }
        if (detailProgram?.id === targetProg.id) {
          setDetailProgram(null);
        }
        setActiveProcess(null);

        // KALINTI ARAMASI VE TEMİZLİK PENCERESİNİ TETİKLE
        const foundLeftovers = generateMockLeftovers(targetProg.displayName, targetProg.publisher);
        setLeftoverTargetApp({
          appName: targetProg.displayName,
          items: foundLeftovers
        });

        setStatusMessage(`'${targetProg.displayName}' kaldırıldı. Kalıntı taraması başlatıldı...`);
      }, 1100);

    } else {
      // İptal veya hata
      setActiveProcess((prev) => prev ? {
        ...prev,
        status: 'cancelled',
        exitCode: 1,
        logs: [
          ...prev.logs,
          `[${elapsedSeconds}s] Kaldırıcı penceresi kullanıcı tarafından kapatıldı / iptal edildi.`,
          `[${elapsedSeconds}s] Exit Code: 1 (İptal)`,
          `[${elapsedSeconds}s] İşlem sonlandırıldı.`
        ]
      } : null);

      setTimeout(() => {
        setActiveProcess(null);
        setStatusMessage(`'${targetProg.displayName}' kaldırma işlemi iptal edildi (Kod: 1).`);
      }, 900);
    }
  };

  // Kalıntılar temizlendiğinde
  const handleCleanLeftoversSuccess = (cleanedCount: number, deletedItems: LeftoverItem[]) => {
    const appName = leftoverTargetApp?.appName || 'Uygulama';
    setLeftoverTargetApp(null);
    setNotification(`'${appName}' için seçilen ${cleanedCount} adet kalıntı dosya ve Registry anahtarı yönetici yetkisiyle başarıyla silindi.`);
    setStatusMessage(`Temizlik tamamlandı: ${cleanedCount} öğe silindi. Kayıt defteri güncellendi.`);
    setTimeout(() => setNotification(null), 5000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-xl border border-slate-700 shadow-2xl overflow-hidden relative">
      {/* Bildirim Toast */}
      {notification && (
        <div className="absolute top-14 right-4 z-40 bg-emerald-950 border border-emerald-500 text-emerald-200 px-4 py-2.5 rounded-lg shadow-xl text-xs sm:text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Windows 11 Pencere Başlığı */}
      <div className="bg-slate-950/90 px-4 py-2.5 flex items-center justify-between border-b border-slate-800 select-none">
        <div className="flex items-center space-x-2.5">
          <div className="w-5 h-5 rounded bg-sky-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
            W
          </div>
          <span className="text-xs font-medium text-slate-200">
            Windows Registry Program Yöneticisi - Canlı Masaüstü Simülatörü
          </span>
          <span className="px-2 py-0.5 text-[10px] bg-emerald-950/80 text-emerald-300 rounded-full border border-emerald-600/40 flex items-center gap-1 font-semibold">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            Yönetici Olarak Çalıştırıldı (Administrator)
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <div 
            onClick={() => {
              setNotification('Pencere simge durumuna küçültüldü (Simülasyon).');
              setTimeout(() => setNotification(null), 3000);
            }}
            className="w-3 h-3 rounded-full bg-slate-600 hover:bg-slate-500 cursor-pointer transition-colors" 
            title="Simge Durumuna Küçült" 
          />
          <div 
            onClick={() => {
              setNotification('Tam ekran / normal ekran boyutu arasında geçiş yapıldı.');
              setTimeout(() => setNotification(null), 3000);
            }}
            className="w-3 h-3 rounded-full bg-slate-600 hover:bg-slate-500 cursor-pointer transition-colors" 
            title="Ekranı Kapla" 
          />
          <div 
            onClick={() => {
              setNotification('Uygulama penceresi kapatıldı (Simülasyon). Yeniden yüklemek için "Yenile" butonunu kullanabilirsiniz.');
              setTimeout(() => setNotification(null), 3500);
            }}
            className="w-3 h-3 rounded-full bg-rose-600/80 hover:bg-rose-500 cursor-pointer transition-colors" 
            title="Kapat" 
          />
        </div>
      </div>

      {/* Üst Eylem Araç Çubuğu (Toolbar) */}
      <div className="p-3.5 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        {/* Sol Taraf: Butonlar */}
        <div className="flex items-center gap-2">
          {/* Kaldır Butonu */}
          <button
            id="desktop-btn-uninstall"
            onClick={() => {
              if (selectedProgram) {
                triggerUninstall(selectedProgram);
              } else {
                setNotification('Lütfen listeden kaldırmak istediğiniz bir programı seçin.');
                setTimeout(() => setNotification(null), 3500);
              }
            }}
            disabled={!selectedProgram}
            className={`px-3.5 py-2 rounded-lg font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-sm ${
              selectedProgram
                ? 'bg-rose-600 hover:bg-rose-500 text-white cursor-pointer active:scale-95 shadow-rose-950/50'
                : 'bg-slate-800/80 text-slate-500 border border-slate-700/50 cursor-not-allowed'
            }`}
            title={
              selectedProgram
                ? `'${selectedProgram.displayName}' programını kaldır ve ardından kalıntıları tara`
                : 'Lütfen tablodan bir program seçin'
            }
          >
            <Trash2 className="w-4 h-4" />
            <span>Kaldır &amp; Temizle</span>
            {selectedProgram && (
              <span className="hidden md:inline text-[11px] font-normal text-rose-200 bg-rose-700/60 px-1.5 py-0.2 rounded ml-1">
                {selectedProgram.displayName.length > 16
                  ? selectedProgram.displayName.substring(0, 16) + '...'
                  : selectedProgram.displayName}
              </span>
            )}
          </button>

          {/* Manuel Kalıntı Temizle Butonu (Seçili program için doğrudan kalıntı tarama) */}
          {selectedProgram && (
            <button
              onClick={() => {
                const foundLeftovers = generateMockLeftovers(selectedProgram.displayName, selectedProgram.publisher);
                setLeftoverTargetApp({
                  appName: selectedProgram.displayName,
                  items: foundLeftovers
                });
              }}
              className="px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Kaldırma beklemeden doğrudan kalıntı tarayıcısını test et"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Kalıntı Tara</span>
            </button>
          )}

          {/* Yeniden Tara (F5) Butonu */}
          <button
            id="desktop-btn-refresh"
            onClick={handleRefresh}
            className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition-colors shadow-sm"
            title="Kayıt defterini yeniden tara"
          >
            <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Yenile (F5)</span>
          </button>

          {/* Örnek Verileri Sıfırla (Eğer kaldırılan varsa) */}
          {programs.length < SAMPLE_INSTALLED_PROGRAMS.length && (
            <button
              onClick={handleResetList}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center gap-1.5 border border-slate-700 transition-colors"
              title="Kaldırılan programları geri getir"
            >
              <Undo2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Sıfırla ({SAMPLE_INSTALLED_PROGRAMS.length - programs.length} kaldırıldı)</span>
            </button>
          )}
        </div>

        {/* Sağ Taraf: Arama & Filtre */}
        <div className="flex items-center gap-2 flex-1 sm:flex-initial min-w-[240px]">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="desktop-sim-search"
              type="text"
              placeholder="Program, yayıncı veya komut ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-800/90 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
        </div>
      </div>

      {/* Kaynak Hive Filtre Sekmeleri */}
      <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs overflow-x-auto gap-2">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-slate-400 text-[11px] mr-1 hidden sm:inline">Registry Filtresi:</span>
          <button
            onClick={() => setSelectedHive('all')}
            className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap font-medium ${
              selectedHive === 'all'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-slate-800/60 text-slate-300 hover:text-white'
            }`}
          >
            Tüm Kayıtlar ({programs.length})
          </button>
          <button
            onClick={() => setSelectedHive('hklm64')}
            className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap font-medium ${
              selectedHive === 'hklm64'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-800/60 text-slate-300 hover:text-white'
            }`}
          >
            HKLM 64-bit
          </button>
          <button
            onClick={() => setSelectedHive('hklm32')}
            className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap font-medium ${
              selectedHive === 'hklm32'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-slate-800/60 text-slate-300 hover:text-white'
            }`}
          >
            HKLM Wow6432Node
          </button>
          <button
            onClick={() => setSelectedHive('hkcu')}
            className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap font-medium ${
              selectedHive === 'hkcu'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-800/60 text-slate-300 hover:text-white'
            }`}
          >
            HKCU (Kullanıcı)
          </button>
        </div>

        <div className="text-[11px] text-slate-400 shrink-0 hidden md:flex items-center gap-2">
          <span className="flex items-center gap-1 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            Otomatik Kalıntı Temizliği Hazır
          </span>
        </div>
      </div>

      {/* Programlar Tablosu */}
      <div className="flex-1 overflow-auto bg-slate-900/50">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead className="bg-slate-950/90 text-slate-400 font-semibold sticky top-0 z-10 border-b border-slate-800 select-none">
            <tr>
              <th className="py-2.5 px-3 w-10 text-center">İkon</th>
              <th 
                className="py-2.5 px-4 cursor-pointer hover:text-sky-400 transition-colors"
                onClick={() => handleSort('displayName')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Program Adı (DisplayName)</span>
                  {sortField === 'displayName' ? (
                    sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-400" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-400" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  )}
                </div>
              </th>
              <th 
                className="py-2.5 px-3 hidden md:table-cell cursor-pointer hover:text-sky-400 transition-colors"
                onClick={() => handleSort('version')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Sürüm</span>
                  {sortField === 'version' ? (
                    sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-400" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-400" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  )}
                </div>
              </th>
              <th 
                className="py-2.5 px-3 hidden lg:table-cell cursor-pointer hover:text-sky-400 transition-colors"
                onClick={() => handleSort('publisher')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Yayıncı</span>
                  {sortField === 'publisher' ? (
                    sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-400" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-400" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  )}
                </div>
              </th>
              <th className="py-2.5 px-3 hidden sm:table-cell">Kayıt Yolu (Hive)</th>
              <th className="py-2.5 px-4">Kaldırma Komutu (UninstallString)</th>
              <th className="py-2.5 px-3 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {filteredPrograms.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400 font-sans">
                  {programs.length === 0 ? (
                    <div className="space-y-3">
                      <p className="text-slate-300 font-semibold">Tüm programlar simülasyonda kaldırıldı!</p>
                      <button
                        onClick={handleResetList}
                        className="px-4 py-2 bg-sky-600 text-white rounded-lg text-xs font-semibold hover:bg-sky-500"
                      >
                        Örnek Programları Tekrar Yükle
                      </button>
                    </div>
                  ) : (
                    'Aramanıza uygun program bulunamadı.'
                  )}
                </td>
              </tr>
            ) : (
              filteredPrograms.map((prog) => {
                const isSelected = selectedProgramId === prog.id;
                return (
                  <tr
                    key={prog.id}
                    onClick={() => setSelectedProgramId(prog.id)}
                    className={`transition-colors cursor-pointer select-none ${
                      isSelected
                        ? 'bg-sky-950/70 border-l-4 border-sky-400 text-white'
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
                    {/* Simge */}
                    <td className="py-2.5 px-3 text-center">
                      <div className={`w-7 h-7 rounded flex items-center justify-center font-sans text-xs font-bold shadow-inner ${
                        isSelected 
                          ? 'bg-sky-600 text-white border border-sky-400' 
                          : 'bg-slate-800 border border-slate-700 text-slate-300'
                      }`}>
                        {prog.displayName.charAt(0).toUpperCase()}
                      </div>
                    </td>

                    {/* Program Adı */}
                    <td className="py-2.5 px-4 font-sans font-medium text-slate-100">
                      <div className="flex items-center gap-2">
                        <span className={isSelected ? 'text-sky-200 font-semibold' : ''}>
                          {prog.displayName}
                        </span>
                        {prog.isSystemComponent && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                            Sistem
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono truncate max-w-xs mt-0.5">
                        Anahtar: {prog.registryKeyName}
                      </div>
                    </td>

                    {/* Sürüm */}
                    <td className="py-2.5 px-3 text-slate-300 hidden md:table-cell font-sans">
                      {prog.displayVersion || '-'}
                    </td>

                    {/* Yayıncı */}
                    <td className="py-2.5 px-3 text-slate-300 hidden lg:table-cell font-sans truncate max-w-[130px]">
                      {prog.publisher || '-'}
                    </td>

                    {/* Registry Hive */}
                    <td className="py-2.5 px-3 hidden sm:table-cell">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-sans font-medium border ${
                          prog.registryHive.includes('64-bit')
                            ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                            : prog.registryHive.includes('Wow6432Node')
                            ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                            : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        }`}
                      >
                        {prog.registryHive}
                      </span>
                    </td>

                    {/* Kaldırma Komutu */}
                    <td className="py-2.5 px-4 text-slate-300 max-w-xs xl:max-w-sm">
                      <div
                        className="truncate text-xs bg-slate-950/40 px-2 py-1 rounded border border-slate-800/80 text-sky-300/90"
                        title={prog.uninstallString}
                      >
                        {prog.uninstallString || 'Belirtilmemiş'}
                      </div>
                    </td>

                    {/* Aksiyonlar (Kaldır & Detay) */}
                    <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Satır İçi Kaldır Butonu */}
                        <button
                          onClick={() => triggerUninstall(prog)}
                          className="px-2 py-1 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded border border-rose-500/30 transition-all flex items-center gap-1 font-sans text-xs"
                          title={`'${prog.displayName}' programını kaldır ve kalıntıları temizle`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Kaldır</span>
                        </button>

                        {/* Detay Bilgisi */}
                        <button
                          onClick={() => setDetailProgram(prog)}
                          className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded transition-colors"
                          title="Detayları İncele"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Alt Durum Çubuğu (Status Bar) */}
      <div className="bg-slate-950 px-4 py-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 gap-2 select-none">
        <div className="flex items-center space-x-3 truncate">
          <span className="flex items-center text-emerald-400 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse" />
            {statusMessage}
          </span>
          <span>•</span>
          <span className="shrink-0">
            Kayıt Sayısı: <strong className="text-slate-200">{filteredPrograms.length}</strong> / {programs.length}
          </span>
        </div>

        <div className="flex items-center space-x-2 text-xs shrink-0">
          <span>Masaüstü Kodları:</span>
          <button
            onClick={() => onSelectCodeTab('pyqt5')}
            className="text-sky-400 hover:text-sky-300 font-medium underline transition-colors"
          >
            Python (PyQt5)
          </button>
          <span>|</span>
          <button
            onClick={() => onSelectCodeTab('wpf')}
            className="text-sky-400 hover:text-sky-300 font-medium underline transition-colors"
          >
            C# (WPF)
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 🚀 Orijinal Kaldırıcı Penceresi & Process Bekleme Simülasyonu Modalı       */}
      {/* ========================================================================= */}
      {activeProcess && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-xl w-full overflow-hidden animate-in zoom-in-95">
            {/* Modal Başlığı */}
            <div className="bg-slate-950 px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">
                    Kaldırma Süreci Çalıştırılıyor (Process Execution)
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    PID: {activeProcess.pid} • Süre: {elapsedSeconds} sn
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="flex items-center text-[11px] px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Pencere Açık (Bekleniyor)
                </span>
              </div>
            </div>

            <div className="p-5 space-y-4 text-xs sm:text-sm">
              {/* Açıklayıcı Mimari Notu */}
              <div className="p-3 bg-sky-950/40 border border-sky-800/40 rounded-lg text-sky-200 text-xs leading-relaxed flex items-start gap-2.5">
                <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-sky-300 font-semibold">Kod Akışı Bekletiliyor:</strong>
                  <br />
                  Seçilen programın <code className="text-amber-300 font-mono">UninstallString</code> komutu arka planda yürütüldü. Masaüstü uygulamasındaki{' '}
                  <code className="bg-slate-900 px-1 py-0.5 rounded text-sky-300">process.wait()</code> (Python) veya{' '}
                  <code className="bg-slate-900 px-1 py-0.5 rounded text-sky-300">Process.WaitForExit()</code> (C#) komutu,
                  kullanıcı kaldırma penceresini kapatana kadar kod akışını bekletmektedir.
                  <br />
                  <strong className="text-emerald-300 mt-1 inline-block">Pencere kapandığı an:</strong> %AppData%, %LocalAppData%, C:\ProgramData ve Registry yollarında otomatik kalıntı taraması başlatılacaktır.
                </div>
              </div>

              {/* Hedef Program & Komut */}
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Kaldırılan Program:</span>
                  <span className="font-semibold text-slate-200">{activeProcess.program.displayName}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Kayıt Yolu (Hive):</span>
                  <span className="text-slate-300">{activeProcess.program.registryHive}</span>
                </div>
                <div>
                  <div className="text-slate-400 mb-1">Çalıştırılan Kaldırma Komutu:</div>
                  <div className="bg-slate-900 p-2 rounded font-mono text-[11px] text-rose-300 break-all border border-slate-800 select-all">
                    {activeProcess.program.uninstallString}
                  </div>
                </div>
              </div>

              {/* Terminal Logları */}
              <div>
                <div className="text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-sky-400" />
                  Süreç ve Bekleme Logları (Live Trace)
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1 max-h-32 overflow-y-auto">
                  {activeProcess.logs.map((log, i) => (
                    <div key={i} className="text-slate-300">{log}</div>
                  ))}
                  <div className="flex items-center gap-1.5 text-amber-400 pt-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    <span>Orijinal kaldırıcı penceresinin kapanması bekleniyor...</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Simülasyon Butonları */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-[11px] text-slate-400">
                Simülasyonda kaldırıcı penceresini kapatmak için bir işlem seçin:
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => handleCompleteUninstall(1)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors"
                  title="Pencereyi kapat / Kaldırmadan vazgeç"
                >
                  İptal Et (Exit Code: 1)
                </button>
                <button
                  onClick={() => handleCompleteUninstall(0)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                  title="Kaldırma işlemini başarıyla tamamla, kaldırıcıyı kapat ve kalıntı temizliğine geç"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Kaldırıcıyı Kapat (Tamamla / Exit Code: 0)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🧹 Otomatik Kalıntı Temizliği Modalı                                      */}
      {/* ========================================================================= */}
      {leftoverTargetApp && (
        <LeftoverCleanerModal
          appName={leftoverTargetApp.appName}
          initialItems={leftoverTargetApp.items}
          onClose={() => setLeftoverTargetApp(null)}
          onCleanSuccess={handleCleanLeftoversSuccess}
        />
      )}

      {/* ========================================================================= */}
      {/* 📄 Program Detay Modalı                                                   */}
      {/* ========================================================================= */}
      {detailProgram && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-800 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-sky-600/20 border border-sky-500/40 flex items-center justify-center text-sky-400 font-bold text-lg">
                  {detailProgram.displayName.charAt(0)}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-100">
                    {detailProgram.displayName}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    {detailProgram.registryHive} / {detailProgram.registryKeyName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailProgram(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs sm:text-sm">
              {/* DisplayIcon */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
                  DisplayIcon (Kayıt Defterindeki Ham Yol)
                </label>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-xs text-amber-300/90 break-all select-all">
                  {detailProgram.displayIcon || 'DisplayIcon anahtarı bulunamadı (Varsayılan sistem ikonu kullanılır)'}
                </div>
                {detailProgram.displayIcon && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Temizlenmiş çalıştırılabilir dosya: <span className="font-mono text-slate-300">{parseCleanIcon(detailProgram.displayIcon)}</span>
                  </p>
                )}
              </div>

              {/* UninstallString */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-sky-400" />
                  UninstallString (Kaldırma Komutu)
                </label>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-xs text-sky-300 break-all select-all flex items-start justify-between gap-2">
                  <span>{detailProgram.uninstallString || 'Kaldırma komutu tanımlanmamış'}</span>
                  {detailProgram.uninstallString && (
                    <button
                      onClick={() => handleCopy(detailProgram.uninstallString!, 'modal-uninstall')}
                      className="shrink-0 p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
                      title="Panoya Kopyala"
                    >
                      {copiedId === 'modal-uninstall' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Ekstra Bilgiler Tablosu */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/60">
                  <div className="text-[11px] text-slate-400">Sürüm (DisplayVersion)</div>
                  <div className="text-sm font-semibold text-slate-200 mt-0.5">
                    {detailProgram.displayVersion || '-'}
                  </div>
                </div>

                <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/60">
                  <div className="text-[11px] text-slate-400">Yayıncı (Publisher)</div>
                  <div className="text-sm font-semibold text-slate-200 mt-0.5 truncate">
                    {detailProgram.publisher || '-'}
                  </div>
                </div>

                <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/60 col-span-2">
                  <div className="text-[11px] text-slate-400">Kurulum Yolu (InstallLocation)</div>
                  <div className="text-xs font-mono text-slate-300 mt-0.5 break-all">
                    {detailProgram.installLocation || 'Kayıt defterinde belirtilmemiş'}
                  </div>
                </div>
              </div>

              {/* Teknik İpucu */}
              <div className="p-3 bg-sky-950/40 border border-sky-800/50 rounded-lg text-xs text-sky-200/90 flex items-start gap-2">
                <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-sky-300">Windows Kaldırma ve Kalıntı Notu:</strong> <br />
                  Kaldırıcılar çoğu zaman kullanıcı ayarlarını (%AppData%), log dosyalarını ve Registry ayarlarını geride bırakır. Yönetici ayrıcalıklarıyla donatılmış temizlik fonksiyonu bu kalıntıları tamamen temizler.
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-2">
              {/* Şimdi Kaldır butonu */}
              {detailProgram.uninstallString && (
                <button
                  onClick={() => {
                    const prog = detailProgram;
                    setDetailProgram(null);
                    triggerUninstall(prog);
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg transition-colors flex items-center gap-1.5 text-xs sm:text-sm shadow-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Bu Programı Kaldır &amp; Kalıntıları Tara</span>
                </button>
              )}

              <div className="flex items-center gap-2 ml-auto">
                {detailProgram.uninstallString && (
                  <button
                    onClick={() => handleCopy(detailProgram.uninstallString!, 'modal-bottom')}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg transition-colors flex items-center gap-1.5 text-xs sm:text-sm border border-slate-700"
                  >
                    <Copy className="w-4 h-4" />
                    {copiedId === 'modal-bottom' ? 'Kopyalandı!' : 'Komutu Kopyala'}
                  </button>
                )}
                <button
                  onClick={() => setDetailProgram(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-xs sm:text-sm"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
