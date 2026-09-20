import React from 'react';
import { Database, ShieldAlert, KeyRound, Layers, Cpu, Compass, CheckCircle2, ShieldCheck, Sparkles, FolderSearch } from 'lucide-react';

export const RegistryDocGuide: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-xl border border-slate-700 shadow-2xl p-6 overflow-y-auto space-y-6 text-slate-200">
      {/* Başlık */}
      <div className="border-b border-slate-800 pb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Database className="w-5 h-5 text-sky-400" />
            Windows Registry, Kaldırma ve Kalıntı Temizleme Mimarisi
          </h2>
          <span className="px-3 py-1 bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 rounded-full text-xs font-semibold flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            UAC Run as Administrator Entegre
          </span>
        </div>
        <p className="text-sm text-slate-400 mt-1">
          Windows'ta kurulu yazılımların Registry analizi, süreç bekleme (process wait), otomatik artık dosya taraması ve yönetici izinleri mimarisi.
        </p>
      </div>

      {/* 3 Temel Registry Yolu */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* HKLM 64-bit */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-blue-500/30 space-y-2">
          <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
            <Cpu className="w-4 h-4" />
            1. HKLM 64-bit (Sistem Geneli)
          </div>
          <p className="text-xs font-mono text-slate-300 break-all bg-slate-900 p-2 rounded border border-slate-800">
            HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            Tüm kullanıcılar için kurulmuş yerel 64-bit uygulamaları içerir (Örn: Google Chrome 64-bit, 7-Zip x64, Node.js).
          </p>
        </div>

        {/* HKLM 32-bit Wow6432Node */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-purple-500/30 space-y-2">
          <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm">
            <Layers className="w-4 h-4" />
            2. HKLM 32-bit (WOW6432Node)
          </div>
          <p className="text-xs font-mono text-slate-300 break-all bg-slate-900 p-2 rounded border border-slate-800">
            HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            64-bit Windows işletim sisteminde çalışan 32-bit uygulamalar burada saklanır (Örn: Steam, Notepad++ 32-bit, eski yardımcı araçlar).
          </p>
        </div>

        {/* HKCU */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-emerald-500/30 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
            <KeyRound className="w-4 h-4" />
            3. HKCU (Kullanıcı Düzeyi)
          </div>
          <p className="text-xs font-mono text-slate-300 break-all bg-slate-900 p-2 rounded border border-slate-800">
            HKEY_CURRENT_USER\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            Yönetici (Admin) izni gerektirmeden yalnızca oturum açan kullanıcıya kurulan modern programlar (Örn: VS Code User, Spotify, Discord).
          </p>
        </div>
      </div>

      {/* 🧹 YENİ: Otomatik Kalıntı Temizliği ve Hedef Dizinler */}
      <div className="bg-slate-950/80 p-5 rounded-xl border border-rose-500/40 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
            <FolderSearch className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              Kaldırma Sonrası Otomatik Kalıntı Arama &amp; Temizleme Mekanizması
            </h3>
            <p className="text-xs text-slate-400">
              Orijinal kaldırıcı kapandığında (<code className="text-sky-300">process.wait()</code>) program adı referans alınarak 5 kritik konum taranır:
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 space-y-1">
            <span className="font-mono text-amber-400 font-semibold">%AppData% (Roaming)</span>
            <p className="text-slate-400 text-[11px]">
              Kullanıcının profil verileri, ayar dosyaları, eklentiler ve oturum önbellekleri.
            </p>
          </div>

          <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 space-y-1">
            <span className="font-mono text-amber-400 font-semibold">%LocalAppData% (Local)</span>
            <p className="text-slate-400 text-[11px]">
              Geçici dosyalar (Temp), kilitlenme raporları (CrashDumps) ve binary önbellekleri.
            </p>
          </div>

          <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 space-y-1">
            <span className="font-mono text-amber-400 font-semibold">C:\ProgramData</span>
            <p className="text-slate-400 text-[11px]">
              Sistemdeki tüm kullanıcılar için paylaşılan ortak veri tabanları ve lisans dosyaları.
            </p>
          </div>

          <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 space-y-1">
            <span className="font-mono text-purple-400 font-semibold">HKCU\Software</span>
            <p className="text-slate-400 text-[11px]">
              Oturum açmış kullanıcıya ait pencere boyutları, MRU geçmişi ve GUI tercih anahtarları.
            </p>
          </div>

          <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 space-y-1 sm:col-span-2">
            <span className="font-mono text-purple-400 font-semibold">HKLM\Software &amp; WOW6432Node</span>
            <p className="text-slate-400 text-[11px]">
              Sistem düzeyinde bırakılan servis konfigürasyonları ve 32/64-bit makine politikaları.
            </p>
          </div>
        </div>
      </div>

      {/* 🛡️ YENİ: Yönetici Yetkisi (Run as Administrator) Entegrasyonu */}
      <div className="bg-slate-950/80 p-5 rounded-xl border border-emerald-500/40 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">
              Windows "Run as Administrator" Yapılandırması Neden Zorunludur?
            </h3>
            <p className="text-xs text-slate-400">
              Dosya ve Kayıt Defteri silme işlemlerinin "Erişim Engellendi (Access Denied / UnauthorizedAccessException)" hatası vermemesi için:
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-2">
            <span className="font-semibold text-sky-300 font-mono">Python (PyQt5) Çözümü:</span>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              <code className="text-emerald-300">ctypes.windll.shell32.IsUserAnAdmin()</code> ile yetki sorgulanır. Eğer yetki yoksa, <code className="text-sky-300">ShellExecuteW(None, 'runas', sys.executable, ...)</code> ile Windows UAC ekranı getirilerek süreç yönetici olarak yeniden başlatılır.
            </p>
          </div>

          <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-2">
            <span className="font-semibold text-purple-300 font-mono">C# (WPF) Çözümü:</span>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Projeye <code className="text-emerald-300">app.manifest</code> eklenir ve <code className="text-amber-300 font-mono">&lt;requestedExecutionLevel level="requireAdministrator" /&gt;</code> tanımlanır. <code className="text-slate-300 font-mono">.csproj</code> içine <code className="text-sky-300 font-mono">&lt;ApplicationManifest&gt;app.manifest&lt;/ApplicationManifest&gt;</code> eklenerek derleme aşamasında EXE'ye kalkan simgesi ve UAC zorunluluğu gömülür.
            </p>
          </div>
        </div>
      </div>

      {/* Kritik Değerler ve Algoritmik Kurallar */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
          <Compass className="w-4 h-4 text-sky-400" />
          Kritik Değerler ve Filtreleme Kuralları
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              1. SystemComponent Filtresi
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Windows güncellemeleri veya dahili bileşenler (DirectX, VC++ Runtimes) <code className="text-sky-300 font-mono">SystemComponent = 1</code> DWORD değerine sahiptir. Kullanıcının yanlışlıkla sistem parçalarını silmesini önlemek için bu anahtarlar atlanmalıdır.
            </p>
          </div>

          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              2. ParentKeyName Filtresi
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Bazı büyük paketlerin (Örn: Office, Adobe Suite) alt modülleri bağımsız anahtar oluşturur fakat <code className="text-sky-300 font-mono">ParentKeyName</code> taşırlar. Liste kirliliğini önlemek için bu alt bileşenler filtrelenir.
            </p>
          </div>

          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              3. DisplayIcon Ayrıştırma (Icon Parsing)
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              <code className="text-sky-300 font-mono">DisplayIcon</code> değeri genellikle tırnaklı ve sonuna indeks eklenmiş bir dizedir (örn: <code className="text-slate-300 font-mono">"C:\App\app.exe",0</code>). Dosya simgesi yüklenirken tırnaklar ve virgül sonrası indeks temizlenmelidir.
            </p>
          </div>

          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              4. Arayüzün Donmasını Önleme (Threading)
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Kayıt defterinde yüzlerce anahtar bulunur ve taranması saniyeler alabilir.
              <br />• PyQt5'te <code className="text-sky-300 font-mono">QThread</code> ve <code className="text-sky-300 font-mono">pyqtSignal</code>,
              <br />• WPF'te ise <code className="text-sky-300 font-mono">await Task.Run(...)</code> ile asenkron tarama uygulanmalıdır.
            </p>
          </div>

          <div className="bg-slate-950/40 p-4 rounded-xl border border-rose-500/30 space-y-2 md:col-span-2">
            <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-rose-400" />
              5. Orijinal Kaldırıcı Penceresini Bekletme (process.wait / Process.WaitForExit)
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Kaldırıcı penceresi kullanıcı tarafından kapatılana veya kaldırma işlemi tamamlanana kadar kodun akışını bekletmek için:
              <br />• <strong>Python (PyQt5):</strong> <code className="text-sky-300 font-mono">process = subprocess.Popen(uninstall_cmd, shell=True)</code> çalıştırılır ve ardından <code className="text-rose-300 font-mono">exit_code = process.wait()</code> ile süreç kapanana kadar beklenir. Arayüzün kilitlenmemesi için bu bekleme ayrı bir <code className="text-sky-300 font-mono">QThread</code> içinde yürütülür.
              <br />• <strong>C# (WPF):</strong> <code className="text-sky-300 font-mono">ProcessStartInfo</code> ile <code className="text-amber-300 font-mono">cmd.exe /c "..."</code> çağrılır ve arka planda <code className="text-rose-300 font-mono">process.WaitForExit()</code> çağrılır.
              <br />• Kaldırma penceresi kapandığı an, otomatik kalıntı temizleme aracı (<code className="text-emerald-400 font-mono">LeftoverScannerThread</code> / <code className="text-emerald-400 font-mono">ScanAndCleanLeftoversAsync</code>) tetiklenir ve bulunan kalıntılar yeni bir iletişim kutusunda kullanıcı onayına sunulur.
            </p>
          </div>
        </div>
      </div>

      {/* Sık Karşılaşılan UninstallString Tipleri */}
      <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800 space-y-3">
        <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          UninstallString Formatları ve Otomasyon Parametreleri
        </h4>
        <div className="text-xs text-slate-300 space-y-2">
          <div className="flex items-start gap-2">
            <span className="font-mono text-sky-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 shrink-0">Inno Setup:</span>
            <span><code className="text-slate-300">"C:\Path\unins000.exe"</code> &rarr; Sessiz kaldırma için: <code className="text-emerald-400">/VERYSILENT /NORESTART</code></span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-mono text-sky-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 shrink-0">MSI (Windows Installer):</span>
            <span><code className="text-slate-300">MsiExec.exe /I&#123;GUID&#125;</code> &rarr; Kaldırma için: <code className="text-emerald-400">MsiExec.exe /X&#123;GUID&#125; /qn /norestart</code></span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-mono text-sky-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 shrink-0">NSIS:</span>
            <span><code className="text-slate-300">"C:\Path\uninstall.exe"</code> &rarr; Sessiz mod için: <code className="text-emerald-400">/S</code></span>
          </div>
        </div>
      </div>
    </div>
  );
};
