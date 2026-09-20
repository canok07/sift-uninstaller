export const PYTHON_PYQT5_CODE = `# -*- coding: utf-8 -*-
"""
==============================================================================
 Windows Kurulu Programlar Listesi & Kalıntı Temizleyici - PyQt5
==============================================================================
Bu uygulama:
 1) Windows Kayıt Defteri (HKLM 64-bit, HKLM 32-bit Wow6432Node, HKCU) üzerindeki
    tüm kurulu programları asenkron QThread ile tarar.
 2) Program kaldırıldığında orijinal kaldırıcı penceresi kapanana kadar
    'process.wait()' ile kod akışını bekletir.
 3) Kaldırma tamamlanınca OTOMATİK OLARAK:
    - %AppData% (Roaming)
    - %LocalAppData% (Local)
    - C:\\ProgramData
    - HKEY_CURRENT_USER\\Software
    - HKEY_LOCAL_MACHINE\\Software
    yollarında program adı/yayıncısı referansıyla kalıntı dosyaları ve registry
    anahtarlarını tarar, yeni bir iletişim penceresinde listeleyip onay alarak siler.
 4) Dosya ve Registry silme işlemlerinin "Erişim Engellendi (Access Denied)"
    hatası vermemesi için uygulama otomatik olarak Yönetici (Run as Administrator)
    ayrıcalıklarıyla başlatılır.

Gereksinimler:
  pip install PyQt5
Çalıştırma:
  python app.py
==============================================================================
"""

import sys
import os
import re
import shutil
import ctypes
import subprocess
import winreg
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLineEdit, QPushButton, QTableWidget, QTableWidgetItem, QHeaderView,
    QLabel, QStatusBar, QMessageBox, QFrame, QAbstractItemView, QStyle,
    QDialog, QListWidget, QListWidgetItem, QCheckBox
)
from PyQt5.QtGui import QIcon, QPixmap, QFont, QColor
from PyQt5.QtCore import Qt, QThread, pyqtSignal


def is_admin():
    """Uygulamanın Windows Administrator yetkileriyle çalışıp çalışmadığını kontrol eder."""
    try:
        return ctypes.windll.shell32.IsUserAnAdmin() != 0
    except:
        return False


def ensure_run_as_admin():
    """
    Uygulama yönetici olarak çalıştırılmadıysa, Windows UAC (Kullanıcı Hesabı Denetimi)
    ekranını açarak kendini 'runas' fiiliyle yönetici olarak yeniden başlatır.
    Böylece HKLM Registry ve C:\\ProgramData silme işlemleri hata vermez.
    """
    if not is_admin():
        script = os.path.abspath(sys.argv[0])
        params = " ".join([f'"{arg}"' for arg in sys.argv[1:]])
        # 'runas' parametresi Windows UAC yönetici yükseltmesini tetikler
        ret = ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, f'"{script}" {params}', None, 1)
        if int(ret) > 32:
            sys.exit(0)  # Eski yetkisiz süreci sonlandır
        else:
            print("Yönetici yetkisi verilmediği için program sonlandırıldı.")
            sys.exit(1)


class UninstallerWorkerThread(QThread):
    """
    Kaldırma komutunu (UninstallString) çalıştırır ve
    orijinal kaldırıcı penceresi kapanana kadar (process.wait()) bekletir.
    """
    finished_uninstall = pyqtSignal(int, str, str)  # exit_code, app_name, publisher
    error_occurred = pyqtSignal(str)

    def __init__(self, uninstall_cmd, app_name, publisher=""):
        super().__init__()
        self.cmd = uninstall_cmd
        self.app_name = app_name
        self.publisher = publisher

    def run(self):
        try:
            # Windows kabuğunda kaldırıcıyı başlat
            process = subprocess.Popen(self.cmd, shell=True)

            # Orijinal kaldırıcı penceresi kapanana kadar kodun akışını BEKLET
            exit_code = process.wait()

            self.finished_uninstall.emit(exit_code, self.app_name, self.publisher)
        except Exception as e:
            self.error_occurred.emit(str(e))


class LeftoverScannerThread(QThread):
    """
    Kaldırılan programın adı ve yayıncısını referans alarak:
    1) %AppData%
    2) %LocalAppData%
    3) C:\\ProgramData
    4) HKCU\\Software
    5) HKLM\\Software
    konumlarında kalıntı dosya/klasör ve registry anahtarlarını arar.
    """
    scan_completed = pyqtSignal(list)

    def __init__(self, app_name, publisher=""):
        super().__init__()
        self.app_name = app_name
        self.publisher = publisher

    def run(self):
        leftovers = []

        # Arama kelimeleri: Parantez ve sürüm numaralarından arındırılmış temiz isim
        clean_name = re.sub(r'\\(.*?\\)|version|v?\\d+(\\.\\d+)*', '', self.app_name, flags=re.IGNORECASE).strip()
        search_terms = [clean_name.lower()]
        first_word = clean_name.split()[0].lower() if clean_name else ""
        if len(first_word) >= 4:
            search_terms.append(first_word)

        pub_term = self.publisher.strip().lower() if self.publisher and len(self.publisher.strip()) >= 4 else None

        # 1. Dosya Sistemi Dizinleri
        folder_targets = [
            ("%AppData%", os.environ.get("APPDATA", "")),
            ("%LocalAppData%", os.environ.get("LOCALAPPDATA", "")),
            ("C:\\\\ProgramData", os.environ.get("ProgramData", "C:\\\\ProgramData"))
        ]

        for scope_name, root_dir in folder_targets:
            if not root_dir or not os.path.exists(root_dir):
                continue

            try:
                for entry in os.listdir(root_dir):
                    entry_lower = entry.lower()
                    matched = any(term in entry_lower for term in search_terms)
                    if not matched and pub_term and pub_term in entry_lower:
                        matched = True

                    if matched:
                        full_path = os.path.join(root_dir, entry)
                        item_type = "folder" if os.path.isdir(full_path) else "file"
                        leftovers.append({
                            "type": item_type,
                            "path": full_path,
                            "scope": scope_name,
                            "details": f"{'Klasör' if item_type == 'folder' else 'Dosya'} ({scope_name})"
                        })
            except Exception:
                pass

        # 2. Registry (Kayıt Defteri) Hedefleri: HKCU\\Software ve HKLM\\Software
        registry_targets = [
            ("HKCU\\\\Software", winreg.HKEY_CURRENT_USER, r"Software"),
            ("HKLM\\\\Software", winreg.HKEY_LOCAL_MACHINE, r"Software")
        ]

        for scope_name, root_hive, subkey_path in registry_targets:
            try:
                with winreg.OpenKey(root_hive, subkey_path, 0, winreg.KEY_READ | winreg.KEY_WOW64_64KEY) as parent_key:
                    num_keys = winreg.QueryInfoKey(parent_key)[0]
                    for i in range(num_keys):
                        try:
                            key_name = winreg.EnumKey(parent_key, i)
                            key_lower = key_name.lower()
                            matched = any(term in key_lower for term in search_terms)
                            if not matched and pub_term and pub_term in key_lower:
                                matched = True

                            if matched:
                                leftovers.append({
                                    "type": "registry_key",
                                    "path": f"{'HKEY_CURRENT_USER' if root_hive == winreg.HKEY_CURRENT_USER else 'HKEY_LOCAL_MACHINE'}\\\\{subkey_path}\\\\{key_name}",
                                    "hive": root_hive,
                                    "subkey": f"{subkey_path}\\\\{key_name}",
                                    "scope": scope_name,
                                    "details": f"Registry Anahtarı ({scope_name})"
                                })
                        except Exception:
                            continue
            except Exception:
                pass

        self.scan_completed.emit(leftovers)


class LeftoverCleanerDialog(QDialog):
    """
    Kaldırma sonrası bulunan kalıntıları listeleyen ve silmek için kullanıcıdan onay isteyen pencere.
    """
    def __init__(self, parent, app_name, leftovers):
        super().__init__(parent)
        self.app_name = app_name
        self.leftovers = leftovers
        self.deleted_count = 0
        self.setWindowTitle(f"Kalıntı Temizliği: {app_name}")
        self.resize(720, 520)
        self.init_ui()

    def init_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(12)

        # Başlık ve Bilgi Kartı
        header_frame = QFrame()
        header_frame.setStyleSheet("background-color: #1e293b; border-radius: 8px; padding: 12px;")
        h_layout = QVBoxLayout(header_frame)

        title = QLabel(f"<b>'{self.app_name}'</b> İçin Tespit Edilen Kalıntılar")
        title.setStyleSheet("font-size: 15px; color: #f8fafc; font-weight: bold;")
        h_layout.addWidget(title)

        desc = QLabel(
            "Aşağıdaki dosya, klasör ve kayıt defteri anahtarları orijinal kaldırıcı tarafından silinmemiştir. "
            "Yönetici yetkileriyle temizlemek istediğiniz öğeleri seçip onaylayın."
        )
        desc.setWordWrap(True)
        desc.setStyleSheet("color: #94a3b8; font-size: 12px;")
        h_layout.addWidget(desc)
        layout.addWidget(header_frame)

        # Kalıntı Listesi
        self.list_widget = QListWidget()
        self.list_widget.setStyleSheet("""
            QListWidget {
                background-color: #0f172a;
                border: 1px solid #334155;
                border-radius: 8px;
                color: #f8fafc;
                font-family: Consolas, monospace;
                font-size: 12px;
                padding: 4px;
            }
            QListWidget::item {
                padding: 8px;
                border-bottom: 1px solid #1e293b;
            }
            QListWidget::item:hover {
                background-color: #1e293b;
            }
        """)

        for item in self.leftovers:
            prefix = "[KLASÖR]" if item["type"] == "folder" else ("[DOSYA]" if item["type"] == "file" else "[REGISTRY]")
            display_text = f"{prefix} ({item['scope']})  {item['path']}"
            list_item = QListWidgetItem(display_text, self.list_widget)
            list_item.setFlags(list_item.flags() | Qt.ItemIsUserCheckable)
            list_item.setCheckState(Qt.Checked)
            list_item.setData(Qt.UserRole, item)

        layout.addWidget(self.list_widget)

        # Seçim Butonları (Tümünü Seç / Kaldır)
        sel_box = QHBoxLayout()
        btn_select_all = QPushButton("Tümünü Seç")
        btn_select_all.setStyleSheet("background-color: #334155; color: white; padding: 6px 12px; border-radius: 6px; font-size: 11px;")
        btn_select_all.clicked.connect(lambda: self.set_all_checks(Qt.Checked))

        btn_deselect_all = QPushButton("Seçimi Temizle")
        btn_deselect_all.setStyleSheet("background-color: #334155; color: white; padding: 6px 12px; border-radius: 6px; font-size: 11px;")
        btn_deselect_all.clicked.connect(lambda: self.set_all_checks(Qt.Unchecked))

        sel_box.addWidget(btn_select_all)
        sel_box.addWidget(btn_deselect_all)
        sel_box.addStretch()
        layout.addLayout(sel_box)

        # Alt Butonlar (Sil & Kapat)
        bottom_box = QHBoxLayout()
        self.btn_delete = QPushButton("🗑️ Seçili Kalıntıları Temizle")
        self.btn_delete.setStyleSheet("background-color: #e11d48; color: white; font-weight: bold; padding: 10px 20px; border-radius: 8px;")
        self.btn_delete.clicked.connect(self.execute_deletion)

        btn_cancel = QPushButton("Atla / Kapat")
        btn_cancel.setStyleSheet("background-color: #475569; color: white; padding: 10px 16px; border-radius: 8px;")
        btn_cancel.clicked.connect(self.reject)

        bottom_box.addStretch()
        bottom_box.addWidget(btn_cancel)
        bottom_box.addWidget(self.btn_delete)
        layout.addLayout(bottom_box)

    def set_all_checks(self, state):
        for i in range(self.list_widget.count()):
            self.list_widget.item(i).setCheckState(state)

    def execute_deletion(self):
        selected_items = []
        for i in range(self.list_widget.count()):
            item = self.list_widget.item(i)
            if item.checkState() == Qt.Checked:
                selected_items.append(item.data(Qt.UserRole))

        if not selected_items:
            QMessageBox.warning(self, "Uyarı", "Lütfen silmek için en az bir öğe seçin.")
            return

        confirm = QMessageBox.question(
            self,
            "Silme Onayı",
            f"Seçilen {len(selected_items)} adet kalıntı kalıcı olarak silinecektir.\n\n"
            "Bu işlemi onaylıyor musunuz?",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No
        )

        if confirm != QMessageBox.Yes:
            return

        deleted_count = 0
        error_logs = []

        # Yönetici Yetkisi ile Silme
        for entry in selected_items:
            try:
                if entry["type"] == "folder":
                    if os.path.exists(entry["path"]):
                        shutil.rmtree(entry["path"], ignore_errors=False)
                        deleted_count += 1
                elif entry["type"] == "file":
                    if os.path.exists(entry["path"]):
                        os.remove(entry["path"])
                        deleted_count += 1
                elif entry["type"] == "registry_key":
                    # Windows Registry anahtarını sil
                    hive = entry["hive"]
                    subkey = entry["subkey"]
                    winreg.DeleteKey(hive, subkey)
                    deleted_count += 1
            except Exception as e:
                error_logs.append(f"{entry['path']} -> {str(e)}")

        self.deleted_count = deleted_count
        msg = f"Temizlik tamamlandı! Toplam {deleted_count} kalıntı başarıyla silindi."
        if error_logs:
            msg += f"\\n\\n({len(error_logs)} öğe silinirken kilitli dosya nedeniyle atlandı.)"

        QMessageBox.information(self, "Temizlik Başarılı", msg)
        self.accept()


class ProgramScannerThread(QThread):
    """
    Registry tarama işlemini arka planda yürüterek arayüzün donmasını engeller.
    """
    program_found = pyqtSignal(dict)
    finished_scan = pyqtSignal(int)

    def run(self):
        targets = [
            (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall", winreg.KEY_WOW64_64KEY, "HKLM (64-bit)"),
            (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall", winreg.KEY_WOW64_32KEY, "HKLM (32-bit)"),
            (winreg.HKEY_CURRENT_USER, r"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall", 0, "HKCU (Kullanıcı)")
        ]

        seen_names = set()
        count = 0

        for hive, subkey_path, flags, hive_label in targets:
            try:
                access = winreg.KEY_READ | flags if flags else winreg.KEY_READ
                with winreg.OpenKey(hive, subkey_path, 0, access) as root_key:
                    num_subkeys = winreg.QueryInfoKey(root_key)[0]
                    for i in range(num_subkeys):
                        try:
                            key_name = winreg.EnumKey(root_key, i)
                            with winreg.OpenKey(root_key, key_name, 0, access) as app_key:
                                try:
                                    system_comp, _ = winreg.QueryValueEx(app_key, "SystemComponent")
                                    if system_comp == 1:
                                        continue
                                except WindowsError:
                                    pass

                                try:
                                    parent_key, _ = winreg.QueryValueEx(app_key, "ParentKeyName")
                                    if parent_key:
                                        continue
                                except WindowsError:
                                    pass

                                try:
                                    display_name, _ = winreg.QueryValueEx(app_key, "DisplayName")
                                    display_name = str(display_name).strip()
                                except WindowsError:
                                    continue

                                if not display_name or display_name in seen_names:
                                    continue

                                seen_names.add(display_name)

                                display_icon = ""
                                try:
                                    val, _ = winreg.QueryValueEx(app_key, "DisplayIcon")
                                    display_icon = str(val).strip()
                                except WindowsError:
                                    pass

                                uninstall_string = ""
                                try:
                                    val, _ = winreg.QueryValueEx(app_key, "UninstallString")
                                    uninstall_string = str(val).strip()
                                except WindowsError:
                                    pass

                                display_version = ""
                                try:
                                    val, _ = winreg.QueryValueEx(app_key, "DisplayVersion")
                                    display_version = str(val).strip()
                                except WindowsError:
                                    pass

                                publisher = ""
                                try:
                                    val, _ = winreg.QueryValueEx(app_key, "Publisher")
                                    publisher = str(val).strip()
                                except WindowsError:
                                    pass

                                prog_info = {
                                    "displayName": display_name,
                                    "displayIcon": display_icon,
                                    "uninstallString": uninstall_string,
                                    "displayVersion": display_version or "-",
                                    "publisher": publisher or "-",
                                    "registryHive": hive_label,
                                    "registryKeyName": key_name
                                }
                                count += 1
                                self.program_found.emit(prog_info)
                        except WindowsError:
                            continue
            except WindowsError:
                continue

        self.finished_scan.emit(count)


class ModernProgramListApp(QMainWindow):
    """
    Ana Pencere
    """
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Windows Registry Program Yöneticisi & Kalıntı Temizleyici [Yönetici Modu]")
        self.resize(1150, 720)
        self.setMinimumSize(850, 500)

        self.all_programs = []
        self.filtered_programs = []
        self.scan_thread = None
        self.uninstall_worker = None
        self.leftover_worker = None

        self.init_ui()
        self.apply_modern_theme()
        self.start_registry_scan()

    def init_ui(self):
        central_widget = QWidget(self)
        self.setCentralWidget(central_widget)
        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(18, 18, 18, 18)
        main_layout.setSpacing(14)

        # Üst Araç Çubuğu
        top_bar = QHBoxLayout()

        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Program adı, yayıncı veya kaldırma komutu ara...")
        self.search_input.textChanged.connect(self.filter_programs)
        top_bar.addWidget(self.search_input)

        self.btn_uninstall = QPushButton("🗑️ Programı Kaldır & Temizle")
        self.btn_uninstall.setObjectName("btnUninstall")
        self.btn_uninstall.clicked.connect(self.uninstall_selected_program)
        top_bar.addWidget(self.btn_uninstall)

        self.btn_refresh = QPushButton("🔄 Yeniden Tara")
        self.btn_refresh.clicked.connect(self.start_registry_scan)
        top_bar.addWidget(self.btn_refresh)

        main_layout.addLayout(top_bar)

        # Tablo
        self.table = QTableWidget()
        self.table.setColumnCount(5)
        self.table.setHorizontalHeaderLabels([
            "Program Adı (DisplayName)",
            "Sürüm",
            "Yayıncı",
            "Kayıt Defteri Yolu (Hive)",
            "Kaldırma Komutu (UninstallString)"
        ])
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.Stretch)
        self.table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(4, QHeaderView.Stretch)
        self.table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.table.setSelectionMode(QAbstractItemView.SingleSelection)
        self.table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        main_layout.addWidget(self.table)

        # Durum Çubuğu
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)

    def start_registry_scan(self):
        self.btn_refresh.setEnabled(False)
        self.btn_uninstall.setEnabled(False)
        self.table.setRowCount(0)
        self.all_programs.clear()
        self.status_bar.showMessage("Windows Kayıt Defteri taranıyor...")

        self.scan_thread = ProgramScannerThread()
        self.scan_thread.program_found.connect(self.add_program_to_table)
        self.scan_thread.finished_scan.connect(self.on_scan_finished)
        self.scan_thread.start()

    def add_program_to_table(self, prog):
        self.all_programs.append(prog)
        self.insert_row(prog)

    def insert_row(self, prog):
        row = self.table.rowCount()
        self.table.insertRow(row)

        item_name = QTableWidgetItem(prog["displayName"])
        self.table.setItem(row, 0, item_name)
        self.table.setItem(row, 1, QTableWidgetItem(prog["displayVersion"]))
        self.table.setItem(row, 2, QTableWidgetItem(prog["publisher"]))
        self.table.setItem(row, 3, QTableWidgetItem(prog["registryHive"]))
        self.table.setItem(row, 4, QTableWidgetItem(prog["uninstallString"]))

    def on_scan_finished(self, total_count):
        self.btn_refresh.setEnabled(True)
        self.btn_uninstall.setEnabled(True)
        self.status_bar.showMessage(f"Tarama tamamlandı: Toplam {total_count} kurulu program bulundu (Yönetici Modu Aktif).")

    def filter_programs(self, text):
        text = text.lower()
        for row in range(self.table.rowCount()):
            name = self.table.item(row, 0).text().lower()
            pub = self.table.item(row, 2).text().lower()
            cmd = self.table.item(row, 4).text().lower()
            match = text in name or text in pub or text in cmd
            self.table.setRowHidden(row, not match)

    def uninstall_selected_program(self):
        selected_rows = self.table.selectionModel().selectedRows()
        if not selected_rows:
            QMessageBox.warning(self, "Uyarı", "Lütfen kaldırmak istediğiniz bir programı seçin.")
            return

        row = selected_rows[0].row()
        app_name = self.table.item(row, 0).text()
        publisher = self.table.item(row, 2).text()
        uninstall_cmd = self.table.item(row, 4).text()

        if not uninstall_cmd:
            QMessageBox.critical(self, "Hata", f"'{app_name}' için geçerli bir UninstallString bulunamadı.")
            return

        reply = QMessageBox.question(
            self,
            "Programı Kaldırma Onayı",
            f"<b>'{app_name}'</b> uygulamasını kaldırmak istediğinizden emin misiniz?\\n\\n"
            f"Çalıştırılacak Komut:\\n{uninstall_cmd}",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No
        )

        if reply != QMessageBox.Yes:
            return

        self.btn_uninstall.setEnabled(False)
        self.btn_refresh.setEnabled(False)
        self.status_bar.showMessage(f"'{app_name}' kaldırıcı penceresi çalışıyor, kapanması bekleniyor...")

        # Orijinal kaldırıcı penceresi kapanana kadar kod akışını bekleten thread
        self.uninstall_worker = UninstallerWorkerThread(uninstall_cmd, app_name, publisher)
        self.uninstall_worker.finished_uninstall.connect(self.on_uninstall_finished)
        self.uninstall_worker.error_occurred.connect(self.on_uninstall_error)
        self.uninstall_worker.start()

    def on_uninstall_finished(self, exit_code, app_name, publisher):
        self.btn_uninstall.setEnabled(True)
        self.btn_refresh.setEnabled(True)
        self.status_bar.showMessage(f"'{app_name}' kaldırıcı kapandı. Kalıntılar taranıyor (%AppData%, %LocalAppData%, C:\\ProgramData, Registry)...")

        # 1. Otomatik Kalıntı Taramasını Başlat
        self.leftover_worker = LeftoverScannerThread(app_name, publisher)
        self.leftover_worker.scan_completed.connect(lambda leftovers: self.on_leftovers_found(app_name, leftovers))
        self.leftover_worker.start()

        # 2. Ana Tabloyu Yenile
        self.start_registry_scan()

    def on_leftovers_found(self, app_name, leftovers):
        if not leftovers:
            QMessageBox.information(
                self,
                "Kalıntı Temizliği",
                f"<b>'{app_name}'</b> kaldırıldı.\\n\\n"
                "%AppData%, %LocalAppData%, C:\\ProgramData ve Registry yollarında herhangi bir artık dosya veya anahtar bulunamadı."
            )
            return

        # Kalıntıları yeni bir pencerede listele ve onay iste
        dialog = LeftoverCleanerDialog(self, app_name, leftovers)
        dialog.exec_()

    def on_uninstall_error(self, error_msg):
        self.btn_uninstall.setEnabled(True)
        self.btn_refresh.setEnabled(True)
        self.status_bar.showMessage("Kaldırma başlatılırken hata oluştu.")
        QMessageBox.critical(self, "Kaldırma Hatası", f"Hata:\\n{error_msg}")

    def apply_modern_theme(self):
        self.setStyleSheet("""
            QMainWindow { background-color: #0f172a; }
            QWidget { color: #f8fafc; font-family: 'Segoe UI', Tahoma, sans-serif; }
            QLineEdit { background-color: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 10px 14px; color: #f8fafc; }
            QPushButton { background-color: #0284c7; color: #ffffff; font-weight: 600; border: none; border-radius: 8px; padding: 10px 18px; }
            QPushButton:hover { background-color: #0369a1; }
            QPushButton#btnUninstall { background-color: #e11d48; }
            QPushButton#btnUninstall:hover { background-color: #be123c; }
            QTableWidget { background-color: #1e293b; border: 1px solid #334155; border-radius: 8px; gridline-color: #334155; selection-background-color: #0369a1; color: #ffffff; }
            QHeaderView::section { background-color: #0f172a; color: #94a3b8; padding: 10px; font-weight: 600; border: none; border-bottom: 2px solid #334155; }
            QStatusBar { background-color: #0f172a; color: #94a3b8; border-top: 1px solid #1e293b; }
        """)


if __name__ == "__main__":
    # 1. Her zaman Yönetici Olarak (Run as Administrator) çalıştır
    ensure_run_as_admin()

    # 2. PyQt5 Arayüzünü Başlat
    app = QApplication(sys.argv)
    window = ModernProgramListApp()
    window.show()
    sys.exit(app.exec_())
`;

export const CSHARP_WPF_XAML = `<Window x:Class="RegistryAppScanner.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Windows Registry Program Yöneticisi &amp; Kalıntı Temizleyici [Yönetici Modu]" Height="720" Width="1180"
        WindowStartupLocation="CenterScreen"
        Background="#0F172A" Foreground="#F8FAFC">

    <Window.Resources>
        <Style TargetType="DataGrid">
            <Setter Property="Background" Value="#1E293B"/>
            <Setter Property="BorderBrush" Value="#334155"/>
            <Setter Property="BorderThickness" Value="1"/>
            <Setter Property="RowBackground" Value="#1E293B"/>
            <Setter Property="AlternatingRowBackground" Value="#182234"/>
            <Setter Property="GridLinesVisibility" Value="Horizontal"/>
            <Setter Property="HorizontalGridLinesBrush" Value="#334155"/>
            <Setter Property="Foreground" Value="#F8FAFC"/>
            <Setter Property="FontSize" Value="13"/>
            <Setter Property="RowHeight" Value="38"/>
            <Setter Property="AutoGenerateColumns" Value="False"/>
            <Setter Property="CanUserAddRows" Value="False"/>
            <Setter Property="SelectionMode" Value="Single"/>
        </Style>

        <Style TargetType="DataGridColumnHeader">
            <Setter Property="Background" Value="#0F172A"/>
            <Setter Property="Foreground" Value="#94A3B8"/>
            <Setter Property="FontWeight" Value="SemiBold"/>
            <Setter Property="Padding" Value="10,8"/>
            <Setter Property="BorderBrush" Value="#334155"/>
            <Setter Property="BorderThickness" Value="0,0,0,2"/>
        </Style>
    </Window.Resources>

    <Grid Margin="20">
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="*"/>
            <RowDefinition Height="Auto"/>
        </Grid.RowDefinitions>

        <!-- 1. Üst Başlık Bölümü -->
        <DockPanel Grid.Row="0" Margin="0,0,0,16">
            <StackPanel DockPanel.Dock="Left">
                <TextBlock Text="Windows Kurulu Programlar &amp; Kalıntı Temizleyici" FontSize="20" FontWeight="Bold" Foreground="#F8FAFC"/>
                <TextBlock Text="HKLM, HKCU Registry taraması, kaldırıcı bekleme ve otomatik kalıntı temizliği [Admin]" FontSize="13" Foreground="#94A3B8" Margin="0,4,0,0"/>
            </StackPanel>

            <StackPanel Orientation="Horizontal" DockPanel.Dock="Right" HorizontalAlignment="Right">
                <!-- Kaldır Butonu -->
                <Button x:Name="BtnUninstall" Content="🗑️ Programı Kaldır &amp; Temizle"
                        Background="#E11D48" Foreground="White" FontWeight="SemiBold"
                        Padding="14,8" BorderThickness="0" Margin="0,0,10,0" Cursor="Hand" Click="BtnUninstall_Click"/>

                <!-- Yeniden Tara Butonu -->
                <Button x:Name="BtnRefresh" Content="🔄 Yeniden Tara"
                        Background="#0284C7" Foreground="White" FontWeight="SemiBold"
                        Padding="14,8" BorderThickness="0" Cursor="Hand" Click="BtnRefresh_Click"/>
            </StackPanel>
        </DockPanel>

        <!-- 2. Arama Çubuğu -->
        <Border Grid.Row="1" Background="#1E293B" BorderBrush="#334155" BorderThickness="1" CornerRadius="8" Margin="0,0,0,14" Padding="10,6">
            <TextBox x:Name="TxtSearch" Background="Transparent" Foreground="#F8FAFC" BorderThickness="0" FontSize="13" TextChanged="TxtSearch_TextChanged"/>
        </Border>

        <!-- 3. Program Listesi DataGrid -->
        <Border Grid.Row="2" CornerRadius="8" BorderBrush="#334155" BorderThickness="1" ClipToBounds="True">
            <DataGrid x:Name="DataGridPrograms">
                <DataGrid.Columns>
                    <DataGridTextColumn Header="Program Adı (DisplayName)" Binding="{Binding DisplayName}" Width="*" FontWeight="SemiBold"/>
                    <DataGridTextColumn Header="Sürüm" Binding="{Binding DisplayVersion}" Width="110"/>
                    <DataGridTextColumn Header="Yayıncı" Binding="{Binding Publisher}" Width="150"/>
                    <DataGridTextColumn Header="Kayıt Yolu (Hive)" Binding="{Binding RegistryHive}" Width="160"/>
                    <DataGridTextColumn Header="Kaldırma Komutu (UninstallString)" Binding="{Binding UninstallString}" Width="*"/>
                </DataGrid.Columns>
            </DataGrid>
        </Border>

        <!-- 4. Alt Durum Çubuğu -->
        <StatusBar Grid.Row="3" Background="#0F172A" BorderBrush="#1E293B" BorderThickness="0,1,0,0" Margin="0,12,0,0">
            <StatusBarItem>
                <TextBlock x:Name="TxtStatus" Text="Hazır (Yönetici Yetkisi Aktif)" Foreground="#94A3B8" FontSize="12"/>
            </StatusBarItem>
        </StatusBar>
    </Grid>
</Window>
`;

export const CSHARP_WPF_CS = `using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using Microsoft.Win32;

namespace RegistryAppScanner
{
    public class InstalledProgramItem
    {
        public string DisplayName { get; set; } = string.Empty;
        public string DisplayIcon { get; set; } = string.Empty;
        public string UninstallString { get; set; } = string.Empty;
        public string DisplayVersion { get; set; } = "-";
        public string Publisher { get; set; } = "-";
        public string RegistryHive { get; set; } = string.Empty;
    }

    public class LeftoverItem
    {
        public string Type { get; set; } = "folder"; // folder, file, registry_key
        public string Path { get; set; } = string.Empty;
        public string TargetScope { get; set; } = string.Empty;
        public bool IsSelected { get; set; } = true;
    }

    public partial class MainWindow : Window
    {
        private ObservableCollection<InstalledProgramItem> _programs = new();
        private ICollectionView _programsView = null!;

        public MainWindow()
        {
            InitializeComponent();
            _programsView = CollectionViewSource.GetDefaultView(_programs);
            DataGridPrograms.ItemsSource = _programsView;
            _ = ScanRegistryAsync();
        }

        private async Task ScanRegistryAsync()
        {
            BtnRefresh.IsEnabled = false;
            BtnUninstall.IsEnabled = false;
            TxtStatus.Text = "Windows Kayıt Defteri (Registry) taranıyor...";
            _programs.Clear();

            var results = await Task.Run(() => FetchProgramsFromRegistry());

            foreach (var prog in results)
            {
                _programs.Add(prog);
            }

            TxtStatus.Text = $"Tarama tamamlandı: Toplam {_programs.Count} program bulundu (Yönetici Yetkisi Aktif).";
            BtnRefresh.IsEnabled = true;
            BtnUninstall.IsEnabled = true;
        }

        private List<InstalledProgramItem> FetchProgramsFromRegistry()
        {
            var list = new List<InstalledProgramItem>();
            var seenNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            var targets = new (RegistryHive Hive, RegistryView View, string SubKey, string Label)[]
            {
                (RegistryHive.LocalMachine, RegistryView.Registry64, @"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall", "HKLM (64-bit)"),
                (RegistryHive.LocalMachine, RegistryView.Registry32, @"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall", "HKLM (32-bit)"),
                (RegistryHive.CurrentUser, RegistryView.Default, @"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall", "HKCU (Kullanıcı)")
            };

            foreach (var target in targets)
            {
                try
                {
                    using var baseKey = RegistryKey.OpenBaseKey(target.Hive, target.View);
                    using var uninstallKey = baseKey.OpenSubKey(target.SubKey);
                    if (uninstallKey == null) continue;

                    foreach (var subKeyName in uninstallKey.GetSubKeyNames())
                    {
                        try
                        {
                            using var appKey = uninstallKey.OpenSubKey(subKeyName);
                            if (appKey == null) continue;

                            if (appKey.GetValue("SystemComponent") is int sys && sys == 1) continue;
                            if (appKey.GetValue("ParentKeyName") != null) continue;

                            string? displayName = appKey.GetValue("DisplayName")?.ToString()?.Trim();
                            if (string.IsNullOrEmpty(displayName) || seenNames.Contains(displayName)) continue;

                            seenNames.Add(displayName);

                            list.Add(new InstalledProgramItem
                            {
                                DisplayName = displayName,
                                DisplayIcon = appKey.GetValue("DisplayIcon")?.ToString()?.Trim() ?? string.Empty,
                                UninstallString = appKey.GetValue("UninstallString")?.ToString()?.Trim() ?? string.Empty,
                                DisplayVersion = appKey.GetValue("DisplayVersion")?.ToString()?.Trim() ?? "-",
                                Publisher = appKey.GetValue("Publisher")?.ToString()?.Trim() ?? "-",
                                RegistryHive = target.Label
                            });
                        }
                        catch { }
                    }
                }
                catch { }
            }

            return list;
        }

        private void TxtSearch_TextChanged(object sender, TextChangedEventArgs e)
        {
            string query = TxtSearch.Text?.Trim() ?? string.Empty;
            if (string.IsNullOrEmpty(query))
            {
                _programsView.Filter = null;
            }
            else
            {
                _programsView.Filter = obj =>
                {
                    if (obj is InstalledProgramItem item)
                    {
                        return item.DisplayName.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                               item.Publisher.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                               item.UninstallString.Contains(query, StringComparison.OrdinalIgnoreCase);
                    }
                    return false;
                };
            }
        }

        private async void BtnRefresh_Click(object sender, RoutedEventArgs e)
        {
            await ScanRegistryAsync();
        }

        private async void BtnUninstall_Click(object sender, RoutedEventArgs e)
        {
            if (DataGridPrograms.SelectedItem is not InstalledProgramItem item)
            {
                MessageBox.Show("Lütfen tablodan kaldırılacak bir program seçin.", "Uyarı", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            if (string.IsNullOrWhiteSpace(item.UninstallString))
            {
                MessageBox.Show("Bu program için geçerli bir UninstallString bulunamadı.", "Hata", MessageBoxButton.OK, MessageBoxImage.Error);
                return;
            }

            var confirm = MessageBox.Show(
                $"'{item.DisplayName}' programını kaldırmak istediğinize emin misiniz?\\n\\nKomut:\\n{item.UninstallString}",
                "Programı Kaldır",
                MessageBoxButton.YesNo,
                MessageBoxImage.Question);

            if (confirm != MessageBoxResult.Yes) return;

            try
            {
                BtnUninstall.IsEnabled = false;
                BtnRefresh.IsEnabled = false;
                TxtStatus.Text = $"'{item.DisplayName}' kaldırıcı penceresi çalışıyor, kapanması bekleniyor...";

                // 1. Orijinal Kaldırıcı Penceresi Kapanana Kadar Kod Akışını BEKLET (WaitForExit)
                int exitCode = await Task.Run(() =>
                {
                    var startInfo = new ProcessStartInfo
                    {
                        FileName = "cmd.exe",
                        Arguments = $"/c \\\"{item.UninstallString}\\\"",
                        UseShellExecute = false,
                        CreateNoWindow = true
                    };

                    using var process = Process.Start(startInfo);
                    if (process == null) return -1;

                    // Orijinal kaldırıcı penceresi kapanana kadar beklet
                    process.WaitForExit();
                    return process.ExitCode;
                });

                TxtStatus.Text = $"'{item.DisplayName}' kaldırıldı (Çıkış Kodu: {exitCode}). Kalıntılar taranıyor...";

                // 2. OTOMATİK KALINTI TEMİZLİĞİ FONKSİYONU (%AppData%, %LocalAppData%, C:\\ProgramData, Registry)
                await ScanAndCleanLeftoversAsync(item.DisplayName, item.Publisher);

                // 3. Tabloyu Güncelle
                await ScanRegistryAsync();
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Hata: {ex.Message}", "Hata", MessageBoxButton.OK, MessageBoxImage.Error);
            }
            finally
            {
                BtnUninstall.IsEnabled = true;
                BtnRefresh.IsEnabled = true;
            }
        }

        /// <summary>
        /// Kaldırılan programın adı ve yayıncısını referans alarak kalıntıları tarar,
        /// yeni pencerede listeler ve onay alarak siler.
        /// </summary>
        private async Task ScanAndCleanLeftoversAsync(string appName, string publisher)
        {
            var leftovers = await Task.Run(() => SearchLeftovers(appName, publisher));

            if (leftovers.Count == 0)
            {
                MessageBox.Show($"'{appName}' kaldırıldı.\\n\\n%AppData%, %LocalAppData%, C:\\\\ProgramData ve Registry üzerinde kalıntı bulunamadı.", "Temizlik Tamamlandı");
                return;
            }

            // Kalıntı Onay Penceresi
            var cleanWindow = new LeftoverCleanWindow(appName, leftovers);
            cleanWindow.Owner = this;
            cleanWindow.ShowDialog();
        }

        private List<LeftoverItem> SearchLeftovers(string appName, string publisher)
        {
            var list = new List<LeftoverItem>();
            string cleanName = Regex.Replace(appName, @"\\(.*?\\)|version|v?\\d+(\\.\\d+)*", "", RegexOptions.IgnoreCase).Trim();
            string[] searchTerms = new[] { cleanName.ToLower() };

            // 1. Dizin Aramaları: %AppData%, %LocalAppData%, C:\\ProgramData
            var folders = new (string Scope, string Path)[]
            {
                ("%AppData%", Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData)),
                ("%LocalAppData%", Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData)),
                (@"C:\\ProgramData", Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData))
            };

            foreach (var folder in folders)
            {
                if (!Directory.Exists(folder.Path)) continue;
                try
                {
                    foreach (var dir in Directory.GetDirectories(folder.Path))
                    {
                        string dirName = System.IO.Path.GetFileName(dir).ToLower();
                        if (searchTerms.Any(t => dirName.Contains(t)))
                        {
                            list.Add(new LeftoverItem { Type = "folder", Path = dir, TargetScope = folder.Scope });
                        }
                    }
                }
                catch { }
            }

            // 2. Registry Aramaları: HKCU\\Software ve HKLM\\Software
            var hives = new (RegistryHive Hive, string Scope)[]
            {
                (RegistryHive.CurrentUser, @"HKCU\\Software"),
                (RegistryHive.LocalMachine, @"HKLM\\Software")
            };

            foreach (var h in hives)
            {
                try
                {
                    using var baseKey = RegistryKey.OpenBaseKey(h.Hive, RegistryView.Registry64);
                    using var softKey = baseKey.OpenSubKey("Software");
                    if (softKey == null) continue;

                    foreach (var keyName in softKey.GetSubKeyNames())
                    {
                        if (searchTerms.Any(t => keyName.Contains(t, StringComparison.OrdinalIgnoreCase)))
                        {
                            list.Add(new LeftoverItem
                            {
                                Type = "registry_key",
                                Path = $"{h.Scope}\\\\{keyName}",
                                TargetScope = h.Scope
                            });
                        }
                    }
                }
                catch { }
            }

            return list;
        }
    }

    /// <summary>
    /// Kalıntıları listeleyen ve silmek için onay isteyen WPF Penceresi
    /// </summary>
    public class LeftoverCleanWindow : Window
    {
        private List<LeftoverItem> _items;
        private ListBox _listBox = new();

        public LeftoverCleanWindow(string appName, List<LeftoverItem> items)
        {
            _items = items;
            Title = $"Kalıntı Temizliği: {appName}";
            Width = 650;
            Height = 450;
            WindowStartupLocation = WindowStartupLocation.CenterOwner;
            Background = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(15, 23, 42));

            var grid = new Grid { Margin = new Thickness(16) };
            grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            grid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
            grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });

            var title = new TextBlock
            {
                Text = $"'{appName}' İçin Tespit Edilen Kalıntılar ({items.Count} Öğe)",
                FontSize = 16,
                FontWeight = FontWeights.Bold,
                Foreground = System.Windows.Media.Brushes.White,
                Margin = new Thickness(0, 0, 0, 10)
            };
            grid.Children.Add(title);

            _listBox.ItemsSource = _items.Select(i => $"[{i.Type.ToUpper()}] ({i.TargetScope})  {i.Path}");
            _listBox.Background = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(30, 41, 59));
            _listBox.Foreground = System.Windows.Media.Brushes.White;
            _listBox.BorderBrush = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(51, 65, 85));
            Grid.SetRow(_listBox, 1);
            grid.Children.Add(_listBox);

            var panel = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right, Margin = new Thickness(0, 12, 0, 0) };
            var btnDelete = new Button
            {
                Content = "🗑️ Seçili Kalıntıları Onayla ve Sil",
                Background = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(225, 29, 72)),
                Foreground = System.Windows.Media.Brushes.White,
                FontWeight = FontWeights.Bold,
                Padding = new Thickness(14, 8)
            };
            btnDelete.Click += (s, e) =>
            {
                if (MessageBox.Show("Seçilen kalıntılar yönetici yetkisiyle kalıcı olarak silinecektir. Onaylıyor musunuz?", "Onay", MessageBoxButton.YesNo) == MessageBoxResult.Yes)
                {
                    int deleted = 0;
                    foreach (var it in _items)
                    {
                        try
                        {
                            if (it.Type == "folder" && Directory.Exists(it.Path)) { Directory.Delete(it.Path, true); deleted++; }
                            else if (it.Type == "file" && File.Exists(it.Path)) { File.Delete(it.Path); deleted++; }
                        }
                        catch { }
                    }
                    MessageBox.Show($"{deleted} kalıntı öğesi temizlendi!", "Başarılı");
                    Close();
                }
            };
            panel.Children.Add(btnDelete);
            Grid.SetRow(panel, 2);
            grid.Children.Add(panel);

            Content = grid;
        }
    }
}
`;
