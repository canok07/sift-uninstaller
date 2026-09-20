export type RegistryHive = 
  | 'HKLM' 
  | 'HKCU' 
  | 'WOW6432Node' 
  | 'HKLM (64-bit)' 
  | 'HKLM (32-bit Wow6432Node)' 
  | 'HKCU (Mevcut Kullanıcı)';

export interface InstalledProgram {
  id: string;
  displayName: string;
  displayVersion?: string;
  publisher?: string;
  estimatedSize?: number; // Boyut (KB veya Byte)
  sizeFormatted?: string;
  uninstallString?: string;
  quietUninstallString?: string;
  registryKey?: string;
  registryKeyName?: string;
  registryHive: RegistryHive;
  displayIcon?: string;
  installDate?: string;
  installLocation?: string;
  isSystemComponent?: boolean;
}

export interface SystemInfo {
  isWindows: boolean;
  isElevated: boolean;
  platform: string;
  osVersion?: string;
}

export interface UninstallOptions {
  silent?: boolean;
}

export interface UninstallResult {
  success: boolean;
  exitCode?: number | null;
  error?: string;
  message?: string;
}

export type LeftoverType = 'folder' | 'file' | 'registry_key';

export type LeftoverScope = 
  | '%AppData%' 
  | '%LocalAppData%' 
  | 'C:\\ProgramData' 
  | 'HKCU\\Software' 
  | 'HKLM\\Software' 
  | 'HKLM\\Software\\WOW6432Node';

export interface LeftoverItem {
  id: string;
  type: LeftoverType;
  path: string;
  targetScope: LeftoverScope;
  sizeOrDetails?: string;
  selected: boolean;
}

export interface LeftoverScanOptions {
  scanAppData?: boolean;
  scanRegistry?: boolean;
}

export interface LeftoverScanResult {
  success: boolean;
  items: LeftoverItem[];
  error?: string;
  message?: string;
}

export interface LeftoverDeleteResult {
  success: boolean;
  deletedCount: number;
  failedCount: number;
  results: Array<{
    id: string;
    path: string;
    success: boolean;
    error?: string;
  }>;
  error?: string;
}

export interface RestorePointResult {
  success: boolean;
  supported: boolean;
  error?: string;
  description?: string;
}

export interface InstalledProgramsResult {
  success: boolean;
  programs: InstalledProgram[];
  error?: string;
  isDemo?: boolean;
}

// Electron IPC Köprüsü (window.api) Arayüzü
export interface ElectronAPI {
  isElectron: boolean;
  getSystemInfo: () => Promise<SystemInfo>;
  getInstalledPrograms: () => Promise<InstalledProgramsResult>;
  uninstallProgram: (appId: string, options?: UninstallOptions) => Promise<UninstallResult>;
  scanLeftovers: (appId: string, options?: LeftoverScanOptions) => Promise<LeftoverScanResult>;
  deleteLeftovers: (items: LeftoverItem[]) => Promise<LeftoverDeleteResult>;
  createRestorePoint: (description?: string) => Promise<RestorePointResult>;
}

declare global {
  interface Window {
    api?: ElectronAPI;
  }
}

export type CodeTab = 'fluent-preview' | 'pyqt5' | 'wpf' | 'preview-old' | 'registry-guide';
