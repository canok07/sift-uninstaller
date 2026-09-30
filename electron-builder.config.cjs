// package.json version is the single source: 0.5.1-6 -> Windows 0.5.1.6.
const manifest = require('./package.json');
const match = /^(\d+)\.(\d+)\.(\d+)-(\d+)$/.exec(manifest.version);
if (!match) throw new Error('Use a version such as 0.5.1-6 for a four-part Windows release.');
const windowsVersion = match.slice(1).join('.');
if (match.slice(1).some((part) => Number(part) > 65535)) throw new Error('Windows version parts must be <= 65535.');
module.exports = {
  appId: 'com.siftuninstaller.app',
  productName: 'Sift Uninstaller',
  npmRebuild: false,
  copyright: 'Copyright © 2026 Sift Uninstaller',
  directories: { output: 'release' },
  files: ['dist/**/*', 'dist-electron/**/*', 'package.json', 'LICENSE'],
  buildVersion: windowsVersion,
  buildNumber: match[4],
  extraMetadata: { shortVersion: windowsVersion, shortVersionWindows: windowsVersion },
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    requestedExecutionLevel: 'requireAdministrator'
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    runAfterFinish: true,
    artifactName: '${productName}-Setup-${buildVersion}.${ext}'
  }
};
