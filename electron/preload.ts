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
    return ipcRenderer.invoke('leftovers:delete', { items });
  },

  createRestorePoint: (description?: string): Promise<RestorePointResult> => {
    return ipcRenderer.invoke('system:create-restore-point', { description });
  }
};

contextBridge.exposeInMainWorld('api', api);
