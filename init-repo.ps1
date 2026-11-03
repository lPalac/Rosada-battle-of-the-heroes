# One-time setup: creates the git repository from rosada-init.bundle
# and restores .claude/skills (Spec Kit commands for Claude Code).
# Run from this folder:  powershell -ExecutionPolicy Bypass -File .\init-repo.ps1

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$bundle = Join-Path $PSScriptRoot 'rosada-init.bundle'

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error 'git was not found on PATH. Install Git for Windows and run this script again.'
}
if (Test-Path -LiteralPath (Join-Path $PSScriptRoot '.git')) {
    Write-Error 'A .git folder already exists here. Nothing was changed.'
}
if (-not (Test-Path -LiteralPath $bundle)) {
    Write-Error 'rosada-init.bundle is missing from this folder.'
}

git bundle verify $bundle | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Error 'The bundle failed verification.' }

git init -b main
git fetch $bundle main:refs/remotes/init/main
git reset --hard init/main
git update-ref -d refs/remotes/init/main

Write-Host ''
git log --oneline -1
git status --short --branch

Remove-Item -LiteralPath $bundle
Write-Host ''
Write-Host 'Done. Repository initialized on branch main. This script will now delete itself.'
Remove-Item -LiteralPath $PSCommandPath
