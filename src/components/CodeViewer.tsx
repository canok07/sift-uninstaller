import React, { useState } from 'react';
import { Copy, Check, Download, FileCode, CheckCircle2, Play, Terminal, HelpCircle, ShieldCheck, FileCheck, Sparkles, Layout } from 'lucide-react';
import { PYTHON_PYQT5_CODE, CSHARP_WPF_XAML, CSHARP_WPF_CS } from '../data/codeSnippets';
import { PYTHON_ADMIN_SNIPPET, CSHARP_APP_MANIFEST, CSHARP_CSPROJ_CONFIG } from '../data/adminManifestSnippets';
import { FLUENT_PYQT5_CODE, FLUENT_WPF_XAML, FLUENT_WPF_CS } from '../data/fluentCodeSnippets';

interface CodeViewerProps {
  initialLanguage?: 'pyqt5' | 'wpf';
  initialMode?: 'fluent' | 'backend';
}

export const CodeViewer: React.FC<CodeViewerProps> = ({ 
  initialLanguage = 'pyqt5',
  initialMode = 'fluent'
}) => {
  const [activeLang, setActiveLang] = useState<'pyqt5' | 'wpf'>(initialLanguage);
  const [activeMode, setActiveMode] = useState<'fluent' | 'backend'>(initialMode);
  
  // Fluent sekmesindeyken WPF alt sekmeleri (XAML vs C#)
  const [fluentWpfTab, setFluentWpfTab] = useState<'xaml' | 'cs'>('xaml');

  // Backend sekmesindeyken
  const [pyTab, setPyTab] = useState<'main' | 'admin'>('main');
  const [wpfFileTab, setWpfFileTab] = useState<'xaml' | 'cs' | 'manifest' | 'csproj'>('cs');
  
  const [copied, setCopied] = useState(false);

  const getCurrentCode = () => {
    if (activeMode === 'fluent') {
      if (activeLang === 'pyqt5') {
        return FLUENT_PYQT5_CODE;
      }
      return fluentWpfTab === 'xaml' ? FLUENT_WPF_XAML : FLUENT_WPF_CS;
    }

    // Backend / Registry mode
    if (activeLang === 'pyqt5') {
      return pyTab === 'main' ? PYTHON_PYQT5_CODE : PYTHON_ADMIN_SNIPPET;
    }
    if (wpfFileTab === 'xaml') return CSHARP_WPF_XAML;
    if (wpfFileTab === 'cs') return CSHARP_WPF_CS;
    if (wpfFileTab === 'manifest') return CSHARP_APP_MANIFEST;
    return CSHARP_CSPROJ_CONFIG;
  };

  const getCurrentFileName = () => {
    if (activeMode === 'fluent') {
      if (activeLang === 'pyqt5') return 'fluent_uninstaller_ui.py';
      return fluentWpfTab === 'xaml' ? 'MainWindow.xaml' : 'MainWindow.xaml.cs';
    }

    if (activeLang === 'pyqt5') {
      return pyTab === 'main' ? 'app.py' : 'run_as_admin.py';
    }
    if (wpfFileTab === 'xaml') return 'MainWindow.xaml';
    if (wpfFileTab === 'cs') return 'MainWindow.xaml.cs';
    if (wpfFileTab === 'manifest') return 'app.manifest';
    return 'RegistryAppScanner.csproj';
  };

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(getCurrentCode());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.warn('Pano kopyalama hatası:', err);
    }
  };

  const handleDownload = () => {
    const code = getCurrentCode();
    const fileName = getCurrentFileName();
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-xl border border-slate-700 shadow-2xl overflow-hidden">
      {/* 1. Üst Mod Seçici (Windows 11 Fluent UI vs Registry/Backend) */}
      <div className="p-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Fluent UI vs Backend Seçimi */}
          <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setActiveMode('fluent')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeMode === 'fluent'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layout className="w-3.5 h-3.5 text-sky-300" />
              <span>Windows 11 Fluent UI + Backend</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-400/20 text-sky-200 ml-1">Entegre Kod</span>
            </button>
            <button
              onClick={() => setActiveMode('backend')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeMode === 'backend'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>Registry &amp; Admin Motoru</span>
            </button>
          </div>

          <span className="text-slate-600">|</span>

          {/* Dil Seçimi (PyQt5 vs WPF) */}
          <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setActiveLang('pyqt5')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                activeLang === 'pyqt5'
                  ? 'bg-slate-700 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Python (PyQt5)
            </button>
            <button
              onClick={() => setActiveLang('wpf')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                activeLang === 'wpf'
                  ? 'bg-slate-700 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              C# (WPF / XAML)
            </button>
          </div>

          {/* FLUENT MODUNDA WPF XAML / CS SEKMESİ */}
          {activeMode === 'fluent' && activeLang === 'wpf' && (
            <div className="flex bg-slate-800/80 p-0.5 rounded-lg border border-slate-700 text-xs">
              <button
                onClick={() => setFluentWpfTab('xaml')}
                className={`px-2.5 py-1 rounded transition-colors font-mono cursor-pointer ${
                  fluentWpfTab === 'xaml'
                    ? 'bg-slate-700 text-sky-300 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                MainWindow.xaml (Arayüz)
              </button>
              <button
                onClick={() => setFluentWpfTab('cs')}
                className={`px-2.5 py-1 rounded transition-colors font-mono cursor-pointer ${
                  fluentWpfTab === 'cs'
                    ? 'bg-slate-700 text-sky-300 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                MainWindow.xaml.cs (Data)
              </button>
            </div>
          )}

          {/* BACKEND MODUNDA SEKMELER */}
          {activeMode === 'backend' && activeLang === 'pyqt5' && (
            <div className="flex bg-slate-800/80 p-0.5 rounded-lg border border-slate-700 text-xs">
              <button
                onClick={() => setPyTab('main')}
                className={`px-2.5 py-1 rounded transition-colors font-mono cursor-pointer ${
                  pyTab === 'main'
                    ? 'bg-slate-700 text-sky-300 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                app.py (Full Registry &amp; Leftovers)
              </button>
              <button
                onClick={() => setPyTab('admin')}
                className={`px-2.5 py-1 rounded transition-colors font-mono flex items-center gap-1 cursor-pointer ${
                  pyTab === 'admin'
                    ? 'bg-slate-700 text-emerald-300 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Run as Admin (UAC)</span>
              </button>
            </div>
          )}

          {activeMode === 'backend' && activeLang === 'wpf' && (
            <div className="flex bg-slate-800/80 p-0.5 rounded-lg border border-slate-700 text-xs flex-wrap gap-1">
              <button
                onClick={() => setWpfFileTab('cs')}
                className={`px-2.5 py-1 rounded transition-colors font-mono cursor-pointer ${
                  wpfFileTab === 'cs'
                    ? 'bg-slate-700 text-sky-300 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                MainWindow.xaml.cs
              </button>
              <button
                onClick={() => setWpfFileTab('xaml')}
                className={`px-2.5 py-1 rounded transition-colors font-mono cursor-pointer ${
                  wpfFileTab === 'xaml'
                    ? 'bg-slate-700 text-sky-300 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                MainWindow.xaml
              </button>
              <button
                onClick={() => setWpfFileTab('manifest')}
                className={`px-2.5 py-1 rounded transition-colors font-mono flex items-center gap-1 cursor-pointer ${
                  wpfFileTab === 'manifest'
                    ? 'bg-slate-700 text-emerald-300 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>app.manifest</span>
              </button>
              <button
                onClick={() => setWpfFileTab('csproj')}
                className={`px-2.5 py-1 rounded transition-colors font-mono cursor-pointer ${
                  wpfFileTab === 'csproj'
                    ? 'bg-slate-700 text-sky-300 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                .csproj
              </button>
            </div>
          )}
        </div>

        {/* Kopyala ve İndir Butonları */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Tüm Kodu Kopyala"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">Kopyalandı</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Kodu Kopyala</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
            title="Dosya Olarak İndir"
          >
            <Download className="w-3.5 h-3.5" />
            <span>İndir ({getCurrentFileName()})</span>
          </button>
        </div>
      </div>

      {/* Bilgilendirici İpuçları Şeridi */}
      <div className="px-4 py-2 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-sky-400" />
          <span className="font-mono text-slate-200 font-semibold">{getCurrentFileName()}</span>
          <span className="text-slate-600">•</span>
          <span>
            {activeMode === 'fluent'
              ? 'Windows 11 Fluent Light Theme (Action Bar, Arama Kutusu, 4 Sütunlu Grid, Gelişmiş Temizleme Paneli, Status Bar).'
              : 'Kayıt Defteri (HKLM/HKCU) okuma, süreç bekleme (WaitForExit) ve yönetici izinleri (UAC).'}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-sky-400 bg-sky-950/40 px-2 py-0.5 rounded border border-sky-800/40">
          <Layout className="w-3.5 h-3.5" />
          <span>Sade UI İskeleti</span>
        </div>
      </div>

      {/* Kod Editör Alanı */}
      <div className="flex-1 overflow-auto bg-[#0b1120] p-4 text-xs font-mono">
        <pre className="text-slate-200 leading-relaxed select-all">
          <code>{getCurrentCode()}</code>
        </pre>
      </div>

      {/* Çalıştırma Rehberi Alt Çubuğu */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-400">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span>Çalıştırma:</span>
          <code className="bg-slate-900 px-2 py-1 rounded text-emerald-300 font-mono text-[11px] border border-slate-800">
            {activeLang === 'pyqt5' ? 'python fluent_uninstaller_ui.py' : 'dotnet run'}
          </code>
        </div>

        <div className="flex items-center gap-2 text-slate-400 text-[11px]">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Windows 11 Fluent Design • Segoe UI • Sade Light Theme</span>
        </div>
      </div>
    </div>
  );
};
