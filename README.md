# Sift Uninstaller

A Windows desktop app for managing installed programs and reviewing leftover cleanup candidates.

[English](#english) · [Türkçe](#türkçe) · [Downloads](https://github.com/canok07/sift-uninstaller/releases) · [Report an issue](https://github.com/canok07/sift-uninstaller/issues)

## English

### About

Sift Uninstaller brings desktop programs, Microsoft Store apps and Windows components into one interface. It uses Windows Registry and AppX information to list installed software, launches native uninstallers and offers a separate, user-reviewed cleanup step.

The project is under active development in the **0.5 series**. The current source version is **0.5.1.7**. Installer availability and versions are listed on the [Releases page](https://github.com/canok07/sift-uninstaller/releases).

### Features

- **Organized application list:** separate tabs for Desktop Programs, Store Apps and Windows Components, plus an all-apps view.
- **Search and sorting:** search by application, publisher or Registry path; sort by name, size, publisher or installation date where the information is available.
- **Native uninstalling:** run registered desktop uninstallers or remove current-user Store/MSIX packages through Windows. Double-clicking a row opens a confirmation dialog rather than immediately removing it.
- **Removal verification:** check Registry or AppX presence after the uninstaller exits. Entries remain listed when removal cannot be confirmed; cleanup is deferred when a restart is required.
- **Focused leftover review:** look for name-based folder and Registry candidates in selected AppData, LocalAppData, ProgramData, HKCU Software and HKLM Software locations. Nothing is selected for deletion by default.
- **Cleanup safeguards:** exclude shared publisher roots, restrict file targets to allowed locations, and reject junction/link targets and protected Registry areas. Partial failures remain visible in the cleanup window.
- **Optional uninstall settings:** attempt a Windows restore point before removal and enable silent options for recognized MSI, Inno Setup and NSIS uninstallers.
- **Diagnostics and appearance:** persistent operation/error logs, a system/permission status panel, and light/dark themes.

### Install and use

The desktop build targets **64-bit Windows 10 and Windows 11**. A packaged installation does not require Node.js.

1. Download an available `Sift Uninstaller-Setup-<version>.exe` from [Releases](https://github.com/canok07/sift-uninstaller/releases) and run the installer.
2. Launch Sift Uninstaller and approve the Windows administrator prompt. The packaged app requires administrator access.
3. Select a category, find the program, and open the uninstall confirmation using the row's action or a double-click.
4. After verified removal, review any cleanup candidates. Select only the items you recognize and want to delete.

Open diagnostics through **Settings → Open Logs** (currently labelled **Ayarlar → Logları Aç** in the Turkish interface).

### Important limitations

- Leftover detection uses names and a limited set of locations. It is not a full-drive scan and does not guarantee that every leftover is found or that every name match belongs to the selected app.
- Cleanup permanently deletes selected files, folders and Registry keys. Review paths carefully and back up important data first.
- Removing Windows components can affect the operating system. Their category and extra warning are not a recommendation to remove them.
- Size, publisher and installation dates depend on Windows/app metadata. Missing, malformed or future dates are displayed as unavailable rather than guessed.
- Restore-point creation depends on Windows System Protection, permissions and frequency limits. Removal can continue if the restore-point attempt fails; a restore point is not a complete file backup.
- Browser preview is **demo mode**: it cannot read the computer's real Registry or uninstall installed programs.
- Logs can contain application names and local paths. Review them before sharing an issue report.

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
| `npm run lint` | TypeScript checking |
| `npm run dist` | Build a Windows NSIS installer in `release/` |
| `npm run dist:dir` | Build an unpacked application in `release/win-unpacked/` |

For the unpacked build, keep the entire output folder together; the executable is not a standalone file. Development mode does not automatically require elevation; privileged operations may need an elevated terminal.

### Project structure

- `electron/`: Windows integration, uninstall verification, cleanup validation and the IPC bridge.
- `src/`: React interface, shared types, result presentation and version display.
- `tests/`: regression coverage for cleanup safety, scan results and uninstall verification.
- `electron-builder.config.cjs`: Windows packaging and version mapping.

Report problems on [GitHub Issues](https://github.com/canok07/sift-uninstaller/issues), including the app version, Windows version, steps to reproduce and relevant log excerpts with private information removed.

### License

Sift Uninstaller is licensed under the [MIT License](LICENSE). Existing file-specific notices and third-party dependency licenses remain applicable.

---

## Türkçe

### Hakkında

Sift Uninstaller; masaüstü programlarını, Microsoft Store uygulamalarını ve Windows bileşenlerini tek arayüzde yönetmenize yardımcı olan bir Windows masaüstü uygulamasıdır. Kurulu yazılımları Windows Registry ve AppX bilgilerinden listeler, yerel kaldırıcıları çalıştırır ve ayrı bir aşamada kullanıcı onaylı kalıntı temizliği sunar.

Proje **0.5 serisinde**, aktif geliştirme aşamasındadır. Güncel kaynak kod sürümü **0.5.1.7**'dir. İndirilebilir kurulum dosyaları ve sürümleri [Releases sayfasında](https://github.com/canok07/sift-uninstaller/releases) yer alır.

### Özellikler

- **Düzenli uygulama listesi:** Masaüstü Programları, Store Uygulamaları ve Windows Bileşenleri için ayrı sekmeler; ayrıca tüm uygulamaları gösteren görünüm.
- **Arama ve sıralama:** uygulama adı, yayıncı veya Registry yoluyla arama; bilgi mevcut olduğunda ad, boyut, yayıncı ve kurulum tarihine göre sıralama.
- **Windows üzerinden kaldırma:** kayıtlı masaüstü kaldırıcılarını çalıştırma ve mevcut kullanıcının Store/MSIX paketlerini Windows üzerinden kaldırma. Satıra çift tıklamak doğrudan silmez, onay penceresini açar.
- **Kaldırma doğrulaması:** kaldırıcı kapandıktan sonra Registry veya AppX varlığını kontrol etme. Kaldırılması doğrulanamayan uygulamalar listede kalır; yeniden başlatma gerektiğinde temizlik ertelenir.
- **Hedefli kalıntı incelemesi:** seçilen AppData, LocalAppData, ProgramData, HKCU Software ve HKLM Software alanlarında ada dayalı klasör ve Registry adaylarını arama. Hiçbir öğe varsayılan olarak silinmek üzere seçilmez.
- **Temizlik korumaları:** ortak yayıncı köklerini adaylardan çıkarma, dosya hedeflerini izin verilen alanlarla sınırlandırma; junction/bağlantı hedeflerini ve korunan Registry alanlarını engelleme. Kısmi başarısızlıklar temizlik penceresinde görünür kalır.
- **İsteğe bağlı kaldırma ayarları:** kaldırma öncesinde Windows geri yükleme noktası oluşturmayı deneme; tanınan MSI, Inno Setup ve NSIS kaldırıcıları için sessiz seçenekler.
- **Tanılama ve görünüm:** kalıcı işlem/hata günlükleri, sistem ve yetki durumu paneli, açık ve koyu tema.

### Kurulum ve kullanım

Masaüstü sürümü **64 bit Windows 10 ve Windows 11** için hazırlanır. Paketlenmiş uygulamayı kullanmak için Node.js gerekmez.

1. [Releases](https://github.com/canok07/sift-uninstaller/releases) sayfasından mevcut `Sift Uninstaller-Setup-<sürüm>.exe` dosyasını indirip kurulum sihirbazını çalıştırın.
2. Sift Uninstaller'ı açıp Windows yönetici izni isteğini onaylayın. Paketlenmiş uygulama yönetici yetkisi gerektirir.
3. İlgili sekmeden programı bulun. Satırdaki kaldırma eylemini kullanarak veya çift tıklayarak onay penceresini açın.
4. Kaldırma doğrulandıktan sonra bulunan temizlik adaylarını inceleyin. Yalnızca tanıdığınız ve silmek istediğiniz öğeleri seçin.

İşlem günlüklerine **Ayarlar → Logları Aç** yoluyla ulaşabilirsiniz.

### Bilinmesi gerekenler

- Kalıntı taraması, ad eşleşmelerini ve belirli alanları kullanır. Tüm diski taramaz; bütün kalıntıları bulmayı veya her ad eşleşmesinin seçilen programa ait olduğunu garanti etmez.
- Temizlik, seçili dosyaları, klasörleri ve Registry anahtarlarını kalıcı olarak siler. Yolları dikkatle inceleyin ve önemli verilerinizi önceden yedekleyin.
- Windows bileşenlerini kaldırmak işletim sistemini etkileyebilir. Ayrı sekmede gösterilmeleri ve ek uyarı bulunması, kaldırılmalarının önerildiği anlamına gelmez.
- Boyut, yayıncı ve kurulum tarihi Windows/uygulama verilerine bağlıdır. Eksik, hatalı veya gelecekteki tarihler tahmin edilmez; belirtilmemiş olarak gösterilir.
- Geri yükleme noktası oluşturmak Windows Sistem Korumasına, yetkilere ve sıklık sınırlarına bağlıdır. Bu deneme başarısız olduğunda kaldırma devam edebilir; geri yükleme noktası tam bir dosya yedeği değildir.
- Tarayıcı önizlemesi **demo modudur**: bilgisayarın gerçek Registry verilerini okuyamaz veya kurulu programları kaldıramaz.
- Günlükler uygulama adları ve yerel dosya yolları içerebilir. Hata bildirimiyle paylaşmadan önce inceleyin.

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
| `npm run lint` | TypeScript denetimi |
| `npm run dist` | `release/` altında Windows NSIS kurulum dosyası üretme |
| `npm run dist:dir` | `release/win-unpacked/` altında paketlenmiş uygulama klasörü üretme |

Kurulumsuz klasör çıktısını kullanırken bütün dosyaları birlikte tutun; EXE tek başına çalışacak bağımsız bir dosya değildir. Geliştirme modu otomatik olarak yönetici yetkisi istemez; yetki gerektiren işlemler için terminali yönetici olarak açmanız gerekebilir.

### Proje yapısı

- `electron/`: Windows entegrasyonu, kaldırma doğrulaması, temizlik hedeflerinin denetimi ve IPC köprüsü.
- `src/`: React arayüzü, ortak tipler, işlem sonuçlarının gösterimi ve sürüm bilgisi.
- `tests/`: temizlik güvenliği, tarama sonuçları ve kaldırma doğrulaması için regresyon testleri.
- `electron-builder.config.cjs`: Windows paketleme ayarları ve sürüm eşlemesi.

Sorunları [GitHub Issues](https://github.com/canok07/sift-uninstaller/issues) üzerinden bildirebilirsiniz. Uygulama sürümünü, Windows sürümünü, tekrar oluşturma adımlarını ve özel bilgileri çıkarılmış ilgili günlük satırlarını ekleyin.

### Lisans

Sift Uninstaller, [MIT Lisansı](LICENSE) ile sunulur. Dosyalardaki mevcut özel lisans bildirimleri ve üçüncü taraf bağımlılıkların kendi lisansları geçerliliğini korur.
