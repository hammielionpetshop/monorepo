# Upload script: kirim hasil build POS Desktop ke VPS via SCP
# Usage: .\scripts\upload.ps1 -Version 1.2.0

param(
    [Parameter(Mandatory)]
    [string]$Version,

    [string]$SshUser   = "hammielion",
    [string]$SshHost   = "server.hammielion.com",
    [string]$RemotePath = "/var/www/pos-updates",
    [string]$PemFile   = "C:\Users\cundus\Documents\Project\hammielion\root.pem"
)

try {
    $ErrorActionPreference = "Stop"

    $posDesktopDir = Resolve-Path "$PSScriptRoot\.."
    $releaseDir    = Join-Path $posDesktopDir "release\$Version"

    $installer = Get-Item "$releaseDir\*_setup.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    $latestYml = Get-Item "$releaseDir\latest.yml"  -ErrorAction SilentlyContinue | Select-Object -First 1

    if (-not $installer) { throw "Installer .exe tidak ditemukan di $releaseDir" }
    if (-not $latestYml) { throw "latest.yml tidak ditemukan di $releaseDir" }

    Write-Host "Uploading $($installer.Name)..." -ForegroundColor Cyan
    scp -q -O -i $PemFile $installer.FullName "${SshUser}@${SshHost}:${RemotePath}/"
    if (-not $?) { throw "Upload installer gagal" }

    Write-Host "Uploading $($latestYml.Name)..." -ForegroundColor Cyan
    scp -q -O -i $PemFile $latestYml.FullName "${SshUser}@${SshHost}:${RemotePath}/"
    if (-not $?) { throw "Upload latest.yml gagal" }

    Write-Host ""
    Write-Host "Done! Release $Version live di https://$SshHost/pos-updates/" -ForegroundColor Green

} catch {
    Write-Host ""
    Write-Host "ERROR: $_" -ForegroundColor Red
}

Write-Host ""
Read-Host "Tekan Enter untuk keluar"
