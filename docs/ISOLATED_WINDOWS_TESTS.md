# Isolated Windows acceptance tests / İzole Windows kabul testleri

## English

Status: **not run**. These tests require a disposable Windows VM/Sandbox with no real user programs/data. Administrator/UAC interaction is required. Do not enable Windows features, reboot the host, trust certificates, sideload packages or uninstall host software without separate user approval. A running hypervisor alone does not establish an accessible test VM.

Preparation: record Windows edition/build and app version; take a VM snapshot; use only test-owned programs and data; copy the complete versioned setup and matching checksum into the guest. Do not map personal folders writable. The installer is unsigned. Earlier published 0.5.1.13 is the upgrade baseline; 0.5.1.18 is currently a local candidate, not a verified public release.

| Test | Evidence required | Acceptance |
| --- | --- | --- |
| Clean install and UAC | Setup screenshots, actual UAC approve/reject results, first launch version and logs | Reject does not silently elevate; approve starts the expected version; no missing assets |
| Upgrade from 0.5.1.13 | Before/after version, settings/history/test-backup contents | New version installs; existing preferences/backups preserved; app uninstall verified separately |
| Test EXE and MSI removal | Installer identity, command/exit code, Registry before/after, cancel and reboot-needed scenarios | Correct test program removed; cancellation/failure does not grant cleanup; unrelated programs remain |
| Test Store/MSIX removal | Test package identity/current user, AppX before/after, dependency/nonremovable result | Only the intended removable guest test package changes; no host or system package removal |
| Cleanup and recovery cycle | Known fixture AppData/Registry data, candidates, backup digest, restore result, reinstallation | No unselected/shared/reinstalled data deleted; restored bytes match; existing data never overwritten |
| Full app close/restart while uninstalling | Running test process PID/start time, both app launches, matching/reused/missing PID outcomes | Recover matching launcher only; uncertain record requires acknowledgement; never replay commands/grant cleanup |
| Backup deletion | Size/token, cancel/confirm screenshots, before/after guest files | Cancel preserves backup; confirm deletes only that completed/restored backup; restored original remains |

Record PASS/FAIL/BLOCKED per row with actual logs/screenshots. Fixture regressions and hidden Electron smoke checks do **not** mark these real installer/removal tests as passed. An MSIX guest unable to deploy a disposable test package is BLOCKED, not PASS. Keep the guest snapshot until failures are investigated.

## Türkçe

Durum: **çalıştırılmadı**. Gerçek kullanıcı programı/verisi içermeyen, atılabilir Windows VM/Sandbox gerekir. Yönetici/UAC etkileşimi gereklidir. Ayrı onay olmadan Windows özelliği açmayın, ana bilgisayarı yeniden başlatmayın, sertifikaya güven eklemeyin, paket yüklemeyin veya ana sistemin programını kaldırmayın. Hypervisor'un çalışması tek başına kullanılabilir test VM'si demek değildir.

Hazırlık: Windows sürümünü ve uygulama sürümünü kaydedin; VM anlık görüntüsü alın; yalnızca test programları/verileri kullanın; sürümlü kurulum ve eşleşen özeti misafire kopyalayın. Kişisel klasörleri yazılabilir bağlamayın. Kurulum imzasızdır. Yükseltme temeli yayımlanmış 0.5.1.13'tür; 0.5.1.18 şimdilik yerel adaydır, gerçek kurulumla doğrulanmış yayın değildir.

Yukarıdaki tablo sırasıyla temiz kurulum/UAC, 0.5.1.13'ten yükseltme, test EXE/MSI kaldırma, test Store/MSIX kaldırma, temizlik/geri alma/yeniden kurma, kaldırıcı çalışırken uygulamayı tamamen kapatıp açma ve onaylı yedek silmeyi kapsar. Her satır için gerçek kayıt/ekran görüntüsüyle BAŞARILI/BAŞARISIZ/ENGELLİ sonucu tutun. İptal/hata temizlik izni vermemeli; mevcut/ortak/yeniden kurulmuş veriler korunmalı; yedek silme yalnızca seçilen yedeğe uygulanmalıdır.

Regresyon ve gizli Electron testleri gerçek kurulum/kaldırma testlerini geçmiş saydırmaz. Misafir ortam test MSIX paketini yükleyemiyorsa sonuç ENGELLİ'dir. Hatalar incelenene kadar VM anlık görüntüsünü koruyun.
