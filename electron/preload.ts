import { contextBridge, ipcRenderer } from 'electron';
import type { 
  SystemInfo, 
  InstalledProgramsResult, 
  UninstallOptions, 
  UninstallResult, 
  LeftoverScanOptions, 
  LeftoverScanResult, 
  LeftoverItem, 
  LeftoverDeleteResult, 
  RestorePointResult,
  ElectronAPI
} from '../src/types';

const api: ElectronAPI = {
  isElectron: true,
  listBackups: () => ipcRenderer.invoke('backups:list'),
  restoreBackup: id => ipcRenderer.invoke('backups:restore', { id }),
  reportRendererError: report => ipcRenderer.invoke('logs:renderer-error', report),
  getProgramIcon: (appId, revision) => ipcRenderer.invoke('programs:get-icon', { appId, revision }),
  getUninstallActivity: () => ipcRenderer.invoke('programs:get-uninstall-activity'),
  cancelUninstallWait: operationId => ipcRenderer.invoke('programs:cancel-uninstall-wait', { operationId }),

  getSystemInfo: (): Promise<SystemInfo> => {
    return ipcRenderer.invoke('app:get-system-info');
  },

  getInstalledPrograms: (): Promise<InstalledProgramsResult> => {
    return ipcRenderer.invoke('programs:get-installed');
  },

  uninstallProgram: (appId: string, options?: UninstallOptions): Promise<UninstallResult> => {
    return ipcRenderer.invoke('programs:uninstall', { appId, options });
  },

  scanLeftovers: (appId: string, options?: LeftoverScanOptions): Promise<LeftoverScanResult> => {
    return ipcRenderer.invoke('leftovers:scan', { appId, options });
  },

  deleteLeftovers: (items: LeftoverItem[]): Promise<LeftoverDeleteResult> => {
    return ipcRenderer.invoke('leftovers:delete', { items: items.map(({ id }) => ({ id })) });
  },

  createRestorePoint: (description?: string): Promise<RestorePointResult> => {
    return ipcRenderer.invoke('system:create-restore-point', { description });
  },

  openLogFolder: (): Promise<{ success: boolean; path?: string; error?: string }> => {
    return ipcRenderer.invoke('logs:open-folder');
  }
};

contextBridge.exposeInMainWorld('api', api);
