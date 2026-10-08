import type { InventorySource } from '../src/types';

export const SOURCE_IDS = ['HKLM', 'WOW6432Node', 'HKCU', 'APPX'] as const;

// One envelope, including empty lists: a failed source must never look like an empty source.
export function parseInventory(stdout: string): { programs: any[]; sources: InventorySource[]; warnings: string[] } {
  const value = JSON.parse(stdout.trim());
  if (!value || value.version !== 1 || !Array.isArray(value.programs) || !Array.isArray(value.sources)
    || !Array.isArray(value.warnings) || value.sources.length !== SOURCE_IDS.length) {
    throw new Error('Windows tarama yanıtı geçersiz veya eksik.');
  }
  const sources: InventorySource[] = SOURCE_IDS.map(id => {
    const matches = value.sources.filter((source: any) => source?.id === id);
    const source = matches[0];
    if (matches.length !== 1 || !['ok', 'missing', 'error'].includes(source.status)
      || !Number.isSafeInteger(source.count) || source.count < 0 || (source.status === 'missing' && source.count !== 0)
      || (source.status === 'error' && typeof source.error !== 'string')) {
      throw new Error('Windows tarama kaynağı geçersiz: ' + id);
    }
    return { id, status: source.status, count: source.count,
      ...(source.status === 'error' ? { error: source.error.slice(0, 2000) } : {}) };
  });
  if (value.programs.some((p: any) => !p || typeof p.displayName !== 'string' || !p.displayName.trim()
    || !SOURCE_IDS.includes(p.hive) || (p.category === 'store' && (!p.packageName || !p.packageFullName)))) {
    throw new Error('Windows taramasında geçersiz program kaydı bulundu.');
  }
  if (sources.some(source => source.count !== value.programs.filter((p: any) => p.hive === source.id).length)) {
    throw new Error('Windows taramasında kaynak sayıları tutarsız.');
  }
  return { programs: value.programs, sources,
    warnings: value.warnings.filter((w: unknown) => typeof w === 'string').slice(0, 100).map((w: string) => w.slice(0, 2000)) };
}

export const INVENTORY_SCRIPT = String.raw`
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ProgressPreference = 'SilentlyContinue'
$apps = [System.Collections.Generic.List[object]]::new()
$sources = [System.Collections.Generic.List[object]]::new()
$warnings = [System.Collections.Generic.List[string]]::new()
$resolverAvailable = $false
try {
  Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class SiftResourceName {
  [DllImport("shlwapi.dll", CharSet=CharSet.Unicode)]
  public static extern int SHLoadIndirectString(string input, StringBuilder output, uint size, IntPtr reserved);
}
'@ -ErrorAction Stop
  $resolverAvailable = $true
} catch { $warnings.Add('Store resource resolver: ' + $_.Exception.Message) }
function Resolve-SiftName($value, $package, $fallback) {
  $text = [string]$value
  if ([string]::IsNullOrWhiteSpace($text)) { return $fallback }
  if ($text -notmatch '^ms-resource:') { return $text }
  if ($resolverAvailable) {
    $resource = $text.Substring(12).TrimStart('/')
    $uris = @($text, ('ms-resource://' + $package.Name + '/resources/' + $resource), ('ms-resource://' + $package.Name + '/' + $resource))
    foreach ($uri in $uris) {
      $inputName = '@{' + $package.PackageFullName + '?' + $uri + '}'
      $buffer = [System.Text.StringBuilder]::new(2048)
      $code = [SiftResourceName]::SHLoadIndirectString($inputName, $buffer, 2048, [IntPtr]::Zero)
      $resolved = $buffer.ToString()
      if ($code -eq 0 -and $resolved -and $resolved -ne $inputName -and $resolved -notmatch '^ms-resource:') { return $resolved }
    }
  }
  $warnings.Add([string]$package.Name + ': Display resource could not be resolved: ' + $text)
  return $fallback
}
$hives = @(
  @{ Hive='HKLM'; Path='HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall' },
  @{ Hive='WOW6432Node'; Path='HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall' },
  @{ Hive='HKCU'; Path='HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall' }
)
foreach ($h in $hives) {
  $start = $apps.Count
  $status = 'ok'
  $errorText = ''
  try {
    if (-not (Test-Path -LiteralPath $h.Path -ErrorAction Stop)) { $status = 'missing' }
    else {
      # Enumerate children explicitly so access errors are not silently swallowed.
      Get-ChildItem -LiteralPath $h.Path -ErrorAction Stop | ForEach-Object {
        $entry = Get-ItemProperty -LiteralPath $_.PSPath -ErrorAction Stop
        $dn = [string]$entry.DisplayName
        if ($dn.Trim().Length -gt 0) {
          $isSystem = ($entry.SystemComponent -eq 1) -or (-not [string]::IsNullOrWhiteSpace([string]$entry.ParentKeyName)) -or ([string]$entry.ReleaseType -match 'Update|Hotfix|Security')
          $apps.Add([PSCustomObject]@{
            displayName=$dn.Trim(); displayVersion=[string]$entry.DisplayVersion; publisher=[string]$entry.Publisher
            uninstallString=[string]$entry.UninstallString; quietUninstallString=[string]$entry.QuietUninstallString
            estimatedSize=if ($entry.EstimatedSize) { [long]$entry.EstimatedSize } else { 0 }
            displayIcon=[string]$entry.DisplayIcon; installDate=[string]$entry.InstallDate; installLocation=[string]$entry.InstallLocation
            registryKey=([string]$entry.PSPath -replace '^Microsoft\.PowerShell\.Core\\Registry::','').Trim()
            hive=$h.Hive; category=if ($isSystem) { 'system' } else { 'desktop' }
            isSystemComponent=[bool]$isSystem; packageFullName=''; packageName=''
          })
        }
      }
    }
  } catch { $status='error'; $errorText=$_.Exception.Message }
  $sources.Add([PSCustomObject]@{ id=$h.Hive; status=$status; count=($apps.Count-$start); error=$errorText })
}
$start = $apps.Count
$status = 'ok'
$errorText = ''
try {
  Get-AppxPackage -ErrorAction Stop | Where-Object { (-not $_.IsFramework) -and (-not $_.NonRemovable) } | ForEach-Object {
    $p = $_
    $name = [string]$p.Name
    $publisher = ([string]$p.Publisher -replace '^CN=([^,]+).*$','$1')
    $icon = ''
    try {
      $manifest = Get-AppxPackageManifest -Package $p.PackageFullName -ErrorAction Stop
      $visual = @($manifest.Package.Applications.Application)[0].VisualElements
      $nameValue = [string]$manifest.Package.Properties.DisplayName
      if (-not $nameValue) { $nameValue = [string]$visual.DisplayName }
      $name = Resolve-SiftName $nameValue $p $name
      $publisher = Resolve-SiftName $manifest.Package.Properties.PublisherDisplayName $p $publisher
      $logo = [string]$visual.Square44x44Logo
      if (-not $logo) { $logo = [string]$manifest.Package.Properties.Logo }
      if ($logo -and $p.InstallLocation) { $icon = Join-Path -Path $p.InstallLocation -ChildPath $logo }
    } catch { $warnings.Add([string]$p.Name + ': Store metadata: ' + $_.Exception.Message) }
    $apps.Add([PSCustomObject]@{
      displayName=$name; displayVersion=[string]$p.Version; publisher=$publisher
      uninstallString=''; quietUninstallString=''; estimatedSize=0; displayIcon=$icon; installDate=''
      installLocation=[string]$p.InstallLocation; registryKey=('APPX\' + [string]$p.PackageFullName)
      hive='APPX'; category='store'; isSystemComponent=$false
      packageFullName=[string]$p.PackageFullName; packageName=[string]$p.Name
    })
  }
} catch { $status='error'; $errorText=$_.Exception.Message }
$sources.Add([PSCustomObject]@{ id='APPX'; status=$status; count=($apps.Count-$start); error=$errorText })
[PSCustomObject]@{ version=1; programs=@($apps.ToArray()); sources=@($sources.ToArray()); warnings=@($warnings.ToArray()) } | ConvertTo-Json -Compress -Depth 5
`;
