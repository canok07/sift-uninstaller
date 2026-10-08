// Read-only integration smoke test. Never launch an installed program's uninstaller.
const { app, BrowserWindow, ipcMain, nativeImage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const child = require('node:child_process');
const { promisify } = require('node:util');

const root = path.resolve(__dirname, '..');
const packagedAssets = process.env.SIFT_SMOKE_PACKAGED === '1';
const assetRoot = packagedAssets ? path.join(root, 'release/win-unpacked/resources/app.asar') : root;
const output = path.join(root, '.test-build');
fs.mkdirSync(output, { recursive: true });
const profile = fs.mkdtempSync(path.join(output, 'electron-smoke-'));
app.setPath('userData', profile);
app.disableHardwareAcceleration();
let win, startup, latestInventory, latestFrame;
let fixtureLauncher, fixtureStarts = 0, closePrompts = 0;
const releaseFixture = path.join(profile, 'release-fixture');
const fixtureRoaming = fs.mkdtempSync(path.join(output, 'electron-smoke-roaming-'));
class HiddenWindow extends BrowserWindow {
  constructor(options) {
    super({ ...options, show: false, webPreferences: { ...options.webPreferences, backgroundThrottling: false, offscreen: true } });
    win = this;
    this.webContents.on('paint', (_event, _dirty, image) => { latestFrame = image; });
  }
  show() {} // The test must not steal focus from the user's desktop.
}
const safeExecFile = () => { throw new Error('Only encoded read-only PowerShell is allowed'); };
safeExecFile[promisify.custom] = async (file, args, options) => {
  assert.equal(file, 'powershell.exe');
  const script = Buffer.from(args.at(-1), 'base64').toString('utf16le');
  if (script.includes('WindowsIdentity')) return { stdout: 'True', stderr: '' }; // fixture elevation; never trigger a live UAC prompt
  assert.ok(!/Remove-AppxPackage|Remove-Item|Checkpoint-Computer|Start-Process|reg\.exe/.test(script));
  assert.ok(script.includes('$hives') || script.includes("'INSTALLED'"));
  return promisify(child.execFile)(file, args, { ...options, timeout: 30000 });
};
const wrappedElectron = {
  ...require('electron'), BrowserWindow: HiddenWindow,
  app: { isPackaged: true, requestSingleInstanceLock: () => true, on() {},
    getPath: name => name === 'userData' ? profile : app.getPath(name),
    getFileIcon: (...args) => app.getFileIcon(...args),
    whenReady: () => ({ then(callback) { startup = app.whenReady().then(callback); } }) },
  ipcMain: { handle(channel, handler) { ipcMain.handle(channel, async (...args) => {
    // Restore-point behavior is a fixture too; never change Windows protection.
    if (channel === 'system:create-restore-point') return { success: false, supported: false, error: 'SIFT_SMOKE_RESTORE_FAILURE' };
    const result = await handler(...args);
    if (channel === 'programs:get-installed') latestInventory = result;
    return result;
  }); } },
  Menu: { setApplicationMenu() {} }
  , dialog: { showMessageBox: async () => { closePrompts++; return { response: 0 }; } }
};
function fixtureSpawn(_command, argsOrOptions, options) {
  // Never evaluate the registered command. Substitute our bounded, harmless
  // fixture process and exercise the production lifetime/cancellation manager.
  assert.equal(options.shell, false);
  assert.ok(Array.isArray(argsOrOptions));
  assert.equal(options.timeout, undefined);
  assert.equal(options.signal, undefined);
  fixtureStarts++;
  fixtureLauncher = child.spawn(process.execPath, [path.join(root, 'tests/fixtures/holding-child.cjs'), releaseFixture], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: 'ignore', windowsHide: true
  });
  return fixtureLauncher;
}
const moduleObject = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(assetRoot, 'dist-electron/main.cjs'), 'utf8'), {
  module: moduleObject, exports: moduleObject.exports, __dirname: path.join(assetRoot, 'dist-electron'),
  Buffer, console, setTimeout, clearTimeout, URL,
  process: { ...process, resourcesPath: path.join(root, 'release/win-unpacked/resources'), env: { ...process.env, APPDATA: fixtureRoaming, SIFT_DEV_SERVER: '1' }, on() {} },
  require: name => name === 'electron' ? wrappedElectron : name === 'node:child_process'
    ? { execFile: safeExecFile, spawn: fixtureSpawn } : require(name)
});

async function waitFor(check, label) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Timed out: ' + label);
}
function paintedBackground(dark) {
  if (!latestFrame) return false;
  const { width, height } = latestFrame.getSize();
  if (height < 100) return false;
  const pixel = latestFrame.toBitmap().subarray((80 * width + 2) * 4, (80 * width + 2) * 4 + 3);
  // toBitmap uses BGRA on Windows. Pick an outer background pixel, not the fixed header.
  return dark ? pixel.every(channel => channel < 16) : pixel.every(channel => channel > 220);
}
(async () => {
  await startup;
  await waitFor(() => win.webContents.executeJavaScript("Boolean(document.querySelector('table'))"), 'renderer');
  await waitFor(() => win.webContents.executeJavaScript("document.querySelector('aside[aria-label=\"Tarama kaynakları\"]')?.textContent"), 'inventory');
  const inventory = latestInventory;
  assert.equal(win.webContents.getLastWebPreferences().sandbox, true);
  assert.equal(win.webContents.getLastWebPreferences().nodeIntegration, false);
  assert.equal(await win.webContents.executeJavaScript("typeof require"), 'undefined');
  await win.webContents.executeJavaScript("const blockedScript = document.createElement('script'); blockedScript.textContent = 'window.SIFT_INLINE_EXECUTED = true'; document.body.appendChild(blockedScript)");
  assert.equal(await win.webContents.executeJavaScript('Boolean(window.SIFT_INLINE_EXECUTED)'), false);
  const windowsBefore = BrowserWindow.getAllWindows().length;
  await win.webContents.executeJavaScript("window.open('https://example.com/')");
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.equal(BrowserWindow.getAllWindows().length, windowsBefore);
  assert.equal(inventory.success, true, inventory.error);
  // Ensure ordinary UI icons are displayed, not just the Sift header icon.
  await waitFor(() => win.webContents.executeJavaScript("Array.from(document.querySelectorAll('td img')).filter(i => i.complete && i.naturalWidth > 0).length"), 'program icons');
  await new Promise(resolve => setTimeout(resolve, 2000));
  const iconCount = await win.webContents.executeJavaScript("Array.from(document.querySelectorAll('td img')).filter(i => i.complete && i.naturalWidth > 0).length");
  const text = await win.webContents.executeJavaScript('document.body.innerText');
  assert.ok(text.includes('HKLM') && text.includes('Store / AppX'));
  await win.webContents.executeJavaScript("console.error('SIFT_SMOKE_CONSOLE_ERROR'); setTimeout(() => { throw new Error('SIFT_SMOKE_GLOBAL_ERROR'); }, 0); void window.api.reportRendererError({kind:'react',message:'SIFT_SMOKE_REACT_REPORT'})");
  const log = path.join(profile, 'logs', 'sift-uninstaller.log');
  await waitFor(() => fs.existsSync(log) && fs.readFileSync(log, 'utf8').includes('SIFT_SMOKE_GLOBAL_ERROR'), 'persisted global error');
  assert.ok(fs.readFileSync(log, 'utf8').includes('SIFT_SMOKE_REACT_REPORT'));
  assert.ok(fs.readFileSync(log, 'utf8').includes('SIFT_SMOKE_CONSOLE_ERROR'));
  const beforeTheme = await win.webContents.executeJavaScript("document.documentElement.classList.contains('dark')");
  await win.webContents.executeJavaScript("Array.from(document.querySelectorAll('button')).find(b => b.title.includes('Moda Geç') || b.title.includes('Moduna Geç')).click()");
  await waitFor(() => win.webContents.executeJavaScript("document.documentElement.classList.contains('dark') !== " + beforeTheme), 'theme toggle');
  const afterColor = await win.webContents.executeJavaScript("getComputedStyle(document.getElementById('root')).backgroundColor");
  assert.equal(afterColor, beforeTheme ? 'rgb(241, 245, 249)' : 'rgb(0, 0, 0)');
  win.webContents.invalidate();
  await waitFor(() => paintedBackground(!beforeTheme), 'painted theme');
  fs.writeFileSync(path.join(output, beforeTheme ? 'medium-preview-light.png' : 'medium-preview-dark.png'), latestFrame.toPNG());
  await win.webContents.executeJavaScript("Array.from(document.querySelectorAll('button')).find(b => b.title.includes('Moda Geç') || b.title.includes('Moduna Geç')).click()");
  await waitFor(() => win.webContents.executeJavaScript("document.documentElement.classList.contains('dark') === " + beforeTheme), 'theme restore');
  win.webContents.invalidate();
  await waitFor(() => paintedBackground(beforeTheme), 'painted restored theme');
  fs.writeFileSync(path.join(output, 'medium-preview.png'), latestFrame.toPNG());

  const click = label => win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(label)}).click()`);
  const hasText = text => win.webContents.executeJavaScript(`document.body.innerText.includes(${JSON.stringify(text)})`);
  const testProgram = inventory.programs.find(program => program.category === 'desktop' && /^(?:msiexec(?:\.exe)?\s|"?[a-z]:\\.*\.exe)/i.test(program.uninstallString || ''));
  assert.ok(testProgram, 'A local EXE/MSI registration is required for the substituted fixture test');
  await win.webContents.executeJavaScript(`const field = document.querySelector('input[placeholder^="Program veya"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(field, ${JSON.stringify(testProgram.displayName)}); field.dispatchEvent(new Event('input', {bubbles:true}));`);
  await waitFor(() => hasText(testProgram.displayName), 'fixture-target row');
  const openConfirm = async () => {
    await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('tbody tr')).find(row => row.innerText.includes(${JSON.stringify(testProgram.displayName)})).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`);
    await waitFor(() => hasText('Kaldırıcıyı Başlat'), 'double-click confirmation');
  };
  await openConfirm();
  assert.equal(fixtureStarts, 0);
  await click('Vazgeç');
  await waitFor(async () => !(await hasText('Kaldırıcıyı Başlat')), 'confirmation dismissed');
  await openConfirm(); await click('Kaldırıcıyı Başlat');
  await waitFor(() => hasText('SIFT_SMOKE_RESTORE_FAILURE'), 'restore-point failure confirmation');
  await click('Kaldırmayı İptal Et');
  await waitFor(() => hasText('Hiçbir kaldırıcı başlatılmadı.'), 'restore-point cancellation');
  assert.equal(fixtureStarts, 0);
  await openConfirm(); await click('Kaldırıcıyı Başlat');
  await waitFor(() => hasText('SIFT_SMOKE_RESTORE_FAILURE'), 'second restore-point confirmation');
  await click('Yedeksiz Devam Et');
  await waitFor(() => hasText('Beklemeyi Bırak'), 'active fixture monitoring');
  assert.equal(fixtureStarts, 1);
  // Close confirmation is intercepted, not a real desktop modal.
  win.close();
  await waitFor(() => closePrompts === 1, 'close warning');
  assert.equal(win.isDestroyed(), false);
  await click('Beklemeyi Bırak');
  await waitFor(() => hasText('Sift Beklemesini Bırak'), 'cancel confirmation');
  await click('Beklemeye Devam Et');
  await waitFor(async () => !(await hasText('Sift Beklemesini Bırak')), 'continue waiting');
  const beforeCancel = await win.webContents.executeJavaScript('window.api.getUninstallActivity()');
  assert.equal(beforeCancel.awaitingResult, true);
  await click('Beklemeyi Bırak');
  await waitFor(() => hasText('Sift Beklemesini Bırak'), 'second cancel confirmation');
  await click('Sift Beklemesini Bırak');
  await waitFor(() => hasText('Bekleme bırakıldı; takip sürüyor'), 'cancelled wait still tracked');
  assert.equal(fixtureLauncher.killed, false);
  const blocked = await win.webContents.executeJavaScript('window.api.getInstalledPrograms()');
  assert.equal(blocked.success, false);
  assert.ok(blocked.error.includes('takip ediliyor'));
  win.webContents.invalidate();
  await new Promise(resolve => setTimeout(resolve, 200));
  if (latestFrame) fs.writeFileSync(path.join(output, 'uninstall-wait-preview.png'), latestFrame.toPNG());
  win.webContents.reload();
  await waitFor(() => hasText('Bekleme bırakıldı; takip sürüyor'), 'tracking survives renderer reload');
  fs.writeFileSync(releaseFixture, 'release test process');
  await waitFor(async () => !(await win.webContents.executeJavaScript('window.api.getUninstallActivity()')).active, 'fixture exited normally');
  assert.equal(fixtureLauncher.killed, false);
  await waitFor(() => win.webContents.executeJavaScript("Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Uygulamalar')?.disabled === false"), 'UI unlocked');
  await click('Uygulamalar');
  await waitFor(() => win.webContents.executeJavaScript("document.querySelector('aside[aria-label=\"Tarama kaynakları\"]')?.textContent"), 'safe refresh after fixture exit');
  assert.equal(latestInventory.programs.length, inventory.programs.length);
  assert.equal(await win.webContents.executeJavaScript("Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Kalıntıyı Temizle')?.disabled"), true);
  assert.ok(fs.readFileSync(log, 'utf8').includes('Windows işlemi öldürülmedi'));
  const history = await win.webContents.executeJavaScript("JSON.parse(localStorage.getItem('sift_operation_history')).entries");
  assert.ok(history.some(entry => entry.operation === 'Kaldırma' && entry.status === 'cancelled'));
  await win.webContents.executeJavaScript("Array.from(document.querySelectorAll('button')).find(b => b.title === 'Gelişmiş Yapılandırma Ayarları').click()");
  await click('Temizlik Yedeklerini Geri Al');
  await waitFor(() => hasText('Henüz bu biçimde temizlik yedeği yok.'), 'recovery empty state');
  // A journal fixture under our own profile exercises real filesystem recovery,
  // without generating candidates from or cleaning the user's data.
  const crypto = require('node:crypto');
  const backupId = crypto.randomUUID();
  const registryKey = 'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\SiftSmokeFixture';
  const programId = 'win-app-' + crypto.createHash('sha256').update(('registry:' + registryKey).toLowerCase()).digest('hex');
  const fixtureTarget = path.join(fixtureRoaming, 'SiftSmokeFixture');
  const fixtureBackup = path.join(profile, 'cleanup-backups', backupId);
  fs.mkdirSync(path.join(fixtureBackup, 'payload'), { recursive: true });
  fs.writeFileSync(path.join(fixtureBackup, 'payload', 'data.txt'), 'recover this');
  const digest = crypto.createHash('sha256').update(JSON.stringify(['', 'dir'])).update(JSON.stringify(['data.txt', 'file'])).update('recover this').digest('hex');
  fs.writeFileSync(path.join(fixtureBackup, 'manifest.json'), JSON.stringify({ version: 1, id: backupId, type: 'folder', originalPath: fixtureTarget, appName: 'SiftSmokeFixture', createdAt: new Date().toISOString(), state: 'prepared', digest,
    program: { id: programId, category: 'desktop', displayName: 'SiftSmokeFixture', registryHive: 'HKCU', registryKey } }));
  await click('Yedekleri Yenile');
  await waitFor(() => hasText('SiftSmokeFixture'), 'interrupted backup fixture');
  await click('Geri Al'); await waitFor(() => hasText('Onayla ve Geri Al'), 'recovery confirmation');
  await click('Vazgeç'); assert.equal(fs.existsSync(fixtureTarget), false);
  await click('Geri Al'); await click('Onayla ve Geri Al');
  await waitFor(() => hasText('Özgün hedef geri alındı.'), 'fixture restore result');
  assert.equal(fs.readFileSync(path.join(fixtureTarget, 'data.txt'), 'utf8'), 'recover this');
  assert.equal(fs.existsSync(path.join(fixtureBackup, 'payload', 'data.txt')), true);
  win.webContents.invalidate(); await new Promise(resolve => setTimeout(resolve, 300));
  if (latestFrame) fs.writeFileSync(path.join(output, 'recovery-preview.png'), latestFrame.toPNG());
  await win.webContents.executeJavaScript("document.querySelector('[aria-labelledby=\"backup-title\"] button').click()");
  const proof = { version: require('../package.json').version, packagedAssets, sources: inventory.sources,
    programCount: inventory.programs.length, realIconCount: iconCount,
    friendlyStoreNames: inventory.programs.filter(p => p.category === 'store' && p.displayName !== p.packageName).length,
    metadataWarnings: inventory.warnings.length, globalErrorPersisted: true, rendererReportPersisted: true, consoleErrorPersisted: true, themeTogglePassed: true,
    doubleClickConfirmationPassed: true, restoreFailureCancelPassed: true,
    cancellationConfirmationPassed: true, backgroundGatePassed: true, closeWarningLogicPassed: true,
    rendererReloadPreservesTracking: true, harmlessFixtureStarts: fixtureStarts,
    sandboxEnabled: true, inlineScriptBlocked: true, popupBlocked: true, recoveryEmptyStatePassed: true, recoveryFixtureRoundTripPassed: true,
    realUninstallersRun: false, realUserCleanupRun: false, installerUACTested: false };
  fs.writeFileSync(path.join(output, 'medium-smoke.json'), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof));
  win.destroy();
  assert.equal(path.dirname(profile), output);
  // Chromium still holds profile files here. The parent runner removes this
  // newly-created fixture only after this process has completely exited.
  app.exit(0);
})().catch(error => {
  console.error(error);
  // Request only the fixture to exit; never kill a Windows uninstaller.
  fs.writeFileSync(releaseFixture, 'release test process after failure');
  if (win && !win.isDestroyed()) win.destroy();
  // Preserve the isolated profile/logs for diagnosis on failure.
  app.exit(1);
});
