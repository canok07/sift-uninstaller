/**
 * Windows 11 Fluent Design (Light Theme) UI & Backend Fonksiyonları Entegre Kodlar
 * PyQt5 ve WPF (XAML + C#)
 * 
 * 1. Listeleme ve Veri Çekme (Load Apps):
 *    - HKLM, HKLM Wow6432Node ve HKCU Uninstall yolları taranır.
 *    - Sadece DisplayName ve UninstallString olanlar filtrelenir.
 *    - EstimatedSize (KB) -> MB/GB formatlanır.
 *    - Eylemler sütununda her satır için çöp kutusu ikonu.
 *    - Alt kısımdaki "Toplam Kurulan" sayacı dinamik güncellenir.
 * 2. Arama ve Filtreleme (Search Bar):
 *    - textChanged ile büyük/küçük harf duyarsız anlık filtreleme.
 * 3. Standart Kaldırma İşlemi (Uninstall):
 *    - Seçili uygulamanın UninstallString komutu alınır.
 *    - msiexec vb. parametreler doğru ayarlanır.
 *    - Orijinal kaldırıcı kapanana kadar asenkron beklenir (QThread / Task.Run).
 * 4. Derin Temizlik ve Progress Bar (Deep Clean):
 *    - Kaldırma bitince veya "Derin Temizlik" butonuna basılınca alt panel görünür olur.
 *    - %AppData%, %LocalAppData%, C:\\ProgramData, HKCU\\Software, HKLM\\Software taranır.
 *    - Progress Bar adım adım çalıştırılır. "X adet dosya, Y adet kayıt defteri girdisi bulundu" gösterilir.
 *    - "Kalıntıyı Temizle" basıldığında try-catch ile güvenli silme yapılır.
 */

export const FLUENT_PYQT5_CODE = `# -*- coding: utf-8 -*-
"""
==============================================================================
 Windows 11 Fluent Design - Modern Uninstaller (PyQt5)
 UI + Tam Backend Fonksiyonları (Threading, Registry, Uninstall, Deep Clean)
==============================================================================
Tasarım Dili: Windows 11 Fluent Light Theme
Font: Segoe UI, sans-serif
Özellikler:
  1. HKLM (64-bit / 32-bit Wow6432Node) ve HKCU Registry asenkron taraması
  2. Gerçek zamanlı (Real-time) büyük/küçük harf duyarsız arama filtresi
  3. UninstallString çalıştırma ve pencere kapanana kadar QThread ile bekleme
  4. %AppData%, %LocalAppData%, C:\\ProgramData ve Registry kalıntı tarama + temizleme
  5. Güvenli silme için try/except blokları ve UI kilitlenmesini önleyen sinyal mimarisi
==============================================================================
"""

import sys
import os
import re
import shutil
import subprocess
import winreg
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLineEdit, QPushButton, QTableWidget, QTableWidgetItem, QHeaderView,
    QLabel, QProgressBar, QFrame, QAbstractItemView, QMessageBox
)
from PyQt5.QtGui import QFont, QColor
from PyQt5.QtCore import Qt, QThread, pyqtSignal


def delete_registry_key_recursive(hkey_root, sub_key):
    """Windows Registry'de alt anahtarları (subkeys) olan anahtarları özyinelemeli olarak güvenle siler"""
    try:
        with winreg.OpenKey(hkey_root, sub_key, 0, winreg.KEY_ALL_ACCESS) as key:
            while True:
                try:
                    child_key_name = winreg.EnumKey(key, 0)
                    delete_registry_key_recursive(hkey_root, f"{sub_key}\\\\{child_key_name}")
                except OSError:
                    break
        winreg.DeleteKey(hkey_root, sub_key)
        return True
    except Exception:
        return False


# -----------------------------------------------------------------------------
# 1. ARKA PLAN THREAD: REGISTRY PROGRAM TARAYICI
# -----------------------------------------------------------------------------
class RegistryScannerThread(QThread):
    apps_loaded = pyqtSignal(list)
    status_updated = pyqtSignal(str)

    def run(self):
        self.status_updated.emit("Kayıt Defteri taranıyor...")
        installed_apps = []
        seen_names = set()

        registry_targets = [
            (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall", winreg.KEY_WOW64_64KEY),
            (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall", winreg.KEY_WOW64_32KEY),
            (winreg.HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall", 0)
        ]

        for hkey_root, sub_key, access_flag in registry_targets:
            try:
                open_access = winreg.KEY_READ | access_flag if access_flag else winreg.KEY_READ
                with winreg.OpenKey(hkey_root, sub_key, 0, open_access) as parent_key:
                    subkeys_count, _, _ = winreg.QueryInfoKey(parent_key)
                    for i in range(subkeys_count):
                        try:
                            key_name = winreg.EnumKey(parent_key, i)
                            with winreg.OpenKey(parent_key, key_name) as app_key:
                                # Sadece DisplayName ve UninstallString olanları filtrele
                                try:
                                    display_name, _ = winreg.QueryValueEx(app_key, "DisplayName")
                                except FileNotFoundError:
                                    continue

                                try:
                                    uninstall_string, _ = winreg.QueryValueEx(app_key, "UninstallString")
                                except FileNotFoundError:
                                    continue

                                if not display_name or not uninstall_string:
                                    continue

                                display_name = str(display_name).strip()
                                if not display_name or display_name in seen_names:
                                    continue

                                # SystemComponent kontrolü (Windows dahili bileşenlerini atla)
                                try:
                                    system_comp, _ = winreg.QueryValueEx(app_key, "SystemComponent")
                                    if system_comp == 1:
                                        continue
                                except FileNotFoundError:
                                    pass

                                # Şirket / Geliştirici bilgisi
                                publisher = "Bilinmeyen Geliştirici"
                                try:
                                    pub, _ = winreg.QueryValueEx(app_key, "Publisher")
                                    if pub and str(pub).strip():
                                        publisher = str(pub).strip()
                                except FileNotFoundError:
                                    pass

                                # Boyut bilgisi (EstimatedSize DWORD değeri KB cinsindendir)
                                size_str = "Bilinmiyor"
                                try:
                                    est_size, _ = winreg.QueryValueEx(app_key, "EstimatedSize")
                                    if est_size and isinstance(est_size, (int, float)) and est_size > 0:
                                        mb_size = est_size / 1024.0
                                        if mb_size >= 1024.0:
                                            size_str = f"{mb_size / 1024.0:.1f} GB"
                                        else:
                                            size_str = f"{mb_size:.1f} MB"
                                except FileNotFoundError:
                                    pass

                                seen_names.add(display_name)
                                installed_apps.append({
                                    "name": display_name,
                                    "publisher": publisher,
                                    "size": size_str,
                                    "uninstall_string": str(uninstall_string).strip(),
                                    "key_name": key_name
                                })
                        except Exception:
                            continue
            except Exception:
                continue

        # Ada göre alfabetik sırala
        installed_apps.sort(key=lambda x: x["name"].lower())
        self.apps_loaded.emit(installed_apps)


# -----------------------------------------------------------------------------
# 2. ARKA PLAN THREAD: KALDIRICI PENCERESİNİ BEKLETME (UNINSTALLER)
# -----------------------------------------------------------------------------
class UninstallerThread(QThread):
    uninstall_started = pyqtSignal(str)
    uninstall_finished = pyqtSignal(bool, str, dict)

    def __init__(self, app_data):
        super().__init__()
        self.app_data = app_data

    def run(self):
        raw_cmd = self.app_data["uninstall_string"]
        app_name = self.app_data["name"]
        self.uninstall_started.emit(f"'{app_name}' için kaldırıcı başlatılıyor...")

        # msiexec kontrolü ve parametre optimizasyonu
        cmd_to_run = raw_cmd
        if "msiexec" in raw_cmd.lower():
            # Eğer /I (Install) varsa /X (Uninstall) ile değiştir
            if "/i" in cmd_to_run.lower():
                cmd_to_run = re.sub(r'(?i)/i\s*', '/x ', cmd_to_run)
            elif "/x" not in cmd_to_run.lower():
                cmd_to_run += " /x"

        try:
            # Süreci başlat ve orijinal pencere kapanana kadar kodun akışını beklet
            process = subprocess.Popen(cmd_to_run, shell=True)
            return_code = process.wait()  # Pencere kapanana kadar bekler!

            is_success = (return_code == 0 or return_code == 3010)  # 3010: Yeniden başlatma gerekiyor
            msg = f"Kaldırma tamamlandı (Çıkış Kodu: {return_code})." if is_success else f"Kaldırıcı {return_code} koduyla sonlandı."
            self.uninstall_finished.emit(is_success, msg, self.app_data)
        except Exception as ex:
            self.uninstall_finished.emit(False, f"Hata oluştu: {str(ex)}", self.app_data)


# -----------------------------------------------------------------------------
# 3. ARKA PLAN THREAD: DERİN TEMİZLİK KALINTI TARAYICI (DEEP CLEAN SCANNER)
# -----------------------------------------------------------------------------
class DeepCleanScannerThread(QThread):
    progress_changed = pyqtSignal(int)
    scan_completed = pyqtSignal(dict)

    def __init__(self, target_name):
        super().__init__()
        self.target_name = target_name

    def run(self):
        # Temizleme kelimeleri (Örn: "Google Chrome 128" -> "Google", "Chrome")
        sanitized = re.sub(r'[\(\)\[\]\{\}\-\_0-9\.]', ' ', self.target_name)
        keywords = [k.strip().lower() for k in sanitized.split() if len(k.strip()) > 2]
        if not keywords:
            keywords = [self.target_name.lower()[:8]]

        found_files = []
        found_reg = []

        # 1. Dosya Konumları (%AppData%, %LocalAppData%, C:\ProgramData)
        search_dirs = [
            os.environ.get("APPDATA"),
            os.environ.get("LOCALAPPDATA"),
            os.environ.get("ProgramData", r"C:\ProgramData")
        ]

        total_steps = len(search_dirs) + 2
        current_step = 0

        for base_dir in search_dirs:
            current_step += 1
            self.progress_changed.emit(int((current_step / total_steps) * 60))
            if not base_dir or not os.path.exists(base_dir):
                continue

            try:
                for entry in os.listdir(base_dir):
                    entry_lower = entry.lower()
                    if any(kw in entry_lower for kw in keywords):
                        full_path = os.path.join(base_dir, entry)
                        found_files.append(full_path)
            except Exception:
                pass

        # 2. Registry Konumları (HKCU\Software ve HKLM\Software)
        reg_locations = [
            (winreg.HKEY_CURRENT_USER, r"Software"),
            (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE")
        ]

        for hkey_root, sub_path in reg_locations:
            current_step += 1
            self.progress_changed.emit(int((current_step / total_steps) * 90))
            try:
                with winreg.OpenKey(hkey_root, sub_path, 0, winreg.KEY_READ) as key:
                    num_subkeys, _, _ = winreg.QueryInfoKey(key)
                    for i in range(num_subkeys):
                        try:
                            s_name = winreg.EnumKey(key, i)
                            if any(kw in s_name.lower() for kw in keywords):
                                root_str = "HKCU" if hkey_root == winreg.HKEY_CURRENT_USER else "HKLM"
                                found_reg.append((hkey_root, f"{sub_path}\\\\{s_name}", f"{root_str}\\\\{sub_path}\\\\{s_name}"))
                        except Exception:
                            continue
            except Exception:
                pass

        self.progress_changed.emit(100)
        self.scan_completed.emit({
            "target_name": self.target_name,
            "files": found_files,
            "registry": found_reg
        })


# -----------------------------------------------------------------------------
# 4. ANA PENCERE (WINDOWS 11 FLUENT LIGHT THEME)
# -----------------------------------------------------------------------------
class FluentUninstallerWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Windows 11 Fluent Uninstaller")
        self.resize(1100, 760)
        self.setMinimumSize(900, 620)

        self.all_apps = []
        self.displayed_apps = []
        self.selected_app = None
        self.last_scan_results = None

        self.init_ui()
        self.apply_fluent_stylesheet()
        self.load_installed_apps()

    def init_ui(self):
        central_widget = QWidget(self)
        self.setCentralWidget(central_widget)
        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(24, 20, 24, 16)
        main_layout.setSpacing(14)

        # ---------------------------------------------------------------------
        # 1. ÜST EYLEM ÇUBUĞU (ACTION BAR)
        # ---------------------------------------------------------------------
        action_bar = QFrame()
        action_bar.setObjectName("actionBar")
        action_layout = QHBoxLayout(action_bar)
        action_layout.setContentsMargins(16, 12, 16, 12)
        action_layout.setSpacing(10)

        # Vurgulu "Programı Kaldır"
        self.btn_uninstall = QPushButton("🗑️  Programı Kaldır")
        self.btn_uninstall.setObjectName("btnPrimaryUninstall")
        self.btn_uninstall.setCursor(Qt.PointingHandCursor)
        self.btn_uninstall.clicked.connect(self.on_primary_uninstall_clicked)
        action_layout.addWidget(self.btn_uninstall)

        # "Uygulamalar" (Listeyi yenile)
        self.btn_apps = QPushButton("📦  Uygulamalar")
        self.btn_apps.setObjectName("btnNav")
        self.btn_apps.setCursor(Qt.PointingHandCursor)
        self.btn_apps.clicked.connect(self.load_installed_apps)
        action_layout.addWidget(self.btn_apps)

        # "Derin Temizlik"
        self.btn_deep_clean = QPushButton("✨  Derin Temizlik")
        self.btn_deep_clean.setObjectName("btnNav")
        self.btn_deep_clean.setCursor(Qt.PointingHandCursor)
        self.btn_deep_clean.clicked.connect(self.on_deep_clean_clicked)
        action_layout.addWidget(self.btn_deep_clean)

        action_layout.addStretch()

        # Sağ: Ayarlar, Yardım, Profil ikon butonları
        self.btn_settings = QPushButton("⚙️")
        self.btn_settings.setObjectName("btnIcon")
        self.btn_settings.setToolTip("Ayarlar")
        self.btn_settings.setCursor(Qt.PointingHandCursor)

        self.btn_help = QPushButton("❓")
        self.btn_help.setObjectName("btnIcon")
        self.btn_help.setToolTip("Yardım & Bilgi")
        self.btn_help.setCursor(Qt.PointingHandCursor)
        self.btn_help.clicked.connect(lambda: QMessageBox.information(
            self, "Hakkında", "Windows 11 Fluent Uninstaller v2.0\\nHKLM & HKCU Registry Destekli Güvenli Kaldırıcı."
        ))

        self.btn_profile = QPushButton("👤")
        self.btn_profile.setObjectName("btnIcon")
        self.btn_profile.setToolTip("Yönetici Profili")
        self.btn_profile.setCursor(Qt.PointingHandCursor)

        action_layout.addWidget(self.btn_settings)
        action_layout.addWidget(self.btn_help)
        action_layout.addWidget(self.btn_profile)

        main_layout.addWidget(action_bar)

        # ---------------------------------------------------------------------
        # 2. ARAMA ÇUBUĞU (SEARCH BAR)
        # ---------------------------------------------------------------------
        search_container = QFrame()
        search_container.setObjectName("searchContainer")
        search_layout = QHBoxLayout(search_container)
        search_layout.setContentsMargins(16, 4, 16, 4)
        search_layout.setSpacing(10)

        lbl_search_icon = QLabel("🔍")
        lbl_search_icon.setStyleSheet("color: #64748b; font-size: 14px; background: transparent;")
        search_layout.addWidget(lbl_search_icon)

        self.txt_search = QLineEdit()
        self.txt_search.setObjectName("txtSearch")
        self.txt_search.setPlaceholderText("Ara (örn: Chrome...)")
        # Anlık arama (real-time filtering) bağlantısı:
        self.txt_search.textChanged.connect(self.on_search_text_changed)
        search_layout.addWidget(self.txt_search, 1)

        self.btn_filter = QPushButton("⚡ Filtrele")
        self.btn_filter.setObjectName("btnFilter")
        self.btn_filter.setCursor(Qt.PointingHandCursor)
        search_layout.addWidget(self.btn_filter)

        main_layout.addWidget(search_container)

        # ---------------------------------------------------------------------
        # 3. ANA LİSTE (DATA GRID / TABLE - 4 SÜTUN)
        # ---------------------------------------------------------------------
        self.table = QTableWidget()
        self.table.setObjectName("fluentTable")
        self.table.setColumnCount(4)
        self.table.setHorizontalHeaderLabels([
            "Uygulama Adı",
            "Boyut",
            "Geliştirici/Şirket",
            "Eylemler"
        ])
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.Stretch)
        self.table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(2, QHeaderView.Stretch)
        self.table.horizontalHeader().setSectionResizeMode(3, QHeaderView.Fixed)
        self.table.setColumnWidth(3, 100)
        self.table.verticalHeader().setVisible(False)
        self.table.setShowGrid(False)  # Karmaşık grid çizgileri yok
        self.table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.table.setSelectionMode(QAbstractItemView.SingleSelection)
        self.table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.table.itemSelectionChanged.connect(self.on_table_row_selected)

        main_layout.addWidget(self.table, 1)

        # ---------------------------------------------------------------------
        # 4. GELİŞMİŞ TEMİZLEME PANELİ (BOTTOM PANEL)
        # ---------------------------------------------------------------------
        self.panel_bottom = QFrame()
        self.panel_bottom.setObjectName("bottomPanel")
        panel_layout = QHBoxLayout(self.panel_bottom)
        panel_layout.setContentsMargins(20, 16, 20, 16)
        panel_layout.setSpacing(20)

        # Sol Kısım: Başlık + Uzun Progress Bar + Durum Açıklaması
        left_box = QVBoxLayout()
        left_box.setSpacing(6)

        header_row = QHBoxLayout()
        self.lbl_panel_title = QLabel("Gelişmiş Temizleme Paneli")
        self.lbl_panel_title.setObjectName("lblPanelTitle")
        header_row.addWidget(self.lbl_panel_title)

        self.lbl_panel_status = QLabel("Hazır")
        self.lbl_panel_status.setObjectName("lblPanelStatus")
        header_row.addWidget(self.lbl_panel_status, 1, Qt.AlignRight)
        left_box.addLayout(header_row)

        self.progress_bar = QProgressBar()
        self.progress_bar.setObjectName("fluentProgress")
        self.progress_bar.setValue(0)
        self.progress_bar.setTextVisible(False)
        self.progress_bar.setFixedHeight(8)
        left_box.addWidget(self.progress_bar)

        panel_layout.addLayout(left_box, 1)

        # Sağ Kısım: "Kalıntıyı Temizle" Butonu
        self.btn_clean_leftovers = QPushButton("🧹  Kalıntıyı Temizle")
        self.btn_clean_leftovers.setObjectName("btnCleanLeftovers")
        self.btn_clean_leftovers.setCursor(Qt.PointingHandCursor)
        self.btn_clean_leftovers.setEnabled(False)
        self.btn_clean_leftovers.clicked.connect(self.execute_clean_leftovers)
        panel_layout.addWidget(self.btn_clean_leftovers)

        main_layout.addWidget(self.panel_bottom)

        # ---------------------------------------------------------------------
        # 5. ALT BİLGİ ÇUBUĞU (STATUS BAR)
        # ---------------------------------------------------------------------
        status_bar = QFrame()
        status_bar.setObjectName("statusBar")
        status_layout = QHBoxLayout(status_bar)
        status_layout.setContentsMargins(8, 6, 8, 6)

        self.lbl_total_count = QLabel("Toplam Kurulan: 0")
        self.lbl_total_count.setObjectName("lblStatusLeft")

        self.lbl_status_msg = QLabel("Sistem hazır")
        self.lbl_status_msg.setStyleSheet("color: #0284c7; font-size: 12px; font-weight: 500;")

        lbl_branding = QLabel("Marka Adı © 2026")
        lbl_branding.setObjectName("lblStatusRight")

        status_layout.addWidget(self.lbl_total_count)
        status_layout.addSpacing(16)
        status_layout.addWidget(self.lbl_status_msg)
        status_layout.addStretch()
        status_layout.addWidget(lbl_branding)

        main_layout.addWidget(status_bar)

    # -------------------------------------------------------------------------
    # BACKEND İŞLEMLERİ & EVENT HANDLERS
    # -------------------------------------------------------------------------
    def load_installed_apps(self):
        """Registry'yi asenkron tarar ve tabloyu doldurur"""
        self.lbl_status_msg.setText("Kayıt defteri taranıyor...")
        self.scanner_thread = RegistryScannerThread()
        self.scanner_thread.apps_loaded.connect(self.on_apps_loaded)
        self.scanner_thread.status_updated.connect(lambda msg: self.lbl_status_msg.setText(msg))
        self.scanner_thread.start()

    def on_apps_loaded(self, apps_list):
        self.all_apps = apps_list
        self.displayed_apps = list(apps_list)
        self.lbl_total_count.setText(f"Toplam Kurulan: {len(self.all_apps)}")
        self.lbl_status_msg.setText(f"{len(self.all_apps)} uygulama başarıyla yüklendi.")
        self.render_table(self.displayed_apps)

    def render_table(self, apps):
        """Tabloyu verilen liste ile doldurur"""
        self.table.setRowCount(len(apps))
        for row, app in enumerate(apps):
            self.table.setRowHeight(row, 56)

            # 1. Sütun: Uygulama Adı (ikonlu)
            name_item = QTableWidgetItem(f"📦  {app['name']}")
            name_item.setFont(QFont("Segoe UI", 10, QFont.Bold))
            self.table.setItem(row, 0, name_item)

            # 2. Sütun: Boyut (sağa hizalı)
            size_item = QTableWidgetItem(app["size"])
            size_item.setTextAlignment(Qt.AlignRight | Qt.AlignVCenter)
            self.table.setItem(row, 1, size_item)

            # 3. Sütun: Geliştirici / Şirket
            vendor_item = QTableWidgetItem(app["publisher"])
            vendor_item.setTextAlignment(Qt.AlignLeft | Qt.AlignVCenter)
            self.table.setItem(row, 2, vendor_item)

            # 4. Sütun: Eylemler (Çöp Kutusu Butonu)
            action_widget = QWidget()
            action_layout = QHBoxLayout(action_widget)
            action_layout.setContentsMargins(0, 0, 8, 0)
            action_layout.setAlignment(Qt.AlignCenter)

            btn_delete = QPushButton("🗑️")
            btn_delete.setObjectName("btnRowDelete")
            btn_delete.setToolTip(f"{app['name']} uygulamasını kaldır")
            btn_delete.setCursor(Qt.PointingHandCursor)
            btn_delete.clicked.connect(lambda checked, a=app: self.start_uninstall(a))
            action_layout.addWidget(btn_delete)

            self.table.setCellWidget(row, 3, action_widget)

    def on_search_text_changed(self, text):
        """Arama kutusuna girilen metne göre anlık büyük/küçük harf duyarsız filtreleme"""
        query = text.strip().lower()
        if not query:
            self.displayed_apps = list(self.all_apps)
        else:
            self.displayed_apps = [
                a for a in self.all_apps
                if query in a["name"].lower() or query in a["publisher"].lower()
            ]
        self.render_table(self.displayed_apps)
        self.lbl_status_msg.setText(f"{len(self.displayed_apps)} sonuç gösteriliyor.")

    def on_table_row_selected(self):
        selected_rows = self.table.selectionModel().selectedRows()
        if selected_rows:
            idx = selected_rows[0].row()
            if idx < len(self.displayed_apps):
                self.selected_app = self.displayed_apps[idx]
                self.btn_uninstall.setText(f"🗑️  Kaldır: {self.selected_app['name'][:18]}...")
        else:
            self.selected_app = None
            self.btn_uninstall.setText("🗑️  Programı Kaldır")

    def on_primary_uninstall_clicked(self):
        if not self.selected_app:
            QMessageBox.warning(self, "Seçim Gerekli", "Lütfen tablodan kaldırmak istediğiniz bir programı seçin.")
            return
        self.start_uninstall(self.selected_app)

    def start_uninstall(self, app_data):
        """Standart Kaldırma Süreci: UninstallString'i çalıştırır ve pencere kapanana kadar bekler"""
        confirm = QMessageBox.question(
            self,
            "Kaldırma Onayı",
            f"'{app_data['name']}' sistemden kaldırılacak.\\n\\nDevam etmek istiyor musunuz?",
            QMessageBox.Yes | QMessageBox.No
        )
        if confirm != QMessageBox.Yes:
            return

        self.btn_uninstall.setEnabled(False)
        self.lbl_status_msg.setText(f"'{app_data['name']}' kaldırıcı penceresi çalışıyor, lütfen bekleyin...")

        # Arayüzün kilitlenmemesi için QThread içinde subprocess.Popen().wait()
        self.uninstaller_thread = UninstallerThread(app_data)
        self.uninstaller_thread.uninstall_started.connect(lambda msg: self.lbl_status_msg.setText(msg))
        self.uninstaller_thread.uninstall_finished.connect(self.on_uninstall_completed)
        self.uninstaller_thread.start()

    def on_uninstall_completed(self, success, message, app_data):
        self.btn_uninstall.setEnabled(True)
        self.lbl_status_msg.setText(message)

        # Listeyi güncelle (kaldırılan programı yerel listeden düşür)
        self.all_apps = [a for a in self.all_apps if a["name"] != app_data["name"]]
        self.on_search_text_changed(self.txt_search.text())
        self.lbl_total_count.setText(f"Toplam Kurulan: {len(self.all_apps)}")

        # Kaldırma sonrası otomatik Derin Temizlik başlat
        self.start_deep_clean(app_data["name"])

    def on_deep_clean_clicked(self):
        target = self.selected_app["name"] if self.selected_app else ""
        if not target and self.all_apps:
            target = self.all_apps[0]["name"]
        if not target:
            QMessageBox.information(self, "Bilgi", "Temizlik yapılacak bir uygulama bulunamadı.")
            return
        self.start_deep_clean(target)

    def start_deep_clean(self, target_name):
        """Gelişmiş Temizleme Paneli ve Progress Bar ile kalıntı araması başlatır"""
        self.panel_bottom.setVisible(True)
        self.lbl_panel_title.setText(f"Gelişmiş Temizlik: '{target_name}'")
        self.lbl_panel_status.setText("Kalıntılar taranıyor (%AppData%, %LocalAppData%, Registry)...")
        self.progress_bar.setValue(0)
        self.btn_clean_leftovers.setEnabled(False)

        self.deep_clean_thread = DeepCleanScannerThread(target_name)
        self.deep_clean_thread.progress_changed.connect(lambda val: self.progress_bar.setValue(val))
        self.deep_clean_thread.scan_completed.connect(self.on_deep_clean_scan_completed)
        self.deep_clean_thread.start()

    def on_deep_clean_scan_completed(self, results):
        self.last_scan_results = results
        file_count = len(results["files"])
        reg_count = len(results["registry"])
        total_count = file_count + reg_count

        self.progress_bar.setValue(100)
        info_text = f"{file_count} adet dosya/klasör, {reg_count} adet kayıt defteri girdisi bulundu."
        self.lbl_panel_status.setText(info_text)

        if total_count > 0:
            self.btn_clean_leftovers.setEnabled(True)
            self.btn_clean_leftovers.setText(f"🧹  Kalıntıyı Temizle ({total_count})")
        else:
            self.btn_clean_leftovers.setEnabled(False)
            self.btn_clean_leftovers.setText("🧹  Kalıntı Bulunamadı")

    def execute_clean_leftovers(self):
        """Kalıntı verileri try/except ile siler (Uygulamanın çökmesi engellenir)"""
        if not self.last_scan_results:
            return

        files = self.last_scan_results.get("files", [])
        reg_keys = self.last_scan_results.get("registry", [])
        deleted_files = 0
        deleted_regs = 0

        # Dosya ve klasörleri sil
        for path in files:
            try:
                if os.path.isdir(path):
                    shutil.rmtree(path, ignore_errors=True)
                elif os.path.isfile(path):
                    os.remove(path)
                deleted_files += 1
            except Exception:
                pass

        # Kayıt defteri anahtarlarını özyinelemeli olarak sil
        for item in reg_keys:
            try:
                hkey_root = item[0]
                sub_key = item[1]
                if delete_registry_key_recursive(hkey_root, sub_key):
                    deleted_regs += 1
            except Exception:
                pass

        self.btn_clean_leftovers.setEnabled(False)
        self.btn_clean_leftovers.setText("✓ Temizlendi")
        self.lbl_panel_status.setText(f"Başarıyla temizlendi: {deleted_files} dosya, {deleted_regs} registry anahtarı silindi.")
        QMessageBox.information(
            self,
            "Temizlik Tamamlandı",
            f"Kalıntı temizleme başarıyla tamamlandı!\\n\\nSilinen Dosyalar: {deleted_files}\\nSilinen Kayıt Defteri Anahtarları: {deleted_regs}"
        )

    def apply_fluent_stylesheet(self):
        """Windows 11 Fluent Design Light Theme CSS"""
        self.setStyleSheet("""
            QMainWindow { background-color: #f8fafc; }
            QWidget { font-family: 'Segoe UI', -apple-system, sans-serif; color: #0f172a; }

            /* 1. Action Bar */
            QFrame#actionBar { background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; }
            QPushButton#btnPrimaryUninstall {
                background-color: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd;
                border-radius: 10px; padding: 10px 20px; font-size: 13px; font-weight: 600;
            }
            QPushButton#btnPrimaryUninstall:hover { background-color: #bae6fd; color: #0284c7; }
            QPushButton#btnNav {
                background-color: transparent; color: #475569; border: none;
                border-radius: 10px; padding: 10px 18px; font-size: 13px; font-weight: 500;
            }
            QPushButton#btnNav:hover { background-color: #f1f5f9; color: #0f172a; }
            QPushButton#btnIcon {
                background-color: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 18px;
                width: 36px; height: 36px; font-size: 15px;
            }
            QPushButton#btnIcon:hover { background-color: #e2e8f0; }

            /* 2. Arama Çubuğu */
            QFrame#searchContainer { background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; }
            QLineEdit#txtSearch { background: transparent; border: none; padding: 10px 8px; font-size: 13px; }
            QPushButton#btnFilter {
                background-color: #f8fafc; color: #475569; border: 1px solid #e2e8f0;
                border-radius: 14px; padding: 6px 14px; font-size: 12px;
            }

            /* 3. Tablo */
            QTableWidget#fluentTable { background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; }
            QTableWidget#fluentTable::item { border-bottom: 1px solid #f1f5f9; padding: 8px 12px; }
            QTableWidget#fluentTable::item:selected { background-color: #f0f9ff; color: #0284c7; }
            QHeaderView::section {
                background-color: #ffffff; color: #64748b; padding: 12px; font-size: 12px;
                font-weight: 600; border: none; border-bottom: 2px solid #e2e8f0;
            }
            QPushButton#btnRowDelete { background: transparent; border: none; border-radius: 6px; width: 30px; height: 30px; }
            QPushButton#btnRowDelete:hover { background-color: #fee2e2; }

            /* 4. Gelişmiş Temizleme Paneli */
            QFrame#bottomPanel { background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; }
            QLabel#lblPanelTitle { font-size: 14px; font-weight: 600; color: #0f172a; }
            QLabel#lblPanelStatus { font-size: 12px; color: #64748b; }
            QProgressBar#fluentProgress { background-color: #e2e8f0; border-radius: 4px; border: none; }
            QProgressBar#fluentProgress::chunk { background-color: #0ea5e9; border-radius: 4px; }
            QPushButton#btnCleanLeftovers {
                background-color: #0ea5e9; color: #ffffff; border: none;
                border-radius: 10px; padding: 10px 22px; font-size: 13px; font-weight: 600;
            }
            QPushButton#btnCleanLeftovers:hover { background-color: #0284c7; }
            QPushButton#btnCleanLeftovers:disabled { background-color: #cbd5e1; color: #94a3b8; }

            /* 5. Status Bar */
            QFrame#statusBar { background-color: transparent; border-top: 1px solid #e2e8f0; }
            QLabel#lblStatusLeft, QLabel#lblStatusRight { color: #64748b; font-size: 12px; }
        """)


if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = FluentUninstallerWindow()
    window.show()
    sys.exit(app.exec_())
`;

export const FLUENT_WPF_XAML = `<Window x:Class="FluentUninstaller.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Windows 11 Fluent Uninstaller" Height="760" Width="1100"
        WindowStartupLocation="CenterScreen"
        FontFamily="Segoe UI"
        Background="#F8FAFC" Foreground="#0F172A"
        Loaded="Window_Loaded">

    <Window.Resources>
        <!-- Modern Grid Çizgisiz DataGrid Stili -->
        <Style TargetType="DataGrid">
            <Setter Property="Background" Value="#FFFFFF"/>
            <Setter Property="BorderBrush" Value="#E2E8F0"/>
            <Setter Property="BorderThickness" Value="1"/>
            <Setter Property="RowHeight" Value="54"/>
            <Setter Property="GridLinesVisibility" Value="None"/>
            <Setter Property="AutoGenerateColumns" Value="False"/>
            <Setter Property="CanUserAddRows" Value="False"/>
            <Setter Property="SelectionMode" Value="Single"/>
            <Setter Property="HeadersVisibility" Value="Column"/>
            <Setter Property="FontSize" Value="13"/>
        </Style>

        <Style TargetType="DataGridRow">
            <Setter Property="Background" Value="#FFFFFF"/>
            <Setter Property="BorderBrush" Value="#F1F5F9"/>
            <Setter Property="BorderThickness" Value="0,0,0,1"/>
            <Style.Triggers>
                <Trigger Property="IsMouseOver" Value="True">
                    <Setter Property="Background" Value="#F8FAFC"/>
                </Trigger>
                <Trigger Property="IsSelected" Value="True">
                    <Setter Property="Background" Value="#F0F9FF"/>
                    <Setter Property="Foreground" Value="#0284C7"/>
                </Trigger>
            </Style.Triggers>
        </Style>

        <Style TargetType="DataGridColumnHeader">
            <Setter Property="Background" Value="#FFFFFF"/>
            <Setter Property="Foreground" Value="#64748B"/>
            <Setter Property="FontWeight" Value="SemiBold"/>
            <Setter Property="FontSize" Value="12"/>
            <Setter Property="Padding" Value="16,12"/>
            <Setter Property="BorderBrush" Value="#E2E8F0"/>
            <Setter Property="BorderThickness" Value="0,0,0,1"/>
        </Style>
    </Window.Resources>

    <Grid Margin="24,20,24,16">
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/> <!-- 1. Üst Eylem Çubuğu -->
            <RowDefinition Height="Auto"/> <!-- 2. Arama Çubuğu -->
            <RowDefinition Height="*"/>    <!-- 3. Ana Liste Tablosu -->
            <RowDefinition Height="Auto"/> <!-- 4. Gelişmiş Temizleme Paneli -->
            <RowDefinition Height="Auto"/> <!-- 5. Alt Bilgi Çubuğu -->
        </Grid.RowDefinitions>

        <!-- ========================================================= -->
        <!-- 1. ÜST EYLEM ÇUBUĞU (ACTION BAR)                          -->
        <!-- ========================================================= -->
        <Border Grid.Row="0" Background="#FFFFFF" BorderBrush="#E2E8F0" BorderThickness="1" CornerRadius="12" Padding="14,10" Margin="0,0,0,14">
            <DockPanel LastChildFill="False">
                <StackPanel Orientation="Horizontal" DockPanel.Dock="Left">
                    <!-- Vurgulu Açık Mavi "Programı Kaldır" -->
                    <Button x:Name="BtnUninstallPrimary" Click="BtnUninstallPrimary_Click"
                            Background="#E0F2FE" Foreground="#0369A1" BorderBrush="#BAE6FD" BorderThickness="1"
                            FontWeight="SemiBold" FontSize="13" Padding="18,10" Cursor="Hand" Margin="0,0,10,0">
                        <Button.Resources>
                            <Style TargetType="Border"><Setter Property="CornerRadius" Value="10"/></Style>
                        </Button.Resources>
                        <StackPanel Orientation="Horizontal">
                            <TextBlock Text="🗑️" Margin="0,0,8,0"/>
                            <TextBlock Text="Programı Kaldır"/>
                        </StackPanel>
                    </Button>

                    <!-- "Uygulamalar" (Yenile) -->
                    <Button Click="BtnRefreshApps_Click" Background="Transparent" Foreground="#475569" BorderThickness="0"
                            FontWeight="Medium" FontSize="13" Padding="16,10" Cursor="Hand" Margin="0,0,8,0">
                        <StackPanel Orientation="Horizontal">
                            <TextBlock Text="📦" Margin="0,0,8,0"/>
                            <TextBlock Text="Uygulamalar"/>
                        </StackPanel>
                    </Button>

                    <!-- "Derin Temizlik" -->
                    <Button Click="BtnDeepClean_Click" Background="Transparent" Foreground="#475569" BorderThickness="0"
                            FontWeight="Medium" FontSize="13" Padding="16,10" Cursor="Hand">
                        <StackPanel Orientation="Horizontal">
                            <TextBlock Text="✨" Margin="0,0,8,0"/>
                            <TextBlock Text="Derin Temizlik"/>
                        </StackPanel>
                    </Button>
                </StackPanel>

                <!-- Sağ: Ayarlar, Yardım, Profil -->
                <StackPanel Orientation="Horizontal" DockPanel.Dock="Right">
                    <Button Content="⚙️" Width="38" Height="38" Background="#F1F5F9" BorderBrush="#E2E8F0" BorderThickness="1"
                            Cursor="Hand" ToolTip="Ayarlar" Margin="0,0,8,0">
                        <Button.Resources><Style TargetType="Border"><Setter Property="CornerRadius" Value="19"/></Style></Button.Resources>
                    </Button>
                    <Button Content="❓" Click="BtnHelp_Click" Width="38" Height="38" Background="#F1F5F9" BorderBrush="#E2E8F0" BorderThickness="1"
                            Cursor="Hand" ToolTip="Yardım" Margin="0,0,8,0">
                        <Button.Resources><Style TargetType="Border"><Setter Property="CornerRadius" Value="19"/></Style></Button.Resources>
                    </Button>
                    <Button Content="👤" Width="38" Height="38" Background="#F1F5F9" BorderBrush="#E2E8F0" BorderThickness="1"
                            Cursor="Hand" ToolTip="Profil">
                        <Button.Resources><Style TargetType="Border"><Setter Property="CornerRadius" Value="19"/></Style></Button.Resources>
                    </Button>
                </StackPanel>
            </DockPanel>
        </Border>

        <!-- ========================================================= -->
        <!-- 2. ARAMA ÇUBUĞU (SEARCH BAR)                              -->
        <!-- ========================================================= -->
        <Border Grid.Row="1" Background="#FFFFFF" BorderBrush="#E2E8F0" BorderThickness="1" CornerRadius="22" Padding="14,6" Margin="0,0,0,14">
            <DockPanel LastChildFill="True">
                <TextBlock Text="🔍" VerticalAlignment="Center" Foreground="#94A3B8" Margin="4,0,10,0"/>

                <Button DockPanel.Dock="Right" Background="#F8FAFC" BorderBrush="#E2E8F0" BorderThickness="1"
                        Foreground="#475569" Padding="12,5" FontSize="12" FontWeight="Medium" Cursor="Hand">
                    <Button.Resources><Style TargetType="Border"><Setter Property="CornerRadius" Value="14"/></Style></Button.Resources>
                    <StackPanel Orientation="Horizontal">
                        <TextBlock Text="⚡" Margin="0,0,6,0"/>
                        <TextBlock Text="Filtrele"/>
                    </StackPanel>
                </Button>

                <!-- TextChanged ile anlık büyük/küçük harf duyarsız arama -->
                <TextBox x:Name="TxtSearch" TextChanged="TxtSearch_TextChanged"
                         Background="Transparent" BorderThickness="0" VerticalAlignment="Center"
                         FontSize="13" Foreground="#0F172A" Padding="4">
                    <TextBox.Style>
                        <Style TargetType="TextBox">
                            <Style.Resources>
                                <VisualBrush x:Key="PlaceholderBrush" AlignmentX="Left" AlignmentY="Center" Stretch="None">
                                    <VisualBrush.Visual>
                                        <TextBlock Text="Ara (örn: Chrome...)" Foreground="#94A3B8" FontSize="13"/>
                                    </VisualBrush.Visual>
                                </VisualBrush>
                            </Style.Resources>
                            <Style.Triggers>
                                <Trigger Property="Text" Value="">
                                    <Setter Property="Background" Value="{StaticResource PlaceholderBrush}"/>
                                </Trigger>
                            </Style.Triggers>
                        </Style>
                    </TextBox.Style>
                </TextBox>
            </DockPanel>
        </Border>

        <!-- ========================================================= -->
        <!-- 3. ANA LİSTE (DATA GRID - 4 SÜTUN)                        -->
        <!-- ========================================================= -->
        <Border Grid.Row="2" Background="#FFFFFF" BorderBrush="#E2E8F0" BorderThickness="1" CornerRadius="12" ClipToBounds="True" Margin="0,0,0,14">
            <DataGrid x:Name="DataGridApps" SelectionChanged="DataGridApps_SelectionChanged">
                <DataGrid.Columns>
                    <!-- 1. Uygulama Adı (ikonlu) -->
                    <DataGridTemplateColumn Header="Uygulama Adı" Width="2*">
                        <DataGridTemplateColumn.CellTemplate>
                            <DataTemplate>
                                <StackPanel Orientation="Horizontal" VerticalAlignment="Center" Margin="16,0,0,0">
                                    <Border Width="34" Height="34" Background="#F1F5F9" CornerRadius="8" Margin="0,0,12,0">
                                        <TextBlock Text="📦" HorizontalAlignment="Center" VerticalAlignment="Center" FontSize="14"/>
                                    </Border>
                                    <TextBlock Text="{Binding DisplayName}" FontWeight="SemiBold" VerticalAlignment="Center" FontSize="13"/>
                                </StackPanel>
                            </DataTemplate>
                        </DataGridTemplateColumn.CellTemplate>
                    </DataGridTemplateColumn>

                    <!-- 2. Boyut (Sağa Hizalı) -->
                    <DataGridTextColumn Header="Boyut" Binding="{Binding FormattedSize}" Width="110">
                        <DataGridTextColumn.ElementStyle>
                            <Style TargetType="TextBlock">
                                <Setter Property="TextAlignment" Value="Right"/>
                                <Setter Property="VerticalAlignment" Value="Center"/>
                                <Setter Property="Margin" Value="0,0,16,0"/>
                                <Setter Property="Foreground" Value="#64748B"/>
                                <Setter Property="FontWeight" Value="Medium"/>
                            </Style>
                        </DataGridTextColumn.ElementStyle>
                    </DataGridTextColumn>

                    <!-- 3. Geliştirici/Şirket -->
                    <DataGridTextColumn Header="Geliştirici/Şirket" Binding="{Binding Publisher}" Width="2*">
                        <DataGridTextColumn.ElementStyle>
                            <Style TargetType="TextBlock">
                                <Setter Property="VerticalAlignment" Value="Center"/>
                                <Setter Property="Foreground" Value="#475569"/>
                            </Style>
                        </DataGridTextColumn.ElementStyle>
                    </DataGridTextColumn>

                    <!-- 4. Eylemler (Çöp Kutusu Butonu) -->
                    <DataGridTemplateColumn Header="Eylemler" Width="90">
                        <DataGridTemplateColumn.CellTemplate>
                            <DataTemplate>
                                <Button Click="BtnRowDelete_Click" Content="🗑️" Width="32" Height="32" Background="Transparent" BorderThickness="0"
                                        Cursor="Hand" ToolTip="Kaldır" HorizontalAlignment="Center" VerticalAlignment="Center">
                                    <Button.Resources><Style TargetType="Border"><Setter Property="CornerRadius" Value="6"/></Style></Button.Resources>
                                </Button>
                            </DataTemplate>
                        </DataGridTemplateColumn.CellTemplate>
                    </DataGridTemplateColumn>
                </DataGrid.Columns>
            </DataGrid>
        </Border>

        <!-- ========================================================= -->
        <!-- 4. GELİŞMİŞ TEMİZLEME PANELİ (BOTTOM PANEL)               -->
        <!-- ========================================================= -->
        <Border Grid.Row="3" Background="#FFFFFF" BorderBrush="#E2E8F0" BorderThickness="1" CornerRadius="12" Padding="20,16" Margin="0,0,0,12">
            <Grid>
                <Grid.ColumnDefinitions>
                    <ColumnDefinition Width="*"/>
                    <ColumnDefinition Width="Auto"/>
                </Grid.ColumnDefinitions>

                <!-- Sol: Başlık, Durum Bilgisi ve Progress Bar -->
                <StackPanel Grid.Column="0" VerticalAlignment="Center" Margin="0,0,24,0">
                    <DockPanel LastChildFill="False" Margin="0,0,0,6">
                        <TextBlock x:Name="TxtPanelTitle" Text="Gelişmiş Temizleme Paneli" FontSize="14" FontWeight="SemiBold" Foreground="#0F172A" DockPanel.Dock="Left"/>
                        <TextBlock x:Name="TxtPanelStatus" Text="Hazır" FontSize="12" Foreground="#64748B" DockPanel.Dock="Right"/>
                    </DockPanel>

                    <ProgressBar x:Name="ProgressBarDeepClean" Height="8" Value="0" Maximum="100" Background="#E2E8F0" Foreground="#0EA5E9" BorderThickness="0">
                        <ProgressBar.Resources><Style TargetType="Border"><Setter Property="CornerRadius" Value="4"/></Style></ProgressBar.Resources>
                    </ProgressBar>
                </StackPanel>

                <!-- Sağ: Kalıntıyı Temizle Butonu -->
                <Button x:Name="BtnCleanLeftovers" Click="BtnCleanLeftovers_Click" IsEnabled="False"
                        Background="#0EA5E9" Foreground="#FFFFFF" BorderThickness="0"
                        FontWeight="SemiBold" FontSize="13" Padding="20,12" Cursor="Hand" VerticalAlignment="Center">
                    <Button.Resources><Style TargetType="Border"><Setter Property="CornerRadius" Value="10"/></Style></Button.Resources>
                    <StackPanel Orientation="Horizontal">
                        <TextBlock Text="🧹" Margin="0,0,8,0"/>
                        <TextBlock Text="Kalıntıyı Temizle"/>
                    </StackPanel>
                </Button>
            </Grid>
        </Border>

        <!-- ========================================================= -->
        <!-- 5. ALT BİLGİ ÇUBUĞU (STATUS BAR)                          -->
        <!-- ========================================================= -->
        <Border Grid.Row="4" BorderBrush="#E2E8F0" BorderThickness="0,1,0,0" Padding="6,8">
            <DockPanel LastChildFill="False">
                <TextBlock x:Name="TxtTotalCount" Text="Toplam Kurulan: 0" Foreground="#64748B" FontSize="12" DockPanel.Dock="Left" VerticalAlignment="Center"/>
                <TextBlock x:Name="TxtStatusMessage" Text="Sistem hazır" Foreground="#0284C7" FontSize="12" FontWeight="Medium" Margin="20,0,0,0" DockPanel.Dock="Left" VerticalAlignment="Center"/>
                <TextBlock Text="Marka Adı © 2026" Foreground="#94A3B8" FontSize="12" DockPanel.Dock="Right" VerticalAlignment="Center"/>
            </DockPanel>
        </Border>
    </Grid>
</Window>
`;

export const FLUENT_WPF_CS = `using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using Microsoft.Win32;

namespace FluentUninstaller
{
    public class InstalledAppModel
    {
        public string DisplayName { get; set; } = string.Empty;
        public string Publisher { get; set; } = "Bilinmeyen Geliştirici";
        public string FormattedSize { get; set; } = "Bilinmiyor";
        public string UninstallString { get; set; } = string.Empty;
        public string RegistryKeyName { get; set; } = string.Empty;
    }

    public partial class MainWindow : Window
    {
        private List<InstalledAppModel> _allApps = new();
        public ObservableCollection<InstalledAppModel> DisplayedApps { get; set; } = new();

        private InstalledAppModel? _selectedApp;
        private List<string> _foundLeftoverFiles = new();
        private List<(RegistryHive Hive, string SubKey)> _foundLeftoverRegKeys = new();

        public MainWindow()
        {
            InitializeComponent();
            DataGridApps.ItemsSource = DisplayedApps;
        }

        private async void Window_Loaded(object sender, RoutedEventArgs e)
        {
            await LoadInstalledAppsAsync();
        }

        // ---------------------------------------------------------------------
        // 1. REGISTRY TARAMA VE LİSTE DOLDURMA (LOAD APPS)
        // ---------------------------------------------------------------------
        private async Task LoadInstalledAppsAsync()
        {
            TxtStatusMessage.Text = "Kayıt defteri taranıyor...";
            BtnRefreshApps_Click(this, new RoutedEventArgs());

            var apps = await Task.Run(() =>
            {
                var list = new List<InstalledAppModel>();
                var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                var targets = new (RegistryHive Hive, RegistryView View, string SubKey)[]
                {
                    (RegistryHive.LocalMachine, RegistryView.Registry64, @"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall"),
                    (RegistryHive.LocalMachine, RegistryView.Registry32, @"SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall"),
                    (RegistryHive.CurrentUser, RegistryView.Default, @"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall")
                };

                foreach (var (hive, view, subKeyPath) in targets)
                {
                    try
                    {
                        using var baseKey = RegistryKey.OpenBaseKey(hive, view);
                        using var parentKey = baseKey.OpenSubKey(subKeyPath);
                        if (parentKey == null) continue;

                        foreach (var subKeyName in parentKey.GetSubKeyNames())
                        {
                            try
                            {
                                using var appKey = parentKey.OpenSubKey(subKeyName);
                                if (appKey == null) continue;

                                var displayName = appKey.GetValue("DisplayName")?.ToString()?.Trim();
                                var uninstallString = appKey.GetValue("UninstallString")?.ToString()?.Trim();

                                // Sadece DisplayName ve UninstallString olanları filtrele
                                if (string.IsNullOrWhiteSpace(displayName) || string.IsNullOrWhiteSpace(uninstallString))
                                    continue;

                                if (seen.Contains(displayName)) continue;

                                // SystemComponent filtresi
                                if (appKey.GetValue("SystemComponent") is int sysComp && sysComp == 1)
                                    continue;

                                var publisher = appKey.GetValue("Publisher")?.ToString()?.Trim();
                                if (string.IsNullOrWhiteSpace(publisher))
                                    publisher = "Bilinmeyen Geliştirici";

                                // EstimatedSize hesaplama (DWORD KB -> MB/GB)
                                string sizeText = "Bilinmiyor";
                                if (appKey.GetValue("EstimatedSize") is int rawSize && rawSize > 0)
                                {
                                    double mb = rawSize / 1024.0;
                                    sizeText = mb >= 1024.0 ? $"{(mb / 1024.0):F1} GB" : $"{mb:F1} MB";
                                }

                                seen.Add(displayName);
                                list.Add(new InstalledAppModel
                                {
                                    DisplayName = displayName,
                                    Publisher = publisher,
                                    FormattedSize = sizeText,
                                    UninstallString = uninstallString,
                                    RegistryKeyName = subKeyName
                                });
                            }
                            catch { }
                        }
                    }
                    catch { }
                }

                list.Sort((a, b) => string.Compare(a.DisplayName, b.DisplayName, StringComparison.OrdinalIgnoreCase));
                return list;
            });

            _allApps = apps;
            ApplySearchFilter();
            TxtTotalCount.Text = $"Toplam Kurulan: {_allApps.Count}";
            TxtStatusMessage.Text = $"{_allApps.Count} uygulama başarıyla yüklendi.";
        }

        private async void BtnRefreshApps_Click(object sender, RoutedEventArgs e)
        {
            await LoadInstalledAppsAsync();
        }

        // ---------------------------------------------------------------------
        // 2. ARAMA VE REAL-TIME FİLTRELEME (SEARCH BAR)
        // ---------------------------------------------------------------------
        private void TxtSearch_TextChanged(object sender, TextChangedEventArgs e)
        {
            ApplySearchFilter();
        }

        private void ApplySearchFilter()
        {
            var query = TxtSearch.Text?.Trim().ToLowerInvariant() ?? string.Empty;
            DisplayedApps.Clear();

            var filtered = string.IsNullOrEmpty(query)
                ? _allApps
                : _allApps.Where(a => a.DisplayName.ToLowerInvariant().Contains(query) ||
                                      a.Publisher.ToLowerInvariant().Contains(query));

            foreach (var app in filtered)
            {
                DisplayedApps.Add(app);
            }

            TxtStatusMessage.Text = $"{DisplayedApps.Count} sonuç listelendi.";
        }

        private void DataGridApps_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            _selectedApp = DataGridApps.SelectedItem as InstalledAppModel;
        }

        // ---------------------------------------------------------------------
        // 3. STANDART KALDIRMA İŞLEMİ (UNINSTALL)
        // ---------------------------------------------------------------------
        private void BtnUninstallPrimary_Click(object sender, RoutedEventArgs e)
        {
            if (_selectedApp == null)
            {
                MessageBox.Show("Lütfen tablodan kaldırmak istediğiniz bir program seçin.", "Seçim Gerekli", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }
            StartUninstallWorkflow(_selectedApp);
        }

        private void BtnRowDelete_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.DataContext is InstalledAppModel app)
            {
                StartUninstallWorkflow(app);
            }
        }

        private async void StartUninstallWorkflow(InstalledAppModel app)
        {
            var result = MessageBox.Show($"'{app.DisplayName}' uygulamasını sistemden kaldırmak istiyor musunuz?",
                                         "Kaldırma Onayı", MessageBoxButton.YesNo, MessageBoxImage.Question);
            if (result != MessageBoxResult.Yes) return;

            BtnUninstallPrimary.IsEnabled = false;
            TxtStatusMessage.Text = $"'{app.DisplayName}' kaldırıcı penceresi açık, kapanana kadar bekleniyor...";

            // Asenkron olarak kaldırıcı penceresi kapanana kadar bekle
            bool success = await Task.Run(() =>
            {
                try
                {
                    string cmd = app.UninstallString;
                    if (cmd.ToLower().Contains("msiexec"))
                    {
                        if (cmd.ToLower().Contains("/i"))
                            cmd = Regex.Replace(cmd, "(?i)/i", "/x");
                        else if (!cmd.ToLower().Contains("/x"))
                            cmd += " /x";
                    }

                    var psi = new ProcessStartInfo
                    {
                        FileName = "cmd.exe",
                        Arguments = $"/c \\"{cmd}\\"",
                        UseShellExecute = false,
                        CreateNoWindow = true
                    };

                    using var proc = Process.Start(psi);
                    if (proc != null)
                    {
                        proc.WaitForExit(); // Pencere kapanana kadar kodun akışını beklet
                        return proc.ExitCode == 0 || proc.ExitCode == 3010;
                    }
                    return false;
                }
                catch
                {
                    return false;
                }
            });

            BtnUninstallPrimary.IsEnabled = true;
            TxtStatusMessage.Text = success ? "Kaldırma işlemi başarıyla tamamlandı." : "Kaldırıcı sonlandı.";

            // Listeden kaldırılan programı çıkar
            _allApps.RemoveAll(a => a.DisplayName == app.DisplayName);
            ApplySearchFilter();
            TxtTotalCount.Text = $"Toplam Kurulan: {_allApps.Count}";

            // Otomatik Derin Temizlik başlat
            await StartDeepCleanWorkflowAsync(app.DisplayName);
        }

        // ---------------------------------------------------------------------
        // 4. DERİN TEMİZLİK VE PROGRESS BAR (DEEP CLEAN)
        // ---------------------------------------------------------------------
        private async void BtnDeepClean_Click(object sender, RoutedEventArgs e)
        {
            string target = _selectedApp?.DisplayName ?? (_allApps.FirstOrDefault()?.DisplayName ?? "");
            if (string.IsNullOrEmpty(target))
            {
                MessageBox.Show("Temizlik yapılacak bir uygulama bulunamadı.", "Bilgi", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }
            await StartDeepCleanWorkflowAsync(target);
        }

        private async Task StartDeepCleanWorkflowAsync(string appName)
        {
            TxtPanelTitle.Text = $"Gelişmiş Temizlik: '{appName}'";
            TxtPanelStatus.Text = "Kalıntılar taranıyor (%AppData%, %LocalAppData%, Registry)...";
            ProgressBarDeepClean.Value = 0;
            BtnCleanLeftovers.IsEnabled = false;

            _foundLeftoverFiles.Clear();
            _foundLeftoverRegKeys.Clear();

            var cleanKeywords = Regex.Replace(appName, @"[\\(\\)\\[\\]\\{\\}\\-_0-9\\.]", " ")
                                     .Split(' ', StringSplitOptions.RemoveEmptyEntries)
                                     .Where(k => k.Length > 2)
                                     .Select(k => k.ToLowerInvariant())
                                     .ToList();

            if (!cleanKeywords.Any()) cleanKeywords.Add(appName.ToLowerInvariant());

            await Task.Run(() =>
            {
                // Dosya dizinleri (%AppData%, %LocalAppData%, C:\ProgramData)
                var dirs = new[]
                {
                    Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData)
                };

                int progress = 10;
                foreach (var dir in dirs)
                {
                    if (string.IsNullOrEmpty(dir) || !Directory.Exists(dir)) continue;

                    try
                    {
                        foreach (var subDir in Directory.GetDirectories(dir))
                        {
                            var name = Path.GetFileName(subDir).ToLowerInvariant();
                            if (cleanKeywords.Any(kw => name.Contains(kw)))
                            {
                                _foundLeftoverFiles.Add(subDir);
                            }
                        }
                    }
                    catch { }

                    progress += 20;
                    Dispatcher.Invoke(() => ProgressBarDeepClean.Value = progress);
                }

                // Registry dizinleri (HKCU\Software ve HKLM\Software)
                var hives = new[] { RegistryHive.CurrentUser, RegistryHive.LocalMachine };
                foreach (var hive in hives)
                {
                    try
                    {
                        using var baseKey = RegistryKey.OpenBaseKey(hive, RegistryView.Default);
                        using var softKey = baseKey.OpenSubKey("Software");
                        if (softKey != null)
                        {
                            foreach (var keyName in softKey.GetSubKeyNames())
                            {
                                if (cleanKeywords.Any(kw => keyName.ToLowerInvariant().Contains(kw)))
                                {
                                    _foundLeftoverRegKeys.Add((hive, $"Software\\\\{keyName}"));
                                }
                            }
                        }
                    }
                    catch { }

                    progress += 15;
                    Dispatcher.Invoke(() => ProgressBarDeepClean.Value = progress);
                }

                Dispatcher.Invoke(() => ProgressBarDeepClean.Value = 100);
            });

            int total = _foundLeftoverFiles.Count + _foundLeftoverRegKeys.Count;
            TxtPanelStatus.Text = $"{_foundLeftoverFiles.Count} adet dosya, {_foundLeftoverRegKeys.Count} adet kayıt defteri girdisi bulundu.";

            if (total > 0)
            {
                BtnCleanLeftovers.IsEnabled = true;
                BtnCleanLeftovers.Content = $"🧹 Kalıntıyı Temizle ({total})";
            }
            else
            {
                BtnCleanLeftovers.IsEnabled = false;
                BtnCleanLeftovers.Content = "🧹 Kalıntı Bulunamadı";
            }
        }

        private async void BtnCleanLeftovers_Click(object sender, RoutedEventArgs e)
        {
            BtnCleanLeftovers.IsEnabled = false;
            TxtPanelStatus.Text = "Kalıntılar güvenli şekilde temizleniyor...";

            int deletedFiles = 0;
            int deletedRegs = 0;

            await Task.Run(() =>
            {
                // Dosyaları ve klasörleri güvenli sil (try-catch ile kilitli dosyalarda çökme önlenir)
                foreach (var path in _foundLeftoverFiles)
                {
                    try
                    {
                        if (Directory.Exists(path)) Directory.Delete(path, true);
                        else if (File.Exists(path)) File.Delete(path);
                        deletedFiles++;
                    }
                    catch { }
                }

                // Kayıt defteri anahtarlarını güvenli sil
                foreach (var (hive, subKey) in _foundLeftoverRegKeys)
                {
                    try
                    {
                        using var baseKey = RegistryKey.OpenBaseKey(hive, RegistryView.Default);
                        baseKey.DeleteSubKeyTree(subKey, false);
                        deletedRegs++;
                    }
                    catch { }
                }
            });

            TxtPanelStatus.Text = $"Temizlik tamamlandı! {deletedFiles} dosya, {deletedRegs} kayıt defteri anahtarı silindi.";
            BtnCleanLeftovers.Content = "✓ Temizlendi";

            MessageBox.Show($"Kalıntı temizleme başarıyla tamamlandı!\\n\\nSilinen Dosyalar: {deletedFiles}\\nSilinen Kayıt Defteri Anahtarları: {deletedRegs}",
                            "Temizlik Başarılı", MessageBoxButton.OK, MessageBoxImage.Information);
        }

        private void BtnHelp_Click(object sender, RoutedEventArgs e)
        {
            MessageBox.Show("Windows 11 Fluent Uninstaller\\nHKLM & HKCU Registry Destekli Güvenli Kaldırıcı ve Kalıntı Temizleyici.",
                            "Hakkında", MessageBoxButton.OK, MessageBoxImage.Information);
        }
    }
}
`;
