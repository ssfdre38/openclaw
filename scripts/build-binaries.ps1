#!/usr/bin/env pwsh
# Build standalone executables for OpenClaw CE using pkg

param(
    [switch]$SkipBuild,
    [string]$OutputDir = "binaries"
)

$ErrorActionPreference = "Stop"

Write-Host "🔨 Building OpenClaw CE Standalone Binaries" -ForegroundColor Cyan
Write-Host ""

# Ensure we're in the repo root
$RepoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $RepoRoot

try {
    # Step 1: Build the project (unless skipped)
    if (-not $SkipBuild) {
        Write-Host "📦 Building OpenClaw CE..." -ForegroundColor Yellow
        pnpm build
        if ($LASTEXITCODE -ne 0) {
            throw "Build failed"
        }
        Write-Host "✅ Build complete" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "⏭️  Skipping build (--SkipBuild specified)" -ForegroundColor Yellow
        Write-Host ""
    }

    # Step 2: Get version from package.json
    Write-Host "📋 Reading version..." -ForegroundColor Yellow
    $PackageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
    $Version = $PackageJson.version
    Write-Host "   Version: $Version" -ForegroundColor Cyan
    Write-Host ""

    # Step 3: Create output directory
    $OutputPath = Join-Path $RepoRoot $OutputDir
    if (Test-Path $OutputPath) {
        Write-Host "🗑️  Cleaning old binaries..." -ForegroundColor Yellow
        Remove-Item -Path $OutputPath -Recurse -Force
    }
    New-Item -ItemType Directory -Path $OutputPath | Out-Null
    Write-Host "📁 Output directory: $OutputPath" -ForegroundColor Cyan
    Write-Host ""

    # Step 4: Build executables using pkg
    Write-Host "🚀 Building standalone executables..." -ForegroundColor Yellow
    Write-Host ""

    $Targets = @(
        @{ Name = "windows-x64"; Target = "node22-win-x64"; Ext = ".exe" },
        @{ Name = "linux-x64"; Target = "node22-linux-x64"; Ext = "" },
        @{ Name = "macos-x64"; Target = "node22-macos-x64"; Ext = "" }
    )

    foreach ($Target in $Targets) {
        Write-Host "   🔨 Building $($Target.Name)..." -ForegroundColor Cyan
        
        $OutputFile = Join-Path $OutputPath "openclaw-$Version-$($Target.Name)$($Target.Ext)"
        
        pnpm exec pkg openclaw.mjs `
            --target $($Target.Target) `
            --output $OutputFile `
            --compress GZip `
            --options no-warnings
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "      ❌ Failed to build $($Target.Name)" -ForegroundColor Red
        } else {
            $FileSize = (Get-Item $OutputFile).Length / 1MB
            Write-Host "      ✅ Built: $OutputFile ($([Math]::Round($FileSize, 2)) MB)" -ForegroundColor Green
        }
        Write-Host ""
    }

    # Step 5: Create ZIP archives for distribution
    Write-Host "📦 Creating distribution archives..." -ForegroundColor Yellow
    Write-Host ""

    foreach ($Target in $Targets) {
        $BinaryName = "openclaw-$Version-$($Target.Name)$($Target.Ext)"
        $BinaryPath = Join-Path $OutputPath $BinaryName
        
        if (Test-Path $BinaryPath) {
            $ArchiveName = "openclaw-$Version-$($Target.Name).zip"
            $ArchivePath = Join-Path $OutputPath $ArchiveName
            
            # Create a temporary directory for the archive contents
            $TempDir = Join-Path $env:TEMP "openclaw-$($Target.Name)"
            if (Test-Path $TempDir) {
                Remove-Item -Path $TempDir -Recurse -Force
            }
            New-Item -ItemType Directory -Path $TempDir | Out-Null
            
            # Copy binary
            $TargetBinaryName = "openclaw$($Target.Ext)"
            Copy-Item $BinaryPath (Join-Path $TempDir $TargetBinaryName)
            
            # Copy README, LICENSE, and .env.example
            if (Test-Path "README.md") {
                Copy-Item "README.md" $TempDir
            }
            if (Test-Path "LICENSE") {
                Copy-Item "LICENSE" $TempDir
            }
            if (Test-Path ".env.example") {
                Copy-Item ".env.example" $TempDir
            }
            
            # Create installation instructions
            $InstallInstructions = @"
# OpenClaw CE $Version - Standalone Binary

## Quick Start

1. Extract this archive
2. Run: ``./openclaw onboard`` (or ``openclaw.exe onboard`` on Windows)
3. Configure your AI models and channels
4. Run: ``./openclaw gateway`` (or ``openclaw.exe gateway`` on Windows)

## Notes

- This is a standalone executable with Node.js bundled
- No need to install Node.js separately
- Configuration is stored in ~/.openclaw by default

## Documentation

Visit https://openclawce.com for full documentation.

## Support

- GitHub: https://github.com/ssfdre38/openclaw-community-edition
- Issues: https://github.com/ssfdre38/openclaw-community-edition/issues
"@
            $InstallInstructions | Out-File (Join-Path $TempDir "README.txt") -Encoding UTF8
            
            # Create ZIP archive
            Compress-Archive -Path "$TempDir\*" -DestinationPath $ArchivePath -Force
            
            # Clean up temp directory
            Remove-Item -Path $TempDir -Recurse -Force
            
            $ArchiveSize = (Get-Item $ArchivePath).Length / 1MB
            Write-Host "   ✅ Created: $ArchiveName ($([Math]::Round($ArchiveSize, 2)) MB)" -ForegroundColor Green
        }
    }

    Write-Host ""
    Write-Host "🎉 All binaries built successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📦 Output directory: $OutputPath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Test the binaries on their respective platforms" -ForegroundColor Gray
    Write-Host "  2. Upload to GitHub Releases" -ForegroundColor Gray
    Write-Host "  3. Update website download links" -ForegroundColor Gray
    Write-Host ""

} catch {
    Write-Host ""
    Write-Host "❌ Error: $_" -ForegroundColor Red
    Pop-Location
    exit 1
} finally {
    Pop-Location
}
