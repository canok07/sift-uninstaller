## English

Local development candidate 0.5.1.14 — not published. Adds fresh-inventory cleanup ownership exclusions (similar names/publishers and installed locations), persistent PID/creation-time uninstall tracking, and backup sizes plus explicit per-item deletion. No automatic backup purge, process kills, command replay or recovered cleanup permission.

Type checks and 70 regressions passed on Windows on 2026-10-09. Tests include a real harmless owned process with Windows creation-time queries across fresh main-handler contexts; this is not a full real installer restart/upgrade test. Source and final packaged Electron UI tests passed, checking backup restore and irreversible delete confirmations with test-only files. The local unsigned x64 NSIS installer has version 0.5.1.14; its checksum is recorded in release/SHA256SUMS-0.5.1.14.txt.

Actual installer/live UAC/upgrade, real EXE/MSI/Store removal and real cleanup/reinstall acceptance tests remain blocked pending a disposable Windows VM/Sandbox and user approval for its setup. See docs/ISOLATED_WINDOWS_TESTS.md. No real installed program or user data was removed. Previous-format backups remain for manual review; interrupted/failed backups cannot be deleted through the management screen.

## Türkçe

Yerel geliştirme adayı 0.5.1.14 — yayımlanmadı. Yeni envanterle kalıntı sahipliği korumaları (benzer ürün/yayıncı adları ve kurulum konumları), kalıcı PID/başlangıç zamanı kaldırıcı takibi ve yedek boyutları/öğe bazında açık silme onayı eklendi. Otomatik yedek silme, süreç öldürme, komutu tekrar çalıştırma veya önceki takibe dayanarak temizlik izni verme yoktur.

2026-10-09 tarihinde Windows'ta tip denetimi ve 70 regresyon testi geçti. Testin kendi zararsız süreci, gerçek Windows başlangıç zamanı sorgularıyla yeni ana süreç bağlamları arasında kontrol edildi; bu tam bir gerçek kurulum yeniden başlatma/yükseltme testi değildir. Kaynak ve son paket Electron arayüz testleri geçti; geri alma ve geri alınamaz silme onayları yalnızca test dosyalarıyla kontrol edildi. Yerel imzasız x64 NSIS paketinin sürümü 0.5.1.14; özeti release/SHA256SUMS-0.5.1.14.txt içindedir.

Gerçek kurulum/canlı UAC/yükseltme, gerçek EXE/MSI/Store kaldırma ve gerçek temizlik/yeniden kurma kabul testleri; atılabilir Windows VM/Sandbox ve kurulum onayı bekliyor. docs/ISOLATED_WINDOWS_TESTS.md dosyasına bakın. Gerçek kurulu program veya kullanıcı verisi silinmedi. Eski biçim yedekler elle inceleme için korunur; kesintili/hatalı yedekler yönetim ekranından silinemez.
