import path from 'node:path';

// Parse Windows quoting without cmd.exe evaluation. Never execute shell syntax
// from a per-user Registry value inside an elevated shell.
export function parseUninstallCommand(command: string, env: NodeJS.ProcessEnv) {
  if (command.length > 16384 || /[\x00-\x1f]/.test(command)) throw new Error('Kaldırma komutu geçersiz.');
  command = command.replace(/%([a-z_()0-9]+)%/gi, (raw, name: string) => {
    const key = Object.keys(env).find(key => key.toLowerCase() === name.toLowerCase());
    return ['systemroot', 'windir', 'programfiles', 'programfiles(x86)', 'appdata', 'localappdata'].includes(name.toLowerCase()) && key ? env[key]! : raw;
  }).trim();
  // Some installers fail to quote their executable path. Recognize only its
  // leading .exe boundary, not an arbitrary later argument or shell command.
  if (!command.startsWith('"') && /^[a-z]:\\/i.test(command)) {
    const boundary = /\.exe(?=\s|$)/i.exec(command);
    if (!boundary) throw new Error('Yerel EXE kaldırıcı yolu gerekli.');
    const end = boundary.index + 4;
    command = '"' + command.slice(0, end) + '"' + command.slice(end);
  }
  const argv: string[] = [];
  let token = '', quoted = false, started = false;
  for (let index = 0; index < command.length; index++) {
    const char = command[index];
    if (char === '\\') {
      let count = 1;
      while (command[index + count] === '\\') count++;
      if (command[index + count] === '"') {
        token += '\\'.repeat(Math.floor(count / 2));
        if (count % 2) token += '"'; else quoted = !quoted;
        index += count;
      } else { token += '\\'.repeat(count); index += count - 1; }
      started = true;
    } else if (char === '"') { quoted = !quoted; started = true; }
    else if (/\s/.test(char) && !quoted) { if (started) { argv.push(token); token = ''; started = false; } }
    else { token += char; started = true; }
  }
  if (quoted) throw new Error('Kaldırma komutunda kapanmamış tırnak var.');
  if (started) argv.push(token);
  if (argv.some(arg => ['&', '&&', '|', '||', '>', '<'].includes(arg))) throw new Error('Birden fazla shell komutu çalıştırılmaz.');
  let executable = argv.shift() || '';
  if (/^msiexec(?:\.exe)?$/i.test(executable)) executable = path.win32.join(env.WINDIR || 'C:\\Windows', 'System32', 'msiexec.exe');
  if (!/^[a-z]:\\.*\.exe$/i.test(executable) || /[<>|*?%]/.test(executable) || executable.split('\\').includes('..')) throw new Error('Kaldırıcı yerel mutlak EXE yolu olmalı; shell/ağ komutları çalıştırılmaz.');
  // Script hosts and command interpreters are not uninstallers.
  if (/^(cmd|powershell|pwsh|wscript|cscript|mshta|rundll32|regsvr32)\.exe$/i.test(path.win32.basename(executable))) throw new Error('Komut yorumlayıcısı kaldırıcı olarak çalıştırılmaz.');
  return { executable, args: argv };
}
