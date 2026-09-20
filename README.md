# Sift Uninstaller (Windows Masaüstü Uygulaması)

Modern, hafif ve güvenli bir Windows program kaldırıcı ve artık temizleme masaüstü uygulamasıdır. Electron, React, TypeScript ve Tailwind CSS ile geliştirilmiştir.

## 🇹🇷 0.5.1.5 Toplu Güncelleme

- Kurulu yazılımlar **Masaüstü Programları**, **Store Uygulamaları** ve **Windows Bileşenleri** sekmelerinde ayrıldı.
- Microsoft Store/MSIX uygulamalarını Windows'un kendi `Remove-AppxPackage` yöntemiyle kaldırma desteği eklendi.
- Bir program satırına çift tıklayınca güvenli kaldırma onayı açılıyor; işlem onaysız başlamıyor.
- Windows sistem bileşenleri belirgin şekilde işaretleniyor ve kaldırma öncesinde ek risk uyarısı gösteriliyor.
- Kurulum tarihine göre sıralama eklendi; hatalı ve gelecekteki Registry tarihleri güvenilmez kabul ediliyor.
- Tarama, kaldırma ve kalıntı temizleme işlemleri kalıcı hata günlüğüne yazılıyor. Log dosyasına **Ayarlar → Logları Aç** yoluyla ulaşılabilir.

## 🇬🇧 0.5.1.5 Batch Update

- Installed software is separated into **Desktop Programs**, **Store Apps**, and **Windows Components** tabs.
- Microsoft Store/MSIX apps can be removed through Windows' native `Remove-AppxPackage` mechanism.
- Double-clicking an app row opens a safe uninstall confirmation; removal never starts without approval.
- Windows system components are clearly marked and display an additional risk warning before removal.
- Install-date sorting was added; malformed and future Registry dates are treated as unreliable.
- Scan, uninstall, and leftover-cleanup operations are written to a persistent diagnostic log. Open it through **Settings → Open Logs**.

---

## 🌟 Temel Özellikler

- **Gerçek Windows Kayıt Defteri (Registry) Entegrasyonu**:
  - `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall` (64-bit Sistem Programları)
  - `HKLM\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall` (32-bit Sistem Programları)
  - `HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall` (Kullanıcı Düzeyi Programlar)
  - Mevcut kullanıcı için kaldırılabilir Microsoft Store/MSIX paketleri
- **Güvenli Çift Süreç (Main & Renderer) Mimarisi**:
  - `contextIsolation: true` ve `nodeIntegration: false` ile tam yalıtım.
  - Renderer sürecinin sisteme doğrudan erişmesi engellenmiştir; tüm işlemler güvenli `preload.cjs` ve doğrulanmış `window.api` IPC kanalları üzerinden yürütülür.
- **Kesin Kullanıcı Onayı İlkesi**:
  - Kullanıcı açıkça onay vermeden hiçbir kaldırma işlemi başlatılmaz.
  - Artık temizleme aşamasında hiçbir dosya veya kayıt defteri girdisi varsayılan olarak seçilmez; kullanıcı tek tek inceleyip onaylamalıdır.
- **Sistem Kök Dizin Koruması (Blacklist & Whitelist)**:
  - `Windows`, `System32`, `SysWOW64`, `Program Files`, `Users` kök dizinleri veya ana kovanlar (`HKLM`, `HKCU\Software`) asla silinemez; minimum 3 kademe derinlik şartı aranır.
- **Windows Sistem Geri Yükleme Noktası**:
  - Kaldırma öncesinde Windows System Restore API ile otomatik geri yükleme noktası oluşturma desteği.
- **Çift Mod Desteği (Masaüstü & Demo)**:
  - Electron içinde gerçek Windows verileri okunur ve çalıştırılır.
  - Tarayıcı önizlemesinde kullanıcıya açıkça **"Demo Modu"** uyarısı verilir.

---

## 🚀 Kurulum ve Başlangıç

### Gereksinimler
- **Node.js**: v18.0.0 veya üzeri (LTS önerilir)
- **İşletim Sistemi**: Windows 10 / Windows 11 (Masaüstü Registry işlevleri için)

### Bağımlılıkları Yükleme
```bash
npm install
```

---

## 💻 Geliştirme (Development)

### 1. Masaüstü Electron Modunda Çalıştırma (Gerçek Windows Registry)
Masaüstü uygulamasını geliştirme modunda başlatır:
```bash
npm run electron:dev
```
*Bu komut Electron ana/preload dosyalarını hazırlar, yerel Vite sunucusunu başlatır ve uygulama penceresini açar. Geliştirici araçları varsayılan olarak kapalıdır.*

Geliştirici araçlarıyla çalıştırmak gerekirse:
```bash
npm run electron:devtools
```

### 2. Tarayıcıda Önizleme Modunda Çalıştırma (Demo Modu)
Arayüzü hızlıca test etmek için Vite geliştirme sunucusunu başlatır:
```bash
npm run dev
```
*Tarayıcıda açıldığında (`http://127.0.0.1:3000`) açıkça "Demo Modu" etiketiyle çalışır.*

---

## 📦 Paketleme ve Kurulum Dosyası Üretimi (Packaging)

`electron-builder` kullanılarak Windows için kurulabilir Setup.exe veya taşınabilir klasör üretilir:

### 1. Windows Kurulabilir Setup.exe Üretme (`npm run dist`)
Windows için optimize edilmiş, imzalanabilir NSIS kurulum sihirbazı (`Setup.exe`) üretmek için:
```bash
npm run dist
```
Üretilen kurulum dosyası:
```
release/Sift Uninstaller-Setup-0.5.1.5.exe
```

### 2. Paketlenmiş Taşınabilir Klasör (Unpacked Dir) Üretme
Kurulum sihirbazı olmadan doğrudan çalıştırılabilir klasör çıktısı almak için:
```bash
npm run dist:dir
```
Üretilen klasör:
```
release/win-unpacked/Sift Uninstaller.exe
```

---

## 📁 Proje Dizin Yapısı

```
.
├── electron/
│   ├── main.ts         # Ana süreç (Registry okuma, güvenli process çalıştırma, IPC)
│   └── preload.ts      # Güvenli contextBridge API köprüsü (window.api)
├── src/
│   ├── components/     # React arayüz bileşenleri (Fluent tasarım, modal dialoglar)
│   ├── types.ts        # TypeScript tip tanımları (IPC ve veri modelleri)
│   ├── App.tsx         # Ana React uygulama sarmalayıcısı
│   └── main.tsx        # React DOM giriş noktası
├── dist/               # Vite derleme çıktısı (HTML/JS/CSS)
├── dist-electron/      # esbuild ile derlenmiş Electron CJS dosyaları
├── release/            # electron-builder tarafından üretilen Setup.exe çıktısı
├── package.json        # Bağımlılıklar, scriptler ve build konfigürasyonu
└── README.md           # Proje belgelendirmesi
```

---

## 🛡️ Güvenlik ve Uyumluluk Notları

1. **Rastgele Komut Çalıştırma Engeli**: Renderer sürecinden gelen rastgele shell komutları kabul edilmez. Yalnızca Registry taramasında önbelleğe alınmış ve doğrulanmış `appId` değerlerinin `UninstallString` komutları çalıştırılır.
2. **Yönetici Yetkisi (Run as Administrator)**: Sistem düzeyindeki uygulamaları kaldırmak ve korumalı kalıntıları temizlemek için uygulama yönetici yetkisiyle açılır. Uygulama manifestinde `requestedExecutionLevel: requireAdministrator` kullanılır.
