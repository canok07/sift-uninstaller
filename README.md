# Sift Uninstaller

A Windows desktop app for managing installed programs and reviewing leftover cleanup candidates.

[English](#english) · [Türkçe](#türkçe) · [Downloads](https://github.com/canok07/sift-uninstaller/releases) · [Report an issue](https://github.com/canok07/sift-uninstaller/issues)

## English

### About

Sift Uninstaller brings desktop programs, Microsoft Store apps and Windows components into one interface. It uses Windows Registry and AppX information to list installed software, launches native uninstallers and offers a separate, user-reviewed cleanup step.

The project is under active development in the **0.5 series**. The current source version is **0.5.1.12**. Installer availability and versions are listed on the [Releases page](https://github.com/canok07/sift-uninstaller/releases). This is a development release, not a claim of production readiness.

### Features

- **Organized application list:** separate tabs for Desktop Programs, Store Apps and Windows Components, plus an all-apps view.
- **Source-aware scanning:** show HKLM, 32-bit Registry, HKCU and Store/AppX results separately. If one source fails, retain the available records with a persistent incomplete-scan warning; do not present failure as an empty successful list.
- **Application identity and icons:** resolve Store display names from package metadata while keeping the technical package name for verification. Load local application icons on demand; keep a letter fallback when metadata or an icon cannot be read.
- **Search and sorting:** search by application, publisher or Registry path; sort by name, size, publisher or installation date where the information is available.
- **Native uninstalling:** run registered desktop uninstallers or remove current-user Store/MSIX packages through Windows. Double-clicking a row opens a confirmation dialog rather than immediately removing it.
- **Removal verification:** check Registry or AppX presence after the uninstaller exits. Entries remain listed when removal cannot be confirmed; cleanup is deferred when a restart is required.
- **Bounded uninstall waiting:** track the launched uninstaller and subsequent verification for up to ten minutes. A confirmed **Stop Waiting** action ends Sift's wait without force-killing the Windows operation. Keep a visible background status and block conflicting actions until the tracked process and any in-flight verification finish. Closing Sift while tracking is active requires another confirmation.
- **Focused leftover review:** look for name-based folder and Registry candidates in selected AppData, LocalAppData, ProgramData, HKCU Software and HKLM Software locations. Nothing is selected for deletion by default.
- **Cleanup safeguards:** exclude shared publisher roots, restrict file targets to allowed locations, and reject junction/link targets and protected Registry areas. Partial failures remain visible in the cleanup window.
- **Reviewable recovery:** journal each cleanup target before mutation and keep a verified backup. Settings → Restore Cleanup Backups offers explicit, per-item confirmation, preserves the backup, and refuses existing targets or reinstalled programs. Interrupted and failed operations remain visible.
- **Desktop security boundaries:** sandboxed renderer, isolated preload bridge, sender/main-frame and bounded input checks on every IPC channel, restricted script policy, and blocked navigation, popups, webviews and permission requests. Desktop EXE uninstallers run without a command shell.
- **Optional uninstall settings:** attempt a Windows restore point before removal and enable silent options for recognized MSI, Inno Setup and NSIS uninstallers.
- **Diagnostics and appearance:** persistent operation/error logs, a system/permission status panel, light/dark themes and a dedicated Sift application icon.
- **Operation history:** reopen the last 100 list-refresh, uninstall, leftover-scan and cleanup results, including timestamps, app names and error details. Demo results are explicitly labelled. Open History from the toolbar clock or Settings.
- **Persistent preferences:** restore-point, scan-area and silent-uninstall options are saved locally alongside the theme.

### Install and use

The desktop build targets **64-bit Windows 10 and Windows 11**. A packaged installation does not require Node.js.

1. Download an available `Sift Uninstaller-Setup-<version>.exe` from [Releases](https://github.com/canok07/sift-uninstaller/releases) and run the installer.
2. Launch Sift Uninstaller and approve the Windows administrator prompt. The packaged app requires administrator access.
3. Select a category, find the program, and open the uninstall confirmation using the row's action or a double-click.
4. After verified removal, review any cleanup candidates. Select only the items you recognize and want to delete.

Open diagnostics through **Settings → Open Logs** (currently labelled **Ayarlar → Logları Aç** in the Turkish interface).

### Important limitations

- Leftover detection uses names and a limited set of locations. It is not a full-drive scan and does not guarantee that every leftover is found or that every name match belongs to the selected app.
- Cleanup is enabled only for programs whose removal was verified in the current session; refreshing the list or restarting the app invalidates that permission. Presence is checked again before cleanup to block installed or reinstalled programs.
- Stopping the wait or reaching its ten-minute limit does **not** cancel or roll back the Windows uninstall, remove the list entry, or grant cleanup permission. Use the uninstaller's own Cancel control first. The limit starts when the uninstaller is launched, not during an earlier restore-point attempt. Tracking covers Sift's launched process and verification, not arbitrary detached subprocesses. Reloading the interface retains tracking; fully closing/restarting Sift loses this in-memory tracking. A later refresh can reflect actual removal but does not authorize cleanup for the stopped operation.
- Selected files/folders are moved into `cleanup-backups` in the app's user-data directory; Registry keys are exported there before deletion. Open **Settings → Restore Cleanup Backups** (Turkish: **Ayarlar → Temizlik Yedeklerini Geri Al**) to review and explicitly restore a verified backup. This restores data, not the program. Existing targets are not intentionally overwritten or merged; partial restore data and backups are preserved for manual review. Previous-format backups remain on disk but are not automatically imported. A cross-volume move can fail safely rather than deleting the original. Backups have no automatic retention/deletion; check disk space.
- File tree identities and Registry export hashes are compared against the scan, and ambiguous application/shared-root names are excluded. This reduces accidental cleanup but name-based discovery still cannot prove ownership. Path checks/moves and Registry checks/imports/deletes are not an atomic OS transaction against another process changing the target concurrently. Do not run external installs or data-modifying tools during cleanup/recovery; important data needs an independent backup.
- Automatic desktop uninstalling supports local absolute EXE paths and MSI commands. Command interpreters, scripts, network executable paths and malformed quoting are rejected; unsupported uninstallers must be run through Windows instead. No command-shell fallback is used.
- Removing Windows components can affect the operating system. Their category and extra warning are not a recommendation to remove them.
- Size, publisher and installation dates depend on Windows/app metadata. Missing, malformed or future dates are displayed as unavailable rather than guessed.
- Restore-point creation depends on Windows System Protection, permissions and frequency limits. If an enabled attempt fails, the app asks whether to cancel or continue without that protection. A restore point is not a complete file backup.
- Browser preview is **demo mode**: it cannot read the computer's real Registry or uninstall installed programs.
- Logs and history can contain application names and local paths. History is stored locally, keeps only the latest 100 results, and shortens very long details; it is not a backup or a complete audit trail. If local storage is unavailable, a warning states that new history is session-only. Review entries before sharing an issue report.
- Desktop diagnostics also capture uncaught UI errors, unhandled promise rejections, React render failures, renderer load/process failures and error-level renderer console messages (including startup module/MIME errors). Reports are local, size/rate-limited and are not uploaded. The recovery screen does not stop an already-running Windows uninstaller; a missing bundle can still prevent that screen from loading.
- Store names depend on manifest/resource availability; unresolved resources retain the technical name and produce a metadata warning. Icons are read only from local files, not network paths. Missing/inaccessible icons and non-default indexed DLL resources can retain the fallback letter or the file's default icon.

### Development

The project uses **Electron, React, TypeScript, Vite and Tailwind CSS**. Use Windows, **Node.js 22.12 or newer**, and npm for local development.

```powershell
npm ci
npm run electron:dev
```

| Command | Purpose |
| --- | --- |
| `npm run electron:dev` | Desktop development with real Windows integration |
| `npm run electron:devtools` | Desktop development with developer tools |
| `npm run dev` | Browser demo at `http://127.0.0.1:3000` |
| `npm test` | Regression tests using isolated fixtures; Windows presence checks are read-only |
| `npm run test:electron` | After `npm run electron:build`, hidden Windows UI/inventory/icon/log/theme and cancellation smoke test; substitutes a harmless test process for real uninstallers and blocks real cleanup |
| `npm run test:electron -- --packaged` | After `npm run dist`, repeat the isolated integration check using the packaged ASAR assets; does not execute the installer/UAC |
| `npm run lint` | TypeScript checking |
| `npm run dist` | Build a Windows NSIS installer in `release/` |
| `npm run dist:dir` | Build an unpacked application in `release/win-unpacked/` |

For the unpacked build, keep the entire output folder together; the executable is not a standalone file. Development mode does not automatically require elevation; privileged operations may need an elevated terminal.

### Project structure

- `electron/`: Windows integration, uninstall verification, cleanup validation and the IPC bridge.
- `src/`: React interface, shared types, result presentation and version display.
- `tests/`: regression coverage for cleanup safety, scan results, uninstall verification, bounded waiting and cancellation races; hidden Electron integration checks use isolated profiles and harmless process fixtures.
- `electron-builder.config.cjs`: Windows packaging and version mapping.

Report problems on [GitHub Issues](https://github.com/canok07/sift-uninstaller/issues), including the app version, Windows version, steps to reproduce and relevant log excerpts with private information removed.

See [verification and safety boundaries](docs/VERIFICATION.md) for the checks performed and remaining manual validation. The repository's Windows workflow repeats type checks, regressions, builds and isolated Electron checks; it does not publish a release automatically.

### License

Sift Uninstaller is licensed under the [MIT License](LICENSE). Existing file-specific notices and third-party dependency licenses remain applicable.

---

## Türkçe

### Hakkında

Sift Uninstaller; masaüstü programlarını, Microsoft Store uygulamalarını ve Windows bileşenlerini tek arayüzde yönetmenize yardımcı olan bir Windows masaüstü uygulamasıdır. Kurulu yazılımları Windows Registry ve AppX bilgilerinden listeler, yerel kaldırıcıları çalıştırır ve ayrı bir aşamada kullanıcı onaylı kalıntı temizliği sunar.

Proje **0.5 serisinde**, aktif geliştirme aşamasındadır. Güncel kaynak kod sürümü **0.5.1.12**'dir. İndirilebilir kurulum dosyaları ve sürümleri [Releases sayfasında](https://github.com/canok07/sift-uninstaller/releases) yer alır. Bu bir geliştirme sürümüdür; üretim kullanımına hazır olduğu iddia edilmez.

### Özellikler

- **Düzenli uygulama listesi:** Masaüstü Programları, Store Uygulamaları ve Windows Bileşenleri için ayrı sekmeler; ayrıca tüm uygulamaları gösteren görünüm.
- **Kaynak bazında tarama:** HKLM, 32 bit Registry, HKCU ve Store/AppX sonuçlarını ayrı gösterme. Bir kaynak okunamazsa erişilebilen kayıtlar korunur ve kalıcı eksik tarama uyarısı görünür; hata, boş başarılı liste gibi gösterilmez.
- **Uygulama adları ve simgeleri:** Store görünen adlarını paket bilgilerinden çözme; doğrulamada teknik paket kimliğini koruma. Yerel program simgelerini ihtiyaç olduğunda yükleme; bilgi veya simge okunamazsa harf simgesini koruma.
- **Arama ve sıralama:** uygulama adı, yayıncı veya Registry yoluyla arama; bilgi mevcut olduğunda ad, boyut, yayıncı ve kurulum tarihine göre sıralama.
- **Windows üzerinden kaldırma:** kayıtlı masaüstü kaldırıcılarını çalıştırma ve mevcut kullanıcının Store/MSIX paketlerini Windows üzerinden kaldırma. Satıra çift tıklamak doğrudan silmez, onay penceresini açar.
- **Kaldırma doğrulaması:** kaldırıcı kapandıktan sonra Registry veya AppX varlığını kontrol etme. Kaldırılması doğrulanamayan uygulamalar listede kalır; yeniden başlatma gerektiğinde temizlik ertelenir.
- **Sınırlı kaldırıcı beklemesi:** başlatılan kaldırıcıyı ve sonraki doğrulamayı en fazla on dakika bekleme. Onaylı **Beklemeyi Bırak** eylemi Windows işlemini zorla kapatmadan Sift'in beklemesini sonlandırır. Takip edilen süreç ve devam eden doğrulama bitene kadar durum görünür kalır ve çakışan işlemler engellenir. Takip sürerken Sift'i kapatmak ayrıca onay ister.
- **Hedefli kalıntı incelemesi:** seçilen AppData, LocalAppData, ProgramData, HKCU Software ve HKLM Software alanlarında ada dayalı klasör ve Registry adaylarını arama. Hiçbir öğe varsayılan olarak silinmek üzere seçilmez.
- **Temizlik korumaları:** ortak yayıncı köklerini adaylardan çıkarma, dosya hedeflerini izin verilen alanlarla sınırlandırma; junction/bağlantı hedeflerini ve korunan Registry alanlarını engelleme. Kısmi başarısızlıklar temizlik penceresinde görünür kalır.
- **İncelenebilir geri alma:** her temizlik hedefi değiştirilmeden önce durum kaydı ve doğrulanmış yedek oluşturma. Ayarlar → Temizlik Yedeklerini Geri Al ekranından öğe bazında açık onay; yedeği koruma ve mevcut hedefte veya yeniden kurulu programda geri almayı engelleme. Kesintili/hatalı işlemler görünür kalır.
- **Masaüstü güvenlik sınırları:** sandbox içinde arayüz, yalıtılmış köprü, bütün IPC kanallarında gönderen/ana çerçeve ve sınırlı girdi denetimi, kısıtlı betik politikası; yönlendirme, yeni pencere, webview ve izin isteklerini engelleme. Masaüstü EXE kaldırıcılarını komut kabuğu olmadan çalıştırma.
- **İsteğe bağlı kaldırma ayarları:** kaldırma öncesinde Windows geri yükleme noktası oluşturmayı deneme; tanınan MSI, Inno Setup ve NSIS kaldırıcıları için sessiz seçenekler.
- **Tanılama ve görünüm:** kalıcı işlem/hata günlükleri, sistem ve yetki durumu paneli, açık/koyu tema ve Sift'e özel uygulama simgesi.
- **İşlem geçmişi:** son 100 liste yenileme, kaldırma, kalıntı taraması ve temizlik sonucunu tarih, program adı ve hata ayrıntısıyla yeniden görüntüleme. Demo kayıtları açıkça işaretlenir. Araç çubuğundaki saat simgesinden veya Ayarlar'dan açılır.
- **Kalıcı tercihler:** geri yükleme noktası, tarama alanı ve sessiz kaldırma seçenekleri tema gibi yerel olarak saklanır.

### Kurulum ve kullanım

Masaüstü sürümü **64 bit Windows 10 ve Windows 11** için hazırlanır. Paketlenmiş uygulamayı kullanmak için Node.js gerekmez.

1. [Releases](https://github.com/canok07/sift-uninstaller/releases) sayfasından mevcut `Sift Uninstaller-Setup-<sürüm>.exe` dosyasını indirip kurulum sihirbazını çalıştırın.
2. Sift Uninstaller'ı açıp Windows yönetici izni isteğini onaylayın. Paketlenmiş uygulama yönetici yetkisi gerektirir.
3. İlgili sekmeden programı bulun. Satırdaki kaldırma eylemini kullanarak veya çift tıklayarak onay penceresini açın.
4. Kaldırma doğrulandıktan sonra bulunan temizlik adaylarını inceleyin. Yalnızca tanıdığınız ve silmek istediğiniz öğeleri seçin.

İşlem günlüklerine **Ayarlar → Logları Aç** yoluyla ulaşabilirsiniz.

### Bilinmesi gerekenler

- Kalıntı taraması, ad eşleşmelerini ve belirli alanları kullanır. Tüm diski taramaz; bütün kalıntıları bulmayı veya her ad eşleşmesinin seçilen programa ait olduğunu garanti etmez.
- Temizlik yalnızca mevcut oturumda kaldırıldığı doğrulanan program için açılır; listeyi yenilemek veya uygulamayı yeniden başlatmak bu izni geçersiz kılar. Temizlik öncesi varlık kontrolü, kurulu veya yeniden kurulmuş programın verilerini korumak için tekrarlanır.
- Beklemeyi bırakmak veya on dakikalık sınırın dolması Windows kaldırmasını **iptal etmez veya geri almaz**; programı listeden çıkarmaz ve temizlik izni vermez. Önce kaldırıcının kendi İptal düğmesini kullanın. Süre, kaldırıcı başlatıldığında başlar; önceki geri yükleme noktası denemesini kapsamaz. Takip, Sift'in başlattığı süreç ve doğrulamayla sınırlıdır; bağımsız başlatılmış alt süreçlerin tamamını kapsamaz. Arayüzü yeniden yüklemek takibi korur; Sift'i tamamen kapatıp açmak bellekteki takibi kaybettirir. Daha sonraki liste yenilemesi gerçek kaldırmayı gösterebilir ancak bırakılan işlem için temizlik izni vermez.
- Seçilen dosya/klasörler uygulamanın kullanıcı verisi dizinindeki `cleanup-backups` alanına taşınır; Registry anahtarları silinmeden önce burada dışa aktarılır. **Ayarlar → Temizlik Yedeklerini Geri Al** ekranından doğrulanmış yedeği inceleyip açık onayla geri alabilirsiniz. Bu işlem programı değil, veriyi geri getirir. Mevcut hedef bilerek ezilmez veya birleştirilmez; kısmi geri alma verisi ve yedek inceleme için korunur. Eski biçimdeki yedekler diskte kalır ancak otomatik içe aktarılmaz. Farklı diskler arasındaki taşıma özgün veriyi silmek yerine başarısız olabilir. Yedekler otomatik silinmez; disk alanını takip edin.
- Dosya ağacı kimlikleri ve Registry dışa aktarım özetleri taramayla karşılaştırılır; belirsiz uygulama/ortak kök adları elenir. Bunlar yanlış temizliği azaltır, ancak ada dayalı tarama sahipliği kanıtlamaz. Yol kontrolü/taşıma ve Registry kontrolü/içe aktarma/silme, başka süreçlerin hedefi değiştirmesine karşı atomik bir Windows işlemi değildir. Temizlik/geri alma sırasında dışarıdan kurulum veya veri değiştiren araçlar çalıştırmayın; önemli verileri ayrıca yedekleyin.
- Otomatik masaüstü kaldırma yerel mutlak EXE yollarını ve MSI komutlarını destekler. Komut yorumlayıcıları, betikler, ağ EXE yolları ve hatalı tırnaklama reddedilir; desteklenmeyen kaldırıcıları Windows üzerinden çalıştırın. Komut kabuğuyla alternatif çalıştırma yapılmaz.
- Windows bileşenlerini kaldırmak işletim sistemini etkileyebilir. Ayrı sekmede gösterilmeleri ve ek uyarı bulunması, kaldırılmalarının önerildiği anlamına gelmez.
- Boyut, yayıncı ve kurulum tarihi Windows/uygulama verilerine bağlıdır. Eksik, hatalı veya gelecekteki tarihler tahmin edilmez; belirtilmemiş olarak gösterilir.
- Geri yükleme noktası oluşturmak Windows Sistem Korumasına, yetkilere ve sıklık sınırlarına bağlıdır. Açık olan bu seçenek başarısız olursa, koruma olmadan devam etme veya iptal etme onayı istenir. Geri yükleme noktası tam bir dosya yedeği değildir.
- Tarayıcı önizlemesi **demo modudur**: bilgisayarın gerçek Registry verilerini okuyamaz veya kurulu programları kaldıramaz.
- Günlükler ve geçmiş, uygulama adları ile yerel yollar içerebilir. Geçmiş bu cihazda saklanır, son 100 sonuçla sınırlıdır ve çok uzun ayrıntıları kısaltır; yedek veya eksiksiz denetim kaydı değildir. Yerel depolama kullanılamıyorsa yeni geçmişin yalnızca oturumda tutulduğu açıkça belirtilir. Paylaşmadan önce kayıtları inceleyin.
- Masaüstü günlükleri yakalanmamış arayüz hatalarını, işlenmemiş Promise hatalarını, React çizim hatalarını, arayüz yükleme/işlem kapanma hatalarını ve arayüz konsolundaki hataları (başlangıç modül/MIME hataları dahil) kaydeder. Kayıtlar yereldir, boyut/sıklık sınırı vardır ve dışarı yüklenmez. Kurtarma ekranı açık Windows kaldırıcısını durdurmaz; eksik bir paket dosyası bu ekranın da yüklenmesini engelleyebilir.
- Store adları manifest/kaynak erişimine bağlıdır; çözülemeyen kaynaklarda teknik ad korunur ve bilgi uyarısı gösterilir. Simgeler ağ yollarından değil, yerel dosyalardan okunur. Eksik/erişilemeyen simgelerde ve varsayılan dışı DLL simge indekslerinde harf veya dosyanın varsayılan simgesi kalabilir.

### Geliştirme

Proje **Electron, React, TypeScript, Vite ve Tailwind CSS** kullanır. Yerel geliştirme için Windows, **Node.js 22.12 veya üzeri** ve npm gerekir.

```powershell
npm ci
npm run electron:dev
```

| Komut | İşlev |
| --- | --- |
| `npm run electron:dev` | Gerçek Windows entegrasyonuyla masaüstü geliştirme |
| `npm run electron:devtools` | Geliştirici araçları açık masaüstü geliştirme |
| `npm run dev` | `http://127.0.0.1:3000` adresinde tarayıcı demosu |
| `npm test` | Ayrı test verileriyle regresyon testleri; Windows varlık kontrolleri salt okunurdur |
| `npm run test:electron` | `npm run electron:build` sonrası gizli Windows arayüz/tarama/simge/günlük/tema ve bekleme iptali kontrolü; gerçek kaldırıcı yerine zararsız test süreci kullanılır, gerçek temizlik engellenir |
| `npm run test:electron -- --packaged` | `npm run dist` sonrası paket içindeki ASAR dosyalarıyla ayrı bütünleşme kontrolü; kurulum/UAC çalıştırılmaz |
| `npm run lint` | TypeScript denetimi |
| `npm run dist` | `release/` altında Windows NSIS kurulum dosyası üretme |
| `npm run dist:dir` | `release/win-unpacked/` altında paketlenmiş uygulama klasörü üretme |

Kurulumsuz klasör çıktısını kullanırken bütün dosyaları birlikte tutun; EXE tek başına çalışacak bağımsız bir dosya değildir. Geliştirme modu otomatik olarak yönetici yetkisi istemez; yetki gerektiren işlemler için terminali yönetici olarak açmanız gerekebilir.

### Proje yapısı

- `electron/`: Windows entegrasyonu, kaldırma doğrulaması, temizlik hedeflerinin denetimi ve IPC köprüsü.
- `src/`: React arayüzü, ortak tipler, işlem sonuçlarının gösterimi ve sürüm bilgisi.
- `tests/`: temizlik güvenliği, tarama sonuçları, kaldırma doğrulaması, sınırlı bekleme ve iptal zamanlamaları için regresyon testleri; gizli Electron bütünleşme kontrollerinde ayrı profiller ve zararsız test süreçleri kullanılır.
- `electron-builder.config.cjs`: Windows paketleme ayarları ve sürüm eşlemesi.

Sorunları [GitHub Issues](https://github.com/canok07/sift-uninstaller/issues) üzerinden bildirebilirsiniz. Uygulama sürümünü, Windows sürümünü, tekrar oluşturma adımlarını ve özel bilgileri çıkarılmış ilgili günlük satırlarını ekleyin.

Yapılan kontroller ve kalan elle doğrulama için [doğrulama ve güvenlik sınırlarına](docs/VERIFICATION.md) bakın. Deponun Windows iş akışı tip denetimi, regresyon, derleme ve ayrı Electron kontrollerini tekrarlar; otomatik sürüm yayınlamaz.

### Lisans

Sift Uninstaller, [MIT Lisansı](LICENSE) ile sunulur. Dosyalardaki mevcut özel lisans bildirimleri ve üçüncü taraf bağımlılıkların kendi lisansları geçerliliğini korur.
