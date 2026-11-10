# 005 T048: deploy a new version to the Hostinger VPS from Windows (contracts/deployment.md).
#   ./scripts/deploy.ps1 -VpsHost game.example.com [-User luka] [-SkipTests]
# Needs: SSH key login to the VPS (ssh, scp and tar ship with Windows 11), and scripts/vps-setup.sh run once there.
param(
  [Parameter(Mandatory = $true)][string]$VpsHost,
  [string]$User = $env:USERNAME,
  [switch]$SkipTests
)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

function Run([string]$exe, [string[]]$argv) {
  & $exe @argv
  if ($LASTEXITCODE -ne 0) { throw "$exe $($argv -join ' ') failed ($LASTEXITCODE)" }
}

$hash = (git rev-parse --short HEAD).Trim()
$dirty = if ((git status --porcelain).Length -gt 0) { '+' } else { '' }
$buildId = "$hash$dirty"
$release = "$buildId-$(Get-Date -Format 'yyyyMMddHHmmss')"
$env:ROSADA_BUILD_ID = $buildId
Write-Host "== Release $release"

if (-not $SkipTests) { Run 'npm' @('test') }
Run 'npm' @('run', 'build')

# Package: the static site, the server bundle and the runtime dependencies list.
$stage = Join-Path $env:TEMP "rosada-$release"
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage -Confirm:$false }
New-Item -ItemType Directory -Force (Join-Path $stage 'server') | Out-Null
Copy-Item -Recurse dist (Join-Path $stage 'dist')
Copy-Item dist-server/index.js (Join-Path $stage 'server/index.js')
$pkg = Get-Content package.json -Raw | ConvertFrom-Json
$runtime = [ordered]@{ name = 'rosada-server'; private = $true; type = 'module'; dependencies = $pkg.dependencies }
$runtime | ConvertTo-Json -Depth 5 | Out-File -Encoding utf8 (Join-Path $stage 'package.json')
Copy-Item package-lock.json (Join-Path $stage 'package-lock.json')
$tarball = Join-Path $env:TEMP "rosada-$release.tgz"
Run 'tar' @('-czf', $tarball, '-C', $stage, '.')

$target = "$User@$VpsHost"
Write-Host "== Upload to $target"
Run 'scp' @($tarball, "${target}:/tmp/rosada-$release.tgz")
$remote = @"
set -e
dir=/opt/rosada/releases/$release
mkdir -p `$dir
tar -xzf /tmp/rosada-$release.tgz -C `$dir
rm /tmp/rosada-$release.tgz
cd `$dir
npm install --omit=dev --no-audit --no-fund
ln -sfn `$dir /opt/rosada/current
sudo /usr/bin/systemctl restart rosada
sleep 2
sudo /usr/bin/systemctl is-active rosada
# keep the five newest releases
ls -1dt /opt/rosada/releases/* | tail -n +6 | xargs -r rm -rf
"@
Run 'ssh' @($target, $remote.Replace("`r", ''))

Write-Host '== Health check'
$health = Invoke-RestMethod "https://$VpsHost/api/health"
if (-not $health.ok -or $health.buildId -ne $buildId) { throw "Health check failed: $($health | ConvertTo-Json -Compress)" }
Write-Host "Deployed $buildId to https://$VpsHost ($($health.rooms) rooms running)."
Remove-Item -Recurse -Force $stage, $tarball -Confirm:$false
