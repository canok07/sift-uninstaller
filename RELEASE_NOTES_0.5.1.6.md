# Sift Uninstaller 0.5.1.6

## Türkçe

Bu sürüm yalnızca öncelikli güvenlik ve doğruluk düzeltmelerini içerir.

- Ortak yayıncı klasörleri temizlik adaylarından çıkarıldı. Dosya hedefleri AppData, LocalAppData ve ProgramData altında doğrulanıyor; kök klasörler ve junction/bağlantı hedefleri korunuyor.
- Kısmi başarısızlıkta temizlik penceresi kapanmıyor. Silinenler listeden çıkarılırken hatalı öğeler ve ayrıntılar görünür kalıyor.
- Başarısız/eksik tarama, boş ve başarılı taramadan ayrıldı. Sorgu hataları kalıcı loga yazılıyor.
- Kaldırıcı kapandıktan sonra Registry veya AppX varlığı doğrulanıyor. Hâlâ kayıtlı programlar listede tutuluyor; iptal edilmiş işlemler başarı sayılmıyor.
- Yeniden başlatma gereken kaldırmalarda kalıntı temizliği erteleniyor.
- Sürüm bilgisi tek kaynaktan üretiliyor: npm için geçerli `0.5.1-6`, Windows ve uygulama ekranı için `0.5.1.6`.

## English

This release contains only the prioritized safety and correctness fixes.

- Shared publisher folders are excluded from cleanup candidates. File targets are validated under AppData, LocalAppData and ProgramData; roots and junction/link targets are protected.
- Cleanup results stay open for inspection. Successful items are removed from the list while failed items and error details remain visible.
- Failed or incomplete scans are distinguished from successful empty scans. Query errors are written to the persistent log.
- Registry or AppX presence is checked after the uninstaller exits. Still-registered programs stay listed; cancelled operations are not reported as successful.
- Leftover cleanup is deferred when a restart is required.
- Version information is derived from one source: valid npm version `0.5.1-6`, Windows/application display version `0.5.1.6`.

## Validation / Kontrol

Run `npm test`, `npm run lint`, and `npm run dist`.
Regression tests use isolated fixture folders and mocked uninstallers. On Windows, inventory and presence checks also run read-only against the current system. No real application is uninstalled during testing.
