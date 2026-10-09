# Verification and safety boundaries

## English

Source version: **0.5.1.13**. Documentation/packaging update; behavior unchanged from 0.5.1.12. Regression/type checks repeated locally on Windows on 2026-10-09. The 0.5.1.12 source and packaged Electron checks passed on 2026-10-08; see the additional 0.5.1.13 package check recorded below.

- TypeScript and renderer/main builds passed.
- The 0.5.1.13 NSIS package was rebuilt on 2026-10-09 and its packaged-ASAR Electron check passed: sandbox/CSP, themes, diagnostics, confirmations/cancellation and fixture-only recovery. The EXE is unsigned; its SHA-256 is published alongside the release asset. Installer execution/live UAC were not tested.
- 59 regression tests cover identity/revisions, input/sender rejection, operation locks, cancellation races, incomplete inventories, diagnostics/history, cleanup scope/link checks, scan-time changes, backup integrity, interrupted journals, and existing/reinstalled target protection.
- Hidden Electron integration uses the production renderer/preload/main with a sandbox, isolated profiles, read-only Windows inventory and substituted harmless uninstall processes. CSP blocks inline scripts; popups are denied. It checks themes, icons, logging, confirmation/cancellation, renderer reload and a fixture-only recovery round trip.
- Automated regression Registry mutations are mocks. Electron recovery writes only test-owned fixture files. No installed user program is removed and no user data is cleaned.
- A packaged NSIS installer is built and its version, embedded code and checksum are checked separately. This is not an installer execution, live UAC, real MSI/Store uninstall or upgrade test. No isolated Windows installer VM was available locally.

Limits: cleanup candidate ownership is heuristic; external concurrent changes cannot be made atomic using these path/Registry operations. Do not run other installers or data modifiers during cleanup/recovery. Backups are local and not an independent disaster-recovery copy. Partial recovery keeps both its payload and any already-created output for inspection; do not automatically delete/retry the output. Old-format backups are retained for manual review. File-tree checks are bounded to 10,000 entries/32 levels, content checks to 512 MiB, Registry backups to 16 MiB, and recovery lists to the latest 200 records. An unsigned development installer can trigger Windows trust warnings.

Development uses trusted loopback Vite only. Its React refresh preamble needs inline scripts; **packaged** HTML does not permit inline scripts/eval and disables network connections. A sandbox and IPC validation are defenses, not proof that arbitrary local installer executables are safe; uninstalling remains an explicitly confirmed, elevated operation.

Reference: [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security/).

## Türkçe

Kaynak sürümü: **0.5.1.13**. Belge/paketleme güncellemesidir; davranış 0.5.1.12 ile aynıdır. Regresyon/tip denetimleri 2026-10-09 tarihinde Windows'ta tekrarlandı. 0.5.1.12 kaynak ve paket Electron kontrolleri 2026-10-08 tarihinde geçti; ek 0.5.1.13 paket kontrolü aşağıda belirtilir.

- TypeScript ve arayüz/ana süreç derlemeleri geçti.
- 0.5.1.13 NSIS paketi 2026-10-09 tarihinde yeniden üretildi ve paket içindeki ASAR ile Electron kontrolü geçti: sandbox/CSP, temalar, günlükler, onay/iptal ve yalnızca test verisiyle geri alma. EXE imzasızdır; SHA-256 özeti sürüm dosyasıyla birlikte yayımlanır. Gerçek kurulum/canlı UAC denenmedi.
- 59 regresyon testi; kimlik/sürüm, girdi/gönderen denetimi, kilitler, iptal zamanlamaları, eksik tarama, günlük/geçmiş, temizlik kapsamı/bağlantı denetimleri, tarama sonrası değişiklik, yedek bütünlüğü, kesintili kayıtlar ve mevcut/yeniden kurulu hedef korumasını kapsar.
- Gizli Electron testi; gerçek arayüz/köprü/ana süreç, sandbox, ayrı profiller, salt okunur Windows listesi ve zararsız test kaldırıcı süreçleri kullanır. CSP satır içi betiği engeller, yeni pencere reddedilir. Tema, simge, günlük, onay/iptal, arayüz yeniden yükleme ve yalnızca test dosyalarıyla geri alma kontrol edilir.
- Regresyon testlerindeki Registry değişiklikleri taklittir. Electron geri alma yalnızca testin kendi dosyalarına yazar. Kullanıcının kurulu programı kaldırılmaz ve gerçek verileri temizlenmez.
- NSIS paketi üretilir; sürüm, içindeki kod ve dosya özeti ayrıca kontrol edilir. Bunlar gerçek kurulum, canlı UAC, gerçek MSI/Store kaldırma veya yükseltme testi değildir. Yerelde izole Windows kurulum sanal makinesi bulunmadı.

Sınırlar: kalıntı sahipliği ada dayalı tahmindir; dış süreçlerin eşzamanlı değişiklikleri bu yol/Registry işlemleriyle atomik hale getirilemez. Temizlik/geri alma sırasında başka kurulum veya veri değiştiren araç çalıştırmayın. Yerel yedek bağımsız afet kurtarma yedeği değildir. Kısmi geri alma hem yedeği hem oluşturulmuş çıktıyı inceleme için korur; çıktıyı otomatik silip yeniden denemeyin. Eski biçimdeki yedekler elle inceleme için korunur. Dosya ağacı kontrolü 10.000 öğe/32 seviye, içerik doğrulaması 512 MiB, Registry yedeği 16 MiB, geri alma listesi son 200 kayıtla sınırlıdır. İmzasız geliştirme kurulumunda Windows güven uyarısı çıkabilir.

Geliştirme yalnızca güvenilen yerel Vite üzerinden yapılır. React yenileme betiği bu modda satır içi betik gerektirir; **paketlenmiş** HTML satır içi betik/eval izni vermez ve ağ bağlantısını kapatır. Sandbox ve IPC doğrulaması korumadır; rastgele yerel kaldırıcı EXE'sinin güvenli olduğunu kanıtlamaz. Kaldırma, açık kullanıcı onayıyla yönetici yetkisinde yapılır.

Kaynak: [Electron güvenlik kontrol listesi](https://www.electronjs.org/docs/latest/tutorial/security/).
