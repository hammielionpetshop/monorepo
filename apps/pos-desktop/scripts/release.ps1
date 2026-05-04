# Release script: build POS Desktop lalu upload ke VPS
# Usage: .\scripts\release.ps1 -Version 1.2.0 -SshUser admin

param(
    [Parameter(Mandatory)]
    [string]$Version,

    [string]$SshUser = "root",
    [string]$SshHost = "server.hammielion.com",
    [string]$RemotePath = "/var/www/pos-updates"
)

$ErrorActionPreference = "Stop"

# ── 1. Bump version di package.json ──────────────────────────────────────────
Write-Host "Bumping version to $Version..." -ForegroundColor Cyan
$pkg = Get-Content "$PSScriptRoot\..\package.json" -Raw | ConvertFrom-Json
$pkg.version = $Version
$pkg | ConvertTo-Json -Depth 10 | Set-Content "$PSScriptRoot\..\package.json" -Encoding utf8

# ── 2. Build ──────────────────────────────────────────────────────────────────
Write-Host "Building..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot\..\..\..\"
pnpm turbo build --filter=@petshop/shared
Set-Location "$PSScriptRoot\.."
pnpm build

# ── 3. Cari file hasil build ───────────────────────────────────────────────────
$releaseDir = "$PSScriptRoot\..\release\$Version"
$installer  = Get-Item "$releaseDir\*-Setup.exe" | Select-Object -First 1
$latestYml  = Get-Item "$releaseDir\latest.yml"  | Select-Object -First 1

if (-not $installer) { Write-Error "Installer .exe tidak ditemukan di $releaseDir"; exit 1 }
if (-not $latestYml) { Write-Error "latest.yml tidak ditemukan di $releaseDir"; exit 1 }

Write-Host "Found: $($installer.Name)" -ForegroundColor Green
Write-Host "Found: $($latestYml.Name)" -ForegroundColor Green

# ── 4. Upload ke VPS via SCP ──────────────────────────────────────────────────
Write-Host "Uploading to $SshHost..." -ForegroundColor Cyan

scp $installer.FullName "${SshUser}@${SshHost}:${RemotePath}/"
scp $latestYml.FullName "${SshUser}@${SshHost}:${RemotePath}/"

Write-Host ""
Write-Host "Done! Release $Version live at https://$SshHost/pos-updates/" -ForegroundColor Green
Write-Host "App yang sudah terinstall akan auto-update dalam 2 jam berikutnya." -ForegroundColor Yellow
