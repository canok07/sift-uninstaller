## English

Local candidate 0.5.1.15, not published. Fixes an indefinite wait before uninstalling: System Restore results are awaited for at most 60 seconds, including the permission check. Windows work is not killed. Timeout/failure requires explicit continue/cancel confirmation, and late completion cannot start uninstalling. A still-pending request is not duplicated within the running app. Frequency-limit warnings are treated as failures rather than success. Rows distinguish preparation, restore-point waiting, confirmation and actual uninstall; the log records start, completion, timeout and errors.

The restore-point regression and Electron checks substitute Windows checkpoint work, accelerate the timer and use harmless uninstaller fixtures. They do not establish that a real Windows restore point or uninstall succeeded. Closing the entire app does not guarantee cancellation of Windows work; do not assume a restore point exists after an interrupted/expired request.

## Türkçe

Yerel aday 0.5.1.15, yayımlanmadı. Kaldırma öncesindeki sınırsız bekleme düzeltildi: yetki kontrolü dahil geri yükleme sonucu en fazla 60 saniye beklenir. Windows işlemi zorla kesilmez. Süre aşımı/başarısızlıkta devam/iptal için açık onay gerekir; geç gelen sonuç kaldırmayı başlatmaz. Çalışan uygulama içinde bekleyen istek tekrar başlatılmaz. Sıklık sınırı uyarıları başarı sayılmaz. Satırda hazırlık, geri yükleme bekleme, onay ve gerçek kaldırma aşamaları ayrılır; başlangıç, tamamlanma, süre aşımı ve hatalar günlüğe yazılır.

Geri yükleme regresyonları ve Electron kontrolleri Windows checkpoint işlemini taklit eder, süreyi hızlandırır ve zararsız test kaldırıcıları kullanır. Bunlar gerçek Windows geri yükleme noktasının veya kaldırmanın başarılı olduğunu kanıtlamaz. Uygulamayı tamamen kapatmak Windows işlemini iptal etmiş sayılmaz; kesilen/süresi dolan istekten sonra geri yükleme noktası bulunduğunu varsaymayın.
