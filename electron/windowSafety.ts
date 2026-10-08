export function secureWindow(window: any) {
  const contents = window.webContents;
  // No links in this local utility need navigation or additional windows.
  for (const event of ['will-navigate', 'will-frame-navigate', 'will-redirect', 'will-attach-webview']) {
    contents.on(event, (request: any) => request.preventDefault());
  }
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.session.setPermissionRequestHandler((_contents: any, _permission: any, callback: any) => callback(false));
  contents.session.setPermissionCheckHandler(() => false);
}
