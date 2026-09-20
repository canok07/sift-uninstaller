import { InstalledProgram } from '../types';

export const SAMPLE_INSTALLED_PROGRAMS: InstalledProgram[] = [
  {
    id: 'vscode',
    displayName: 'Microsoft Visual Studio Code (User)',
    displayIcon: 'C:\\Users\\Kullanici\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe,0',
    uninstallString: '"C:\\Users\\Kullanici\\AppData\\Local\\Programs\\Microsoft VS Code\\unins000.exe"',
    displayVersion: '1.92.2',
    publisher: 'Microsoft Corporation',
    installDate: '20240815',
    installLocation: 'C:\\Users\\Kullanici\\AppData\\Local\\Programs\\Microsoft VS Code',
    registryHive: 'HKCU (Mevcut Kullanıcı)',
    registryKeyName: '{F8A2A208-72B3-4D61-95FC-8A65D340C912}_is1'
  },
  {
    id: 'chrome',
    displayName: 'Google Chrome',
    displayIcon: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe,0',
    uninstallString: '"C:\\Program Files\\Google\\Chrome\\Application\\128.0.6613.120\\Installer\\setup.exe" --uninstall --system-level --verbose-logging',
    displayVersion: '128.0.6613.120',
    publisher: 'Google LLC',
    installDate: '20240710',
    installLocation: 'C:\\Program Files\\Google\\Chrome\\Application',
    registryHive: 'HKLM (64-bit)',
    registryKeyName: 'Google Chrome'
  },
  {
    id: 'git',
    displayName: 'Git version 2.46.0',
    displayIcon: 'C:\\Program Files\\Git\\cmd\\git-gui.exe',
    uninstallString: '"C:\\Program Files\\Git\\unins000.exe"',
    displayVersion: '2.46.0',
    publisher: 'The Git Development Community',
    installDate: '20240801',
    installLocation: 'C:\\Program Files\\Git',
    registryHive: 'HKLM (64-bit)',
    registryKeyName: 'Git_is1'
  },
  {
    id: 'spotify',
    displayName: 'Spotify',
    displayIcon: 'C:\\Users\\Kullanici\\AppData\\Roaming\\Spotify\\Spotify.exe,0',
    uninstallString: '"C:\\Users\\Kullanici\\AppData\\Roaming\\Spotify\\Spotify.exe" /uninstall',
    displayVersion: '1.2.45.454',
    publisher: 'Spotify AB',
    installDate: '20240620',
    installLocation: 'C:\\Users\\Kullanici\\AppData\\Roaming\\Spotify',
    registryHive: 'HKCU (Mevcut Kullanıcı)',
    registryKeyName: 'Spotify'
  },
  {
    id: '7zip',
    displayName: '7-Zip 24.08 (x64)',
    displayIcon: 'C:\\Program Files\\7-Zip\\7zFM.exe',
    uninstallString: '"C:\\Program Files\\7-Zip\\Uninstall.exe"',
    displayVersion: '24.08',
    publisher: 'Igor Pavlov',
    installDate: '20240812',
    installLocation: 'C:\\Program Files\\7-Zip',
    registryHive: 'HKLM (64-bit)',
    registryKeyName: '7-Zip'
  },
  {
    id: 'notepadplusplus',
    displayName: 'Notepad++ (32-bit x86)',
    displayIcon: 'C:\\Program Files (x86)\\Notepad++\\notepad++.exe,0',
    uninstallString: '"C:\\Program Files (x86)\\Notepad++\\uninstall.exe"',
    displayVersion: '8.6.9',
    publisher: 'Notepad++ Team',
    installDate: '20240530',
    installLocation: 'C:\\Program Files (x86)\\Notepad++',
    registryHive: 'HKLM (32-bit Wow6432Node)',
    registryKeyName: 'Notepad++'
  },
  {
    id: 'steam',
    displayName: 'Steam',
    displayIcon: 'C:\\Program Files (x86)\\Steam\\steam.exe',
    uninstallString: '"C:\\Program Files (x86)\\Steam\\uninstall.exe"',
    displayVersion: '2.10.91.91',
    publisher: 'Valve Corporation',
    installDate: '20231114',
    installLocation: 'C:\\Program Files (x86)\\Steam',
    registryHive: 'HKLM (32-bit Wow6432Node)',
    registryKeyName: 'Steam'
  },
  {
    id: 'nodejs',
    displayName: 'Node.js v20.17.0',
    displayIcon: 'C:\\Windows\\Installer\\{C19B4C85-4813-4BCE-9F93-0FF2E42E353B}\\Node.ico',
    uninstallString: 'MsiExec.exe /I{C19B4C85-4813-4BCE-9F93-0FF2E42E353B}',
    displayVersion: '20.17.0',
    publisher: 'OpenJS Foundation',
    installDate: '20240902',
    installLocation: 'C:\\Program Files\\nodejs\\',
    registryHive: 'HKLM (64-bit)',
    registryKeyName: '{C19B4C85-4813-4BCE-9F93-0FF2E42E353B}'
  },
  {
    id: 'python312',
    displayName: 'Python 3.12.5 (64-bit)',
    displayIcon: 'C:\\Users\\Kullanici\\AppData\\Local\\Programs\\Python\\Python312\\python.exe',
    uninstallString: '"C:\\Users\\Kullanici\\AppData\\Local\\Package Cache\\{1c47be38-51ec-4286-9a25-c60f2ce9c099}\\python-3.12.5-amd64.exe" /uninstall',
    displayVersion: '3.12.5150.0',
    publisher: 'Python Software Foundation',
    installDate: '20240808',
    installLocation: 'C:\\Users\\Kullanici\\AppData\\Local\\Programs\\Python\\Python312\\',
    registryHive: 'HKCU (Mevcut Kullanıcı)',
    registryKeyName: '{1c47be38-51ec-4286-9a25-c60f2ce9c099}'
  },
  {
    id: 'vlc',
    displayName: 'VLC media player',
    displayIcon: 'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe,0',
    uninstallString: '"C:\\Program Files\\VideoLAN\\VLC\\uninstall.exe"',
    displayVersion: '3.0.21',
    publisher: 'VideoLAN',
    installDate: '20240615',
    installLocation: 'C:\\Program Files\\VideoLAN\\VLC',
    registryHive: 'HKLM (64-bit)',
    registryKeyName: 'VLC media player'
  },
  {
    id: 'discord',
    displayName: 'Discord',
    displayIcon: 'C:\\Users\\Kullanici\\AppData\\Local\\Discord\\app.ico',
    uninstallString: 'C:\\Users\\Kullanici\\AppData\\Local\\Discord\\Update.exe --uninstall -s',
    displayVersion: '1.0.9161',
    publisher: 'Discord Inc.',
    installDate: '20240722',
    installLocation: 'C:\\Users\\Kullanici\\AppData\\Local\\Discord',
    registryHive: 'HKCU (Mevcut Kullanıcı)',
    registryKeyName: 'Discord'
  },
  {
    id: 'postman',
    displayName: 'Postman',
    displayIcon: 'C:\\Users\\Kullanici\\AppData\\Local\\Postman\\app.ico',
    uninstallString: 'C:\\Users\\Kullanici\\AppData\\Local\\Postman\\Update.exe --uninstall -s',
    displayVersion: '11.10.0',
    publisher: 'Postman, Inc.',
    installDate: '20240825',
    installLocation: 'C:\\Users\\Kullanici\\AppData\\Local\\Postman',
    registryHive: 'HKCU (Mevcut Kullanıcı)',
    registryKeyName: 'Postman'
  }
];
