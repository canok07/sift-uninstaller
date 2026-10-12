# Verification and safety boundaries

## English

### Distribution 0.5.1.20

The [0.5.1.20 development release](https://github.com/canok07/sift-uninstaller/releases/tag/v0.5.1.20) contains the locally verified unsigned setup and matching SHA-256 file. The uploaded asset is named `Sift.Uninstaller-Setup-0.5.1.20.exe`; its bytes and hash are those documented below. Distribution does not expand the acceptance-test claims.

### Local version 0.5.1.20

2026-10-12: Windows type checks/builds and all 92 regressions passed. Source and final packaged production Electron checks passed. A separate hidden demo window injects denied storage before mounting the actual App, verifies theme switching, session-only warnings and a failed-save notification, and rejects the log bridge to check visible feedback both in Settings and the error-recovery screen. The Settings dialog stays inside a 960×640 window with no horizontal overflow. Storage utility tests cover denied reads/writes, invalid preferences, safe settings defaults and successful persistence. These fault-injection checks use source components, not a real storage corruption of the user's profile.

Local unsigned setup: `release/0.5.1.20/Sift Uninstaller-Setup-0.5.1.20.exe`, 111,455,518 bytes, FileVersion 0.5.1.20; ASAR npm version 0.5.1-20. Embedded main/preload/HTML match the tested build. SHA-256: `6962E2642B1C22C677FE3BB298225FC89D587F328DA4452B4D9A18ED2255581B`. No live app was closed, installed user program removed, real Registry mutated or user data cleaned. Installer execution/upgrade/UAC acceptance remains untested. This update is local, not a GitHub publication; published setup remains 0.5.1.18.

### Local version 0.5.1.19

2026-10-12: Type checks/build, all 89 regressions, and source/final packaged Electron checks passed on Windows. The new read-only Registry report was opened and run through the actual renderer/preload/main, and its screenshot inspected. All three Registry sources were readable; 109 installation records produced six findings, with an explicit incomplete-report warning for executable metadata that could not be verified. This is not evidence of obsolete keys or permission to delete them. Tests cover unsupported/missing commands, distinct versions/publishers, cached file probes, record/finding/time limits, source failures, escaped UI text, IPC sender/input checks, unchanged program authorization and blocking during active uninstall tracking.

Local unsigned setup: `release/0.5.1.19/Sift Uninstaller-Setup-0.5.1.19.exe`, 111,455,072 bytes, file version 0.5.1.19; ASAR npm version 0.5.1-19. Embedded main/preload/HTML match the tested build. SHA-256: `1E4C04A390CF790062727F418C31DA3AD60EDAB4B76312A1C61A97EE50EA2F7D`. No installer/UAC execution, installed-user-program removal, user-data cleanup or real Registry mutation was performed. GitHub publication is not part of this local update; published setup remains 0.5.1.18.

### Version 0.5.1.18

2026-10-11: Windows type checks/builds, all 84 regressions and final packaged Electron checks pass. The header source summary and short toolbar preserve scan warnings; the popup's corners and center remain unobscured. Its screenshot was inspected. At 1200×820 the toolbar is 38 logical pixels and the table starts at 164.5, 65 pixels earlier than in 0.5.1.17; 960×640 layout is also checked. Added full fixture lifecycle coverage preserves unselected and reinstalled data. Automated removal/recovery uses test-owned fixtures, not installed user programs.

Unsigned EXE: release/0.5.1.18/Sift Uninstaller-Setup-0.5.1.18.exe, 111,452,457 bytes, file version 0.5.1.18, ASAR npm version 0.5.1-18. Release asset: Sift.Uninstaller-Setup-0.5.1.18.exe; matching digest: SHA256SUMS-0.5.1.18.txt. See the [versioned development release](https://github.com/canok07/sift-uninstaller/releases/tag/v0.5.1.18) for downloads.

Separately authorized live MSI testing: WinSCP 6.5.7 installation failed twice with 1603 due to the installer's legacy EXE condition; no guessed Registry keys/settings were removed and no condition bypassed. Official signed WinDirStat 2.9.2 x64 MSI then installed successfully (MSI return 0, registered ProductCode and executable). WinDirStat was not opened for disk scanning and has not been removed through Sift. Real MSI removal, full reinstall chain, clean Windows and upgrade/UAC acceptance remain unverified. The installer is unsigned. Raw host MSI logs are not published.

### Previous local 0.5.1.17 evidence

Current local source **0.5.1.17**: Windows type checks/builds, all 82 regressions and source/packaged Electron tests passed on 2026-10-10. Four new regressions cover bounded logical file-size measurement, exact/normalized/publisher discovery reasons, unknown/Registry/demo display states and metadata from the production scan handler. Link/depth protections remain covered. The actual cleanup component was rendered with display-only folder/Registry fixtures; its explanation, measured example size, ownership caveat and unselected default were checked and its screenshot inspected. No real cleanup is implied by that visual fixture. The unsigned EXE file version 0.5.1.17 and ASAR npm version 0.5.1-17 were checked; checksum is in release/SHA256SUMS-0.5.1.17.txt. No publication or real installer/UAC/removal/reinstall test was performed. Next approval is roadmap item 7, not a new UI stage.

### Previous local 0.5.1.16 evidence

Local source version: **0.5.1.16**. Type checks, builds, 78 regressions and source/packaged Electron tests passed on Windows on 2026-10-10; not published. New regressions cover completed and partial cleanup, current-list counters versus scan snapshots, exact backup IDs and explicit restore confirmation with no fallback to unrelated backups. Native layout checks cover 1200×820 and 960×640 content areas; light/dark screenshots were inspected. The restore-point timeout is checked with an accelerated timer and substituted Windows work: no actual checkpoint or uninstaller is executed. The current published installer remains 0.5.1.13. Real acceptance-test requirements are listed in [isolated Windows tests](ISOLATED_WINDOWS_TESTS.md).

The 0.5.1.16 unsigned installer was built, its file version and packaged ASAR version checked and its checksum recorded locally in release/SHA256SUMS-0.5.1.16.txt. Installer execution/live UAC remain unverified. Earlier 0.5.1.14/15 evidence remains historical, not proof of a successful real uninstall. The native recovery round trip uses owned fixtures; completed-cleanup and focused-backup UI behavior are covered by regression component tests, not a real user cleanup.

- TypeScript and renderer/main builds passed.
- The local 0.5.1.14 unsigned NSIS installer was built and its packaged ASAR/version checked. Checksum is local in release/SHA256SUMS-0.5.1.14.txt. Installer execution/live UAC were not tested.
- 70 regressions cover the previous identity/security/cleanup cases plus similar-name/installed-location ownership exclusions, incomplete/fresh inventories, backup deletion scope/stale-token/state/link guards, restart PID reuse, interrupted/corrupt journals and explicit acknowledgement. A real harmless test-owned Windows process is queried across fresh main-handler contexts; no real uninstaller is used. This is not a full app/installer upgrade test.
- Hidden Electron integration uses the production renderer/preload/main with a sandbox, isolated profiles, read-only Windows inventory and substituted harmless uninstall processes. CSP blocks inline scripts; popups are denied. It checks themes, icons, logging, confirmation/cancellation, renderer reload, a fixture-only recovery round trip, backup size display and delete/cancel confirmation. Only the selected test backup is deleted; restored test data remains. Source and final packaged modes passed on 2026-10-09.
- Automated regression Registry mutations are mocks. Electron recovery writes only test-owned fixture files. No installed user program is removed and no user data is cleaned.
- A packaged NSIS installer is built and its version, embedded code and checksum are checked separately. This is not an installer execution, live UAC, real MSI/Store uninstall or upgrade test. No isolated Windows installer VM was available locally.

Limits: cleanup candidate ownership is heuristic; external concurrent changes cannot be made atomic using these path/Registry operations. Do not run other installers or data modifiers during cleanup/recovery. Backups are local and not an independent disaster-recovery copy. Partial recovery keeps both its payload and any already-created output for inspection; do not automatically delete/retry the output. Old-format backups are retained for manual review. File-tree checks are bounded to 10,000 entries/32 levels, content checks to 512 MiB, Registry backups to 16 MiB, and recovery lists to the latest 200 records. An unsigned development installer can trigger Windows trust warnings.

Development uses trusted loopback Vite only. Its React refresh preamble needs inline scripts; **packaged** HTML does not permit inline scripts/eval and disables network connections. A sandbox and IPC validation are defenses, not proof that arbitrary local installer executables are safe; uninstalling remains an explicitly confirmed, elevated operation.

Reference: [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security/).

## Türkçe

### 0.5.1.20 dağıtımı

[0.5.1.20 geliştirme yayını](https://github.com/canok07/sift-uninstaller/releases/tag/v0.5.1.20), yerelde doğrulanan imzasız setup ve eşleşen SHA-256 dosyasını içerir. Yüklenen dosya adı `Sift.Uninstaller-Setup-0.5.1.20.exe`; baytları ve özeti aşağıdaki doğrulamaya aittir. Yayın yapılması kabul testi kapsamını genişletmez.

### Yerel 0.5.1.20 sürümü

2026-10-12: Windows tip denetimi/derlemeleri ve 92 regresyonun tamamı geçti. Kaynak ve son paket üretim Electron kontrolleri geçti. Ayrı gizli demo penceresinde gerçek App açılmadan kayıt erişimi engellendi; tema değişimi, oturumluk ayar uyarıları ve başarısız kayıt bildirimi kontrol edildi. Log köprüsü hata verecek şekilde değiştirilerek Ayarlar ve hata kurtarma ekranındaki görünür geri bildirim doğrulandı. Ayarlar penceresi 960×640 boyutta ekran içinde kaldı; yatay taşma olmadı. Yardımcı testler kayıt okuma/yazma engelini, geçersiz tercihleri, güvenli varsayılanları ve başarılı kaydı kapsar. Bu hata benzetimleri kaynak bileşenleri kullanır; kullanıcının profili bozulmadı.

Yerel imzasız setup: `release/0.5.1.20/Sift Uninstaller-Setup-0.5.1.20.exe`, 111.455.518 bayt; FileVersion 0.5.1.20, ASAR npm sürümü 0.5.1-20. Paket ana süreç/köprü/HTML test edilen derlemeyle aynı. SHA-256: `6962E2642B1C22C677FE3BB298225FC89D587F328DA4452B4D9A18ED2255581B`. Açık uygulama kapatılmadı, kurulu kullanıcı programı kaldırılmadı, gerçek Registry değiştirilmedi ve kullanıcı verisi temizlenmedi. Kurulum/yükseltme/canlı UAC kabulü test edilmedi. Bu güncelleme yereldir; GitHub yayını yapılmadı, yayımlanan setup 0.5.1.18 kaldı.

### Yerel 0.5.1.19 sürümü

2026-10-12: Windows tip denetimi/derlemesi, 89 regresyonun tamamı ve kaynak/son paket Electron kontrolleri geçti. Yeni salt okunur Registry raporu gerçek arayüz/köprü/ana süreç üzerinden açılıp çalıştırıldı ve görüntüsü incelendi. Üç Registry kaynağı okunabildi; 109 kurulum kaydında altı bulgu gösterildi. Durumu doğrulanamayan kaldırıcı dosyaları için raporun eksik olduğu açıkça belirtildi. Bu, kayıtların gereksiz olduğu veya silinebileceği anlamına gelmez. Eksik/desteklenmeyen komutlar, sürüm/yayıncı ayrımı, dosya kontrol önbelleği, kayıt/bulgu/süre sınırları, kaynak hataları, güvenli metin gösterimi, IPC gönderen/girdi kontrolü, mevcut program yetkilerinin korunması ve kaldırıcı takibi sürerken engelleme test edildi.

Yerel imzasız setup: `release/0.5.1.19/Sift Uninstaller-Setup-0.5.1.19.exe`, 111.455.072 bayt, dosya sürümü 0.5.1.19; ASAR npm sürümü 0.5.1-19. Paket ana süreç/köprü/HTML dosyaları test edilen derlemeyle aynı. SHA-256: `1E4C04A390CF790062727F418C31DA3AD60EDAB4B76312A1C61A97EE50EA2F7D`. Kurulum/canlı UAC, gerçek kullanıcı programını kaldırma, kullanıcı verisi temizleme veya gerçek Registry değişikliği yapılmadı. Bu yerel güncellemede GitHub yayını yapılmadı; yayımlanan setup 0.5.1.18 olarak kaldı.

### 0.5.1.18 sürümü

2026-10-11: Windows tip denetimi/derlemeleri, 84 regresyonun tümü ve son paket Electron kontrolü geçti. Başlıktaki kaynak özeti ve kısa araç çubuğu tarama uyarılarını korur; açılır panelin köşeleri ve ortası başka kontrollerin altında kalmaz. Görüntüsü incelendi. 1200×820 içerikte araç çubuğu 38 mantıksal piksel, liste başlangıcı 164,5; 0.5.1.17'den 65 piksel yukarıdadır. 960×640 düzeni de kontrol edildi. Yeni tam test dosyası döngüsü seçilmeyen veriyi ve yeniden kurulmuş veriyi korur. Otomatik kaldırma/geri alma, kurulu kullanıcı programıyla değil testin kendi verileriyle yapılır.

İmzasız EXE: release/0.5.1.18/Sift Uninstaller-Setup-0.5.1.18.exe, 111.452.457 bayt; dosya sürümü 0.5.1.18, ASAR npm sürümü 0.5.1-18. Sürüm dosyası: Sift.Uninstaller-Setup-0.5.1.18.exe; eşleşen özet: SHA256SUMS-0.5.1.18.txt. İndirmeler [sürüme özel geliştirme yayını](https://github.com/canok07/sift-uninstaller/releases/tag/v0.5.1.18) sayfasındadır.

Ayrıca açıkça onaylanan gerçek MSI testinde WinSCP 6.5.7, kurucunun eski EXE koşulu nedeniyle iki kez 1603 ile kurulamadı. Tahmin edilen Registry anahtarları/ayarlar silinmedi, koşul atlanmadı. Resmî imzalı WinDirStat 2.9.2 x64 MSI daha sonra başarılı kuruldu (MSI sonucu 0, ProductCode ve EXE mevcut). WinDirStat disk taraması için açılmadı ve Sift ile henüz kaldırılmadı. Gerçek MSI kaldırma, tam yeniden kurma döngüsü, temiz Windows ve yükseltme/UAC kabulü doğrulanmadı. Kurulum imzasızdır. Ana sistem MSI günlükleri yayımlanmaz.

### Önceki yerel 0.5.1.17 kanıtları

Güncel yerel kaynak **0.5.1.17**: 2026-10-10 tarihinde Windows tip denetimi/derlemeleri, 82 regresyonun tümü ve kaynak/paket Electron testleri geçti. Dört yeni regresyon sınırlı dosya boyutu ölçümünü, tam/sadeleştirilmiş/yayıncı adından bulunma gerekçesini, eksik/Registry/demo gösterimini ve gerçek tarama işleyicisinin döndürdüğü açıklamaları kapsar. Bağlantı/derinlik korumaları da kontrol edilir. Gerçek temizlik bileşeni yalnızca görsel amaçlı klasör/Registry test kayıtlarıyla gösterildi; açıklama, örnek ölçüm, sahiplik uyarısı ve varsayılan seçimsiz durum kontrol edilip görüntüsü incelendi. Bu görsel test gerçek temizlik yapıldığı anlamına gelmez. İmzasız EXE dosya sürümü 0.5.1.17 ve ASAR npm sürümü 0.5.1-17 kontrol edildi; özet release/SHA256SUMS-0.5.1.17.txt içindedir. Yayın veya gerçek kurulum/UAC/kaldırma/yeniden kurma testi yapılmadı. Sonraki onay yeni bir arayüz aşaması için değil, yol haritası 7 içindir.

### Önceki yerel 0.5.1.16 kanıtları

Yerel kaynak sürümü: **0.5.1.16**. 2026-10-10 tarihinde Windows'ta tip denetimi, derlemeler, 78 regresyon ve kaynak/paket Electron testleri geçti; yayımlanmadı. Yeni regresyonlar tamamlanan/kısmi temizliği, güncel liste ile son tarama sayaçlarının ayrımını, kesin yedek kimliklerini ve başka yedeğe geçmeden açık geri alma onayını kapsar. Yerel arayüz düzeni 1200×820 ve 960×640 içerik alanlarında kontrol edildi; açık/koyu tema görüntüleri incelendi. Geri yükleme süre aşımı hızlandırılmış zamanlayıcı ve taklit Windows işlemiyle kontrol edilir; gerçek checkpoint veya kaldırıcı çalıştırılmaz. Güncel yayımlanmış kurulum 0.5.1.13'tür. Gerçek kabul testi gereklilikleri [izole Windows testlerinde](ISOLATED_WINDOWS_TESTS.md) listelenir.

0.5.1.16 imzasız kurulum üretildi, dosya ve paket ASAR sürümü kontrol edildi; özeti yerel release/SHA256SUMS-0.5.1.16.txt içine kaydedildi. Gerçek kurulum/canlı UAC henüz doğrulanmadı. Önceki 0.5.1.14/15 kanıtları tarihseldir; gerçek kaldırmanın başarılı olduğunu kanıtlamaz. Yerel geri alma testi yalnızca testin kendi dosyalarını kullanır; tamamlanan temizlik ve filtreli yedek arayüzü gerçek kullanıcı temizliğiyle değil, bileşen regresyonlarıyla kontrol edildi.

- TypeScript ve arayüz/ana süreç derlemeleri geçti.
- Yerel 0.5.1.14 imzasız NSIS kurulumu üretildi; paket içindeki ASAR/sürüm kontrol edildi. Özet release/SHA256SUMS-0.5.1.14.txt içinde yereldir. Gerçek kurulum/canlı UAC denenmedi.
- 70 regresyon; önceki kimlik/güvenlik/temizlik durumlarına ek olarak benzer ad/kurulum konumu çakışmasını, eksik/yeni envanteri, yedek silme kapsamı/eski onay/durum/bağlantı korumalarını, yeniden kullanılan PID'yi, kesintili/bozuk takibi ve açık onayı kapsar. Gerçek Windows başlangıç zamanı, testin kendi zararsız süreciyle yeni ana süreç bağlamlarında sorgulanır; gerçek kaldırıcı kullanılmaz. Bu tam uygulama/kurulum yükseltme testi değildir.
- Gizli Electron testi; gerçek arayüz/köprü/ana süreç, sandbox, ayrı profiller, salt okunur Windows listesi ve zararsız test süreçleri kullanır. CSP satır içi betiği engeller, yeni pencere reddedilir. Tema, simge, günlük, onay/iptal, arayüz yeniden yükleme, yalnızca test dosyasıyla geri alma, boyut gösterimi ve yedek silme/iptal kontrol edilir. Yalnızca seçilen test yedeği silinir; geri alınmış test verisi korunur. Kaynak ve son paket modları 2026-10-09 tarihinde geçti.
- Regresyon testlerindeki Registry değişiklikleri taklittir. Electron geri alma yalnızca testin kendi dosyalarına yazar. Kullanıcının kurulu programı kaldırılmaz ve gerçek verileri temizlenmez.
- NSIS paketi üretilir; sürüm, içindeki kod ve dosya özeti ayrıca kontrol edilir. Bunlar gerçek kurulum, canlı UAC, gerçek MSI/Store kaldırma veya yükseltme testi değildir. Yerelde izole Windows kurulum sanal makinesi bulunmadı.

Sınırlar: kalıntı sahipliği ada dayalı tahmindir; dış süreçlerin eşzamanlı değişiklikleri bu yol/Registry işlemleriyle atomik hale getirilemez. Temizlik/geri alma sırasında başka kurulum veya veri değiştiren araç çalıştırmayın. Yerel yedek bağımsız afet kurtarma yedeği değildir. Kısmi geri alma hem yedeği hem oluşturulmuş çıktıyı inceleme için korur; çıktıyı otomatik silip yeniden denemeyin. Eski biçimdeki yedekler elle inceleme için korunur. Dosya ağacı kontrolü 10.000 öğe/32 seviye, içerik doğrulaması 512 MiB, Registry yedeği 16 MiB, geri alma listesi son 200 kayıtla sınırlıdır. İmzasız geliştirme kurulumunda Windows güven uyarısı çıkabilir.

Geliştirme yalnızca güvenilen yerel Vite üzerinden yapılır. React yenileme betiği bu modda satır içi betik gerektirir; **paketlenmiş** HTML satır içi betik/eval izni vermez ve ağ bağlantısını kapatır. Sandbox ve IPC doğrulaması korumadır; rastgele yerel kaldırıcı EXE'sinin güvenli olduğunu kanıtlamaz. Kaldırma, açık kullanıcı onayıyla yönetici yetkisinde yapılır.

Kaynak: [Electron güvenlik kontrol listesi](https://www.electronjs.org/docs/latest/tutorial/security/).
