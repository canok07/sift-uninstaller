export type RegistryHive = 
  | 'HKLM' 
  | 'HKCU' 
  | 'WOW6432Node' 
  | 'APPX'
  | 'HKLM (64-bit)' 
  | 'HKLM (32-bit Wow6432Node)' 
  | 'HKCU (Mevcut Kullanıcı)';

export interface InstalledProgram {
  id: string;
  revision?: string; // Demo entries have no IPC authorization revision.
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
  category?: 'desktop' | 'store' | 'system';
  packageFullName?: string;
  packageName?: string; // Technical AppX name, never replace with a friendly label.
}

export interface SystemInfo {
  isWindows: boolean;
  isElevated: boolean;
  platform: string;
  osVersion?: string;
}

export interface UninstallOptions {
  silent?: boolean;
  expectedRevision?: string;
}

export interface UninstallResult {
  success: boolean;
  verified?: boolean;
  rebootRequired?: boolean;
  exitCode?: number | null;
  error?: string;
  message?: string;
  operationId?: string;
  cancelled?: boolean;
  timedOut?: boolean;
  externalStillRunning?: boolean;
  backgroundPending?: boolean;
}

export type UninstallActivity = { active: false } | {
  active: true;
  operationId: string;
  appId: string;
  appName: string;
  startedAt: number;
  deadlineAt: number;
  phase: 'running' | 'verifying';
  awaitingResult: boolean;
  externalStillRunning: boolean;
  stopReason?: 'cancelled' | 'timedOut';
};

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
  warnings?: string[];
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
  sources?: InventorySource[];
  partial?: boolean;
  warnings?: string[];
}

export interface InventorySource {
  id: 'HKLM' | 'WOW6432Node' | 'HKCU' | 'APPX';
  status: 'ok' | 'missing' | 'error';
  count: number;
  error?: string;
}

export interface RendererErrorReport {
  kind: 'error' | 'unhandledrejection' | 'react';
  message: string;
  stack?: string;
}

export interface BackupEntry {
  id: string;
  type: LeftoverType;
  originalPath: string;
  appName: string;
  createdAt: string;
  state: 'prepared' | 'backed-up' | 'completed' | 'failed' | 'restoring' | 'restored';
  available?: boolean;
  error?: string;
}
export interface BackupListResult { success: boolean; entries: BackupEntry[]; warnings: string[]; error?: string }
export interface BackupRestoreResult { success: boolean; error?: string; message?: string }

// Electron IPC Köprüsü (window.api) Arayüzü
export interface ElectronAPI {
  isElectron: boolean;
  reportRendererError: (report: RendererErrorReport) => Promise<{ success: boolean }>;
  getProgramIcon: (appId: string, revision: string) => Promise<{ dataUrl?: string }>;
  getSystemInfo: () => Promise<SystemInfo>;
  getInstalledPrograms: () => Promise<InstalledProgramsResult>;
  uninstallProgram: (appId: string, options?: UninstallOptions) => Promise<UninstallResult>;
  getUninstallActivity: () => Promise<UninstallActivity>;
  cancelUninstallWait: (operationId: string) => Promise<{ success: boolean; error?: string }>;
  scanLeftovers: (appId: string, options?: LeftoverScanOptions) => Promise<LeftoverScanResult>;
  deleteLeftovers: (items: LeftoverItem[]) => Promise<LeftoverDeleteResult>;
  createRestorePoint: (description?: string) => Promise<RestorePointResult>;
  openLogFolder: () => Promise<{ success: boolean; path?: string; error?: string }>;
  listBackups: () => Promise<BackupListResult>;
  restoreBackup: (id: string) => Promise<BackupRestoreResult>;
}

declare global {
  interface Window {
    api?: ElectronAPI;
  }
}

export type CodeTab = 'fluent-preview' | 'pyqt5' | 'wpf' | 'preview-old' | 'registry-guide';
