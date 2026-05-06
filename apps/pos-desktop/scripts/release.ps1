# Release script: build POS Desktop lalu upload ke VPS
# Usage: .\scripts\release.ps1 -Version 1.2.0

param(
    [Parameter(Mandatory)]
    [string]$Version,

    [string]$SshUser = "hammielion",
    [string]$SshHost = "server.hammielion.com",
    [string]$RemotePath = "/var/www/pos-updates",
    [string]$PemFile = "C:\Users\cundus\Documents\Project\hammielion\root.pem"
)

$lockfile = "C:\Users\cundus\Documents\Project\hammielion\hammielion-monorepo\pnpm-lock.yaml"
$lockfileOriginal = $null

function Strip-LockfileCatalog {
    $content = [System.IO.File]::ReadAllText($lockfile, [System.Text.Encoding]::UTF8)
    $dashCount = ([regex]::Matches($content, '---')).Count
    if ($dashCount -le 1) { return }  # sudah bersih, tidak perlu diapa-apain

    $script:lockfileOriginal = $content
    # Ambil hanya dokumen kedua (project lockfile) — mulai dari "settings:"
    $idx = $content.IndexOf("settings:")
    if ($idx -lt 0) { return }
    $clean = "---`n" + $content.Substring($idx)
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($lockfile, $clean, $utf8NoBom)
    Write-Host "Lockfile catalog stripped for electron-builder." -ForegroundColor DarkGray
}

function Restore-Lockfile {
    if ($null -ne $script:lockfileOriginal) {
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText($lockfile, $script:lockfileOriginal, $utf8NoBom)
        Write-Host "Lockfile restored." -ForegroundColor DarkGray
        $script:lockfileOriginal = $null
    }
}

try {
    $ErrorActionPreference = "Stop"

    $monorepoRoot = (Resolve-Path "$PSScriptRoot\..\..\..")
    $posDesktopDir = (Resolve-Path "$PSScriptRoot\..")
    $pkgPath = Join-Path $posDesktopDir "package.json"

    Write-Host "Monorepo root : $monorepoRoot" -ForegroundColor DarkGray
    Write-Host "POS Desktop   : $posDesktopDir" -ForegroundColor DarkGray

    # ── 1. Bump version di package.json ──────────────────────────────────────────
    Write-Host "Bumping version to $Version..." -ForegroundColor Cyan
    $pkgContent = Get-Content $pkgPath -Raw -Encoding utf8
    $pkgContent = $pkgContent -replace '"version":\s*"[^"]*"', "`"version`": `"$Version`""
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($pkgPath, $pkgContent, $utf8NoBom)
    Write-Host "Version bumped." -ForegroundColor Green

    # ── 2. Build shared packages ──────────────────────────────────────────────────
    Write-Host "Building shared packages..." -ForegroundColor Cyan
    Push-Location $monorepoRoot
    pnpm turbo build --filter=@petshop/shared
    if (-not $?) { throw "Build @petshop/shared gagal" }
    Pop-Location

    # ── 3. Vite build ────────────────────────────────────────────────────────────
    Write-Host "Building POS Desktop (vite)..." -ForegroundColor Cyan
    Push-Location $posDesktopDir
    pnpm vite build
    if (-not $?) { throw "Vite build gagal" }
    Pop-Location

    # ── 4. Electron-builder ───────────────────────────────────────────────────────
    Write-Host "Packaging with electron-builder..." -ForegroundColor Cyan
    Strip-LockfileCatalog
    Push-Location $posDesktopDir
    pnpm electron-builder
    $buildOk = $?
    Pop-Location
    Restore-Lockfile
    if (-not $buildOk) { throw "Electron-builder gagal" }

    # ── 6. Cari file hasil build ──────────────────────────────────────────────────
    $releaseDir = Join-Path $posDesktopDir "release\$Version"
    $installer  = Get-Item "$releaseDir\*_setup.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    $latestYml  = Get-Item "$releaseDir\latest.yml"  -ErrorAction SilentlyContinue | Select-Object -First 1

    if (-not $installer) { throw "Installer .exe tidak ditemukan di $releaseDir" }
    if (-not $latestYml) { throw "latest.yml tidak ditemukan di $releaseDir" }

    Write-Host "Found: $($installer.Name)" -ForegroundColor Green
    Write-Host "Found: $($latestYml.Name)" -ForegroundColor Green

    # ── 7. Upload ke VPS via SCP ──────────────────────────────────────────────────
    Write-Host "Uploading to $SshHost..." -ForegroundColor Cyan
    scp -q -O -i $PemFile $installer.FullName "${SshUser}@${SshHost}:${RemotePath}/"
    if (-not $?) { throw "Upload installer gagal" }
    scp -q -O -i $PemFile $latestYml.FullName "${SshUser}@${SshHost}:${RemotePath}/"
    if (-not $?) { throw "Upload latest.yml gagal" }

    Write-Host ""
    Write-Host "Done! Release $Version live di https://$SshHost/pos-updates/" -ForegroundColor Green
    Write-Host "App yang sudah terinstall akan auto-update dalam 2 jam berikutnya." -ForegroundColor Yellow

} catch {
    Restore-Lockfile
    Write-Host ""
    Write-Host "ERROR: $_" -ForegroundColor Red
}

Write-Host ""
Read-Host "Tekan Enter untuk keluar"
