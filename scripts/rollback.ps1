# 005 T048: point the VPS back at the previous release and restart (contracts/deployment.md).
#   ./scripts/rollback.ps1 -VpsHost game.example.com [-User luka]
param(
  [Parameter(Mandatory = $true)][string]$VpsHost,
  [string]$User = $env:USERNAME
)
$ErrorActionPreference = 'Stop'
$remote = @'
set -e
current=$(readlink -f /opt/rosada/current)
previous=$(ls -1dt /opt/rosada/releases/* | grep -v "^$current$" | head -n 1)
if [ -z "$previous" ]; then echo "No earlier release to roll back to"; exit 1; fi
ln -sfn "$previous" /opt/rosada/current
sudo /usr/bin/systemctl restart rosada
sleep 2
sudo /usr/bin/systemctl is-active rosada
echo "Now running $previous"
'@
& ssh "$User@$VpsHost" $remote.Replace("`r", '')
if ($LASTEXITCODE -ne 0) { throw "Rollback failed ($LASTEXITCODE)" }
Invoke-RestMethod "https://$VpsHost/api/health" | ConvertTo-Json -Compress
