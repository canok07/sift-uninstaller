## English

Development version 0.5.1.18 (npm 0.5.1-18). Download availability is listed on the [versioned release page](https://github.com/canok07/sift-uninstaller/releases/tag/v0.5.1.18).

- Move the scan summary into the header and shorten the action toolbar. Wide-window tabs and search remain combined; narrower windows wrap them.
- Open source details above the workspace without pushing the list down. Keep incomplete-scan alerts outside the collapsed details. The header stacking layer prevents the toolbar from obscuring the details panel.
- Windows layout at 1200×820: toolbar 54 → 38 logical pixels; table starts 65 pixels earlier than in 0.5.1.17. Keyboard-accessible disclosure, search, categories and action confirmations remain.
- Regression coverage adds a fixture-only uninstall/cleanup/restore/reinstall lifecycle: unselected data stays, restored bytes match and old cleanup permissions cannot erase reinstalled data.

No new general Temp/AppData cleanup or RAM trimming is implemented. Those were feasibility questions, not implementation approval. AppData must not be indiscriminately cleared.

84 regressions pass; packaged Electron tests use owned fixtures, not installed-program removal. A separately authorized WinDirStat 2.9.2 MSI test installation succeeded, but Sift removal has not been tested. Clean Windows, upgrade and full real reinstall acceptance remain unverified. The installer is unsigned. No forced app termination or personal-data cleanup was performed during verification.

## Türkçe

Geliştirme sürümü 0.5.1.18 (npm 0.5.1-18). İndirilebilir dosyalar [sürüme özel sayfada](https://github.com/canok07/sift-uninstaller/releases/tag/v0.5.1.18) listelenir.

- Tarama özeti başlığa taşındı, işlem araç çubuğu küçültüldü. Geniş pencerede sekmeler ve arama yan yana; dar pencerede alt alta kalır.
- Kaynak ayrıntıları listeyi aşağı itmeden açılır. Eksik tarama uyarısı kapalı ayrıntıların dışında kalır. Başlığın katman sırası, araç çubuğunun ayrıntı panelini örtmesini engeller.
- Windows'ta 1200×820 içerik alanı: araç çubuğu 54 → 38 mantıksal piksel; liste 0.5.1.17'ye göre 65 piksel daha erken başlar. Klavyeyle açılan ayrıntılar, arama, kategoriler ve işlem onayları korunur.
- Regresyonlara yalnızca test dosyalarıyla kaldırma/temizleme/geri alma/yeniden kurma döngüsü eklendi: seçilmeyen veri korunur, geri alınan baytlar eşleşir, eski temizlik izni yeniden kurulmuş veriyi silemez.

Genel Temp/AppData temizliği veya RAM boşaltma eklenmedi; bunlar uygulanma onayı değil, yapılabilirlik sorusuydu. AppData topluca temizlenmemelidir.

84 regresyon geçti; paket Electron kontrolleri kurulu program kaldırmaz, yalnızca test verileri kullanır. Ayrıca açıkça onaylanan WinDirStat 2.9.2 MSI test kurulumu başarılıdır, fakat Sift üzerinden kaldırılması denenmedi. Temiz Windows, yükseltme ve gerçek yeniden kurulum döngüsü doğrulanmadı. Kurulum imzasızdır. Doğrulama sırasında zorla pencere kapatma veya kişisel veri temizliği yapılmadı.
