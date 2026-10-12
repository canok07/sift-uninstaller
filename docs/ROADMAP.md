# Numbered roadmap / Numaralı yol haritası

## English

Tracks the agreed easy-to-hard development order. Steps 1–5 were implemented in 0.5.1.16; step 6 in 0.5.1.17; further upper-workspace refinement in 0.5.1.18. These incremental changes are bundled in the 0.5.1.18 development release, not proof of real-user acceptance testing. Real host installation/removal acceptance requires explicit, scoped approval; no additional tests are scheduled automatically.

1. Cleanup-result messages — implemented.
2. Hide obsolete selection controls after completion — implemented.
3. Consistent current-list counters, separate raw scan snapshot — implemented.
4. Compact upper workspace — implemented.
5. Exact operation-backup shortcuts with separate restore confirmation — implemented.
6. Candidate discovery reason, size, source and ownership estimate — implemented.
7. Verify MSI and Store removals — partial: historical WinSCP EXE / Microsoft To Do results under 0.5.1.15 checked. WinSCP MSI install failed; approved WinDirStat 2.9.2 MSI installation succeeded, but Sift removal has not run. Real testing now left to the user.
8. Full safety chain: uninstall → cleanup → restore → reinstall — fixture lifecycle passes, including unselected data and reinstalled-data protection; real end-to-end acceptance pending user testing.
9. Installer/upgrade acceptance: clean Windows, old-version upgrade, UAC accept/decline — pending user testing in an appropriate isolated Windows environment.
10. Digital signing — excluded from the current work; no certificate purchase or signing setup authorized.

GitHub code/EXE publication is a separate action requiring approval. Keep fixture-based checks distinct from real removal/UAC/installer tests.

Additional local work: read-only Registry review added in 0.5.1.19; storage-denial theme recovery, honest settings-save feedback and visible log-opening failures fixed in 0.5.1.20. These do not replace the remaining real acceptance tests in steps 7–9. Temp/AppData/RAM cleaning remains outside this package.

## Türkçe

Kararlaştırılan kolaydan zora geliştirme sırasını korur. 1–5, 0.5.1.16'da; 6, 0.5.1.17'de; üst alanın ilave küçültülmesi 0.5.1.18'de uygulandı. Bu aşamalar 0.5.1.18 geliştirme sürümünde birlikte yer alır; gerçek kullanıcı kabul testi kanıtı değildir. Gerçek ana sistem kurulumu/kaldırması açık ve sınırlı onay gerektirir; ilave testler otomatik başlatılmaz.

1. Temizlik sonrası mesajları düzeltme — uygulandı.
2. İşlem bitince gereksiz seçim kontrollerini gizleme — uygulandı.
3. Güncel liste sayaçları ile son tarama anlık görüntüsünü ayırma — uygulandı.
4. Üst alanı küçültme — uygulandı.
5. İlgili yedeğe erişim ve ayrıca geri alma onayı — uygulandı.
6. Kalıntının bulunma gerekçesi, boyutu, kaynağı ve sahiplik tahmini — uygulandı.
7. MSI ve Store kaldırmalarını doğrulama — kısmi: 0.5.1.15'teki tarihsel WinSCP EXE / Microsoft To Do sonuçları kontrol edildi. WinSCP MSI kurulamadı; onaylı WinDirStat 2.9.2 MSI kurulumu başarılı, ancak Sift ile kaldırılmadı. Gerçek testler artık kullanıcıya bırakıldı.
8. Tam güvenlik döngüsü: kaldırma → temizleme → geri yükleme → yeniden kurma — seçilmeyen veriyi ve yeniden kurulum verisini koruyan test dosyası döngüsü geçti; gerçek uçtan uca kabul kullanıcı testi bekliyor.
9. Kurulum/yükseltme: temiz Windows, eski sürümden geçiş, UAC kabul/ret — uygun izole Windows ortamında kullanıcı testi bekliyor.
10. Dijital imza — mevcut çalışma kapsamı dışında; sertifika satın alma veya imza yapılandırma yetkisi yok.

GitHub'a kod/EXE yayını ayrı onay ister. Test dosyalarıyla yapılan kontroller, gerçek kaldırma/UAC/kurulum testleri olarak sunulmaz.

İlave yerel çalışma: 0.5.1.19'da salt okunur Registry kontrolü; 0.5.1.20'de kayıt erişimi engelliyken tema kurtarma, doğru ayar kaydetme bildirimi ve görünür log açma hataları. Bunlar 7–9'daki gerçek kabul testlerinin yerine geçmez. Temp/AppData/RAM temizliği bu pakette yoktur.
