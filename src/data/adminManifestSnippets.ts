/**
 * Windows UAC (Yönetici Olarak Çalıştır - Run as Administrator) Yapılandırmaları
 */

export const PYTHON_ADMIN_SNIPPET = `# -*- coding: utf-8 -*-
"""
==============================================================================
 Windows UAC (Run as Administrator) Yapılandırması - Python
==============================================================================
Dosya ve HKEY_LOCAL_MACHINE Registry silme işlemlerinin "Access Denied" (Erişim Engellendi)
hatası vermemesi için uygulama başlatılırken yönetici hakları kontrol edilir.
Eğer yönetici değilse Windows UAC ekranı ile yükseltilerek yeniden başlatılır.
"""

import sys
import ctypes
import os

def is_admin():
    """Uygulamanın yönetici ayrıcalıklarıyla (Administrator) çalışıp çalışmadığını denetler."""
    try:
        return ctypes.windll.shell32.IsUserAnAdmin() != 0
    except:
        return False

def run_as_admin():
    """Yönetici değilse, Windows ShellExecute 'runas' fiili ile UAC onay penceresini açarak uygulamayı yeniden başlatır."""
    if not is_admin():
        script = os.path.abspath(sys.argv[0])
        params = " ".join([f'"{arg}"' for arg in sys.argv[1:]])
        # 'runas' parametresi Windows UAC istemini tetikler
        ret = ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, f'"{script}" {params}', None, 1)
        if int(ret) > 32:
            sys.exit(0) # Eski yetkisiz süreci kapat
        else:
            raise PermissionError("Uygulama yönetici yetkisi verilmediği için başlatılamadı.")

# main bloğu başında çağrılır:
# if __name__ == "__main__":
#     run_as_admin()
#     ...
`;

export const CSHARP_APP_MANIFEST = `<?xml version="1.0" encoding="utf-8"?>
<!--
==============================================================================
 app.manifest - Windows UAC Yönetici Yetkisi Bildirimi
==============================================================================
Projeye 'app.manifest' adıyla eklenir. Proje derlendiğinde veya çalıştırıldığında
Windows işletim sistemi uygulamayı otomatik olarak Yönetici Olarak (Run as Administrator)
başlatır ve UAC kalkan simgesini program ikonuna yerleştirir.
==============================================================================
-->
<assembly manifestVersion="1.0" xmlns="urn:schemas-microsoft-com:asm.v1">
  <assemblyIdentity version="1.0.0.0" name="RegistryAppScanner.app"/>
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v2">
    <security>
      <requestedPrivileges xmlns="urn:schemas-microsoft-com:asm.v3">
        <!-- 
          UAC Yönetici Yetkisi Ayarı:
          level="requireAdministrator" -> Uygulama her zaman Yönetici Olarak çalışmaya zorlanır.
          uiAccess="false" -> Standart masaüstü erişimi
        -->
        <requestedExecutionLevel level="requireAdministrator" uiAccess="false" />
      </requestedPrivileges>
    </security>
  </trustInfo>
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1">
    <application>
      <!-- Windows 10 & Windows 11 Uyumluluğu -->
      <supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}" />
    </application>
  </compatibility>
</assembly>
`;

export const CSHARP_CSPROJ_CONFIG = `<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net8.0-windows</TargetFramework>
    <Nullable>enable</Nullable>
    <UseWPF>true</UseWPF>
    <!-- Yönetici Yetkisi Manifest Dosyasını Projeye Bağlama: -->
    <ApplicationManifest>app.manifest</ApplicationManifest>
  </PropertyGroup>

</Project>
`;
