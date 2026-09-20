import React, { useState, useEffect, useRef } from 'react';
import { 
  Trash2, 
  Folder, 
  FileText, 
  Database, 
  CheckSquare, 
  Square, 
  AlertTriangle, 
  ShieldAlert, 
  Sparkles,
  Loader2,
  X
} from 'lucide-react';
import { LeftoverItem } from '../types';

interface LeftoverCleanerModalProps {
  appName: string;
  initialItems: LeftoverItem[];
  onClose: () => void;
  onCleanSuccess: (cleanedCount: number, deletedItems: LeftoverItem[]) => void;
}

export const LeftoverCleanerModal: React.FC<LeftoverCleanerModalProps> = ({
  appName,
  initialItems,
  onClose,
  onCleanSuccess
}) => {
  // Güvenlik gereksinimi: Varsayılan olarak hiçbir şey seçili olmasın (selected: false)
  const [items, setItems] = useState<LeftoverItem[]>(() =>
    initialItems.map((item) => ({ ...item, selected: false }))
  );
  const [filterScope, setFilterScope] = useState<string>('all');
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleaningLogs, setCleaningLogs] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const toggleSelect = (id: string) => {
    setErrorMessage(null);
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const selectAll = (selected: boolean) => {
    setErrorMessage(null);
    setItems((prev) => prev.map((item) => ({ ...item, selected })));
  };

  const selectedItems = items.filter((i) => i.selected);

  const filteredItems = items.filter((item) => {
    if (filterScope === 'all') return true;
    return item.targetScope === filterScope;
  });

  const handleExecuteClean = async () => {
    if (selectedItems.length === 0) {
      setErrorMessage('Lütfen silmek istediğiniz kalıntı öğelerini kutucukları işaretleyerek seçin.');
      return;
    }

    setErrorMessage(null);
    setIsCleaning(true);
    setCleaningLogs([
      `[Güvenlik Kontrolü] Silme hedefleri doğrulanıyor (Toplam: ${selectedItems.length})...`
    ]);

    // Gerçek Electron IPC çağrısı
    if (window.api && typeof window.api.deleteLeftovers === 'function' && window.api.isElectron) {
      try {
        setCleaningLogs((prev) => [
          ...prev,
          `[IPC] Main process çağrıldı: delete-leftovers...`
        ]);

        const deleteResult = await window.api.deleteLeftovers(selectedItems);

        if (!isMountedRef.current) return;

        const newLogs: string[] = [];
        const actuallyDeleted: LeftoverItem[] = [];

        deleteResult.results.forEach((res) => {
          const item = selectedItems.find((i) => i.id === res.id);
          if (res.success) {
            newLogs.push(`[BAŞARILI] ${res.path}`);
            if (item) actuallyDeleted.push(item);
          } else {
            newLogs.push(`[HATA] ${res.path} - ${res.error || 'Silinemedi'}`);
          }
        });

        setCleaningLogs((prev) => [...prev, ...newLogs]);

        if (deleteResult.deletedCount > 0) {
          // Gerçekten silinen öğeleri yerel listeden kaldır
          setItems((prev) => prev.filter((i) => !actuallyDeleted.some((d) => d.id === i.id)));
          setTimeout(() => {
            if (isMountedRef.current) {
              setIsCleaning(false);
              onCleanSuccess(deleteResult.deletedCount, actuallyDeleted);
            }
          }, 800);
        } else {
          // Hiçbir öğe silinememişse ASLA sahte başarı gösterme
          setIsCleaning(false);
          setErrorMessage(deleteResult.error || 'Seçilen hiçbir öğe silinemedi (Dosyalar kilitli veya yetki yetersiz).');
        }
      } catch (err: unknown) {
        if (!isMountedRef.current) return;
        const msg = err instanceof Error ? err.message : String(err);
        setIsCleaning(false);
        setErrorMessage(`Kalıntı silme sırasında beklenmeyen bir hata oluştu: ${msg}`);
      }
    } else {
      // Tarayıcı / Demo Ortamı (Electron yok): Gerçeği kullanıcıya dürüstçe bildir
      setCleaningLogs((prev) => [
        ...prev,
        `[UYARI] Tarayıcı Önizleme Modu: Gerçek dosya sistemi silme işlemi yalnızca Electron masaüstü uygulamasında yürütülür.`,
        `[DEMO] ${selectedItems.length} kalıntı öğe arayüzden kaldırılıyor...`
      ]);

      setTimeout(() => {
        if (!isMountedRef.current) return;
        setIsCleaning(false);
        // Demo ortamında arayüz testini sağlamak için yerel listeyi güncelle
        setItems((prev) => prev.filter((i) => !i.selected));
        onCleanSuccess(selectedItems.length, selectedItems);
      }, 600);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white dark:bg-[#16181C] border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Üst Başlık */}
        <div className="bg-slate-50 dark:bg-black px-5 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
              <Sparkles className="w-5 h-5 text-rose-500 dark:text-rose-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-zinc-100">
                  Güvenli Kalıntı Temizliği
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                  Korumalı Silme
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                <strong className="text-slate-700 dark:text-zinc-200">'{appName}'</strong> için tespit edilen doğrulanmış aday kalıntılar
              </p>
            </div>
          </div>

          {!isCleaning && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Taranan Alanlar Filtresi */}
        <div className="px-5 py-2.5 bg-slate-50/70 dark:bg-black/40 border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            <span className="text-slate-400 dark:text-zinc-500 text-[11px] mr-1">Kapsam:</span>
            {[
              { id: 'all', label: `Tümü (${items.length})` },
              { id: '%AppData%', label: '%AppData%' },
              { id: '%LocalAppData%', label: '%LocalAppData%' },
              { id: 'C:\\ProgramData', label: 'C:\\ProgramData' },
              { id: 'HKCU\\Software', label: 'HKCU\\Software' },
              { id: 'HKLM\\Software', label: 'HKLM\\Software' },
            ].map((scope) => (
              <button
                key={scope.id}
                onClick={() => setFilterScope(scope.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors whitespace-nowrap cursor-pointer ${
                  filterScope === scope.id
                    ? 'bg-sky-500 text-white font-semibold'
                    : 'bg-slate-100 dark:bg-zinc-800/80 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
                }`}
              >
                {scope.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => selectAll(true)}
              className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline cursor-pointer font-medium"
              disabled={isCleaning}
            >
              Tümünü Seç
            </button>
            <span className="text-slate-300 dark:text-zinc-700">|</span>
            <button
              onClick={() => selectAll(false)}
              className="text-[11px] text-slate-500 dark:text-zinc-400 hover:underline cursor-pointer"
              disabled={isCleaning}
            >
              Seçimi Kaldır
            </button>
          </div>
        </div>

        {/* Hata Bildirimi */}
        {errorMessage && (
          <div className="px-5 py-2.5 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-200 cursor-pointer font-bold">✕</button>
          </div>
        )}

        {/* Bilgilendirme Notu */}
        <div className="px-5 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            Güvenliğiniz için hiçbir kalıntı varsayılan olarak seçilmemiştir. Lütfen silmek istediğiniz öğeleri kontrol edip onaylayarak silin.
          </div>
        </div>

        {/* Kalıntı Listesi */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/50 dark:bg-[#16181C]">
          {filteredItems.length === 0 ? (
            <div className="text-center py-10 text-slate-400 dark:text-zinc-500 text-xs">
              Bu kategoride kalıntı bulunamadı.
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => !isCleaning && toggleSelect(item.id)}
                className={`p-3 rounded-xl border text-xs flex items-start gap-3 transition-all cursor-pointer ${
                  item.selected
                    ? 'bg-sky-50 dark:bg-sky-950/30 border-sky-300 dark:border-sky-800 text-slate-900 dark:text-zinc-100 shadow-sm'
                    : 'bg-white dark:bg-black border-slate-200 dark:border-zinc-800/80 text-slate-500 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-700'
                }`}
              >
                <div className="pt-0.5 shrink-0">
                  {item.selected ? (
                    <CheckSquare className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 dark:text-zinc-600" />
                  )}
                </div>

                <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                  {item.type === 'folder' && <Folder className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />}
                  {item.type === 'file' && <FileText className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />}
                  {item.type === 'registry_key' && <Database className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />}
                </div>

                <div className="flex-1 min-w-0 font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-sans font-semibold border bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700">
                      {item.targetScope}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-sans">
                      {item.sizeOrDetails}
                    </span>
                  </div>
                  <div className="text-slate-800 dark:text-zinc-200 break-all text-xs mt-1 font-semibold">
                    {item.path}
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Canlı Temizlik Terminal Logları */}
          {cleaningLogs.length > 0 && (
            <div className="mt-4 p-3 bg-white dark:bg-black rounded-xl border border-slate-200 dark:border-zinc-800 font-mono text-[11px] text-slate-700 dark:text-zinc-300 space-y-1 max-h-36 overflow-y-auto">
              {cleaningLogs.map((log, idx) => (
                <div 
                  key={idx} 
                  className={
                    log.startsWith('[BAŞARILI]') 
                      ? 'text-emerald-600 dark:text-emerald-400' 
                      : log.startsWith('[HATA]') 
                        ? 'text-rose-600 dark:text-rose-400' 
                        : log.startsWith('[UYARI]')
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-sky-600 dark:text-sky-400'
                  }
                >
                  {log}
                </div>
              ))}
              {isCleaning && (
                <div className="flex items-center gap-1.5 text-rose-500 pt-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Güvenli silme işlemi yürütülüyor...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Alt Eylem Çubuğu */}
        <div className="p-4 bg-white dark:bg-black border-t border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-zinc-400">
            Seçili: <strong className="text-slate-800 dark:text-zinc-100">{selectedItems.length}</strong> / {items.length} kalıntı
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              disabled={isCleaning}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs rounded-xl transition-colors disabled:opacity-50 cursor-pointer font-medium"
            >
              Vazgeç / Kapat
            </button>

            <button
              onClick={handleExecuteClean}
              disabled={selectedItems.length === 0 || isCleaning}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-xl transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isCleaning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Siliniyor...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Seçili Kalıntıları Sil ({selectedItems.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
