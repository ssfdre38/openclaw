#!/usr/bin/env pwsh
#Requires -Version 5.1

<#
.SYNOPSIS
    OpenClaw Community Edition Installation Script for Windows
.DESCRIPTION
    Interactive installer that sets up OpenClaw CE with optional Ollama CE integration
.NOTES
    Version: 1.0.0
    Author: OpenClaw Community
#>

param(
    [switch]$SkipOllama,
    [switch]$NonInteractive,
    [string]$InstallPath = "$env:USERPROFILE\.openclaw"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Colors
$ColorHeader = "Cyan"
$ColorSuccess = "Green"
$ColorWarning = "Yellow"
$ColorError = "Red"
$ColorInfo = "White"

function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor $ColorHeader
    Write-Host "  $Message" -ForegroundColor $ColorHeader
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor $ColorHeader
    Write-Host ""
}

function Write-Step {
    param([string]$Message)
    Write-Host "▶ $Message" -ForegroundColor $ColorInfo
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor $ColorSuccess
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor $ColorWarning
}

function Write-Error-Message {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor $ColorError
}

function Test-CommandExists {
    param([string]$Command)
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

function Test-NodeVersion {
    if (-not (Test-CommandExists "node")) {
        return $false
    }
    
    $nodeVersion = node --version
    $versionNumber = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    return $versionNumber -ge 18
}

function Install-Prerequisite {
    param(
        [string]$Name,
        [string]$Command,
        [scriptblock]$Validator,
        [string]$InstallUrl
    )
    
    Write-Step "Checking $Name..."
    
    if (& $Validator) {
        Write-Success "$Name is already installed"
        return $true
    }
    
    Write-Warning "$Name is not installed or version is too old"
    
    if ($NonInteractive) {
        Write-Error-Message "Cannot install $Name in non-interactive mode"
        Write-Host "Please install $Name from: $InstallUrl" -ForegroundColor $ColorInfo
        return $false
    }
    
    $response = Read-Host "Would you like to open the download page for $Name? (y/N)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        Start-Process $InstallUrl
        Write-Host "Please install $Name and run this script again." -ForegroundColor $ColorInfo
        exit 0
    }
    
    return $false
}

function Install-Pnpm {
    Write-Step "Installing pnpm package manager..."
    
    try {
        npm install -g pnpm
        Write-Success "pnpm installed successfully"
        return $true
    } catch {
        Write-Error-Message "Failed to install pnpm: $_"
        return $false
    }
}

function Get-LatestRelease {
    param([string]$Repo)
    
    try {
        $url = "https://api.github.com/repos/$Repo/releases/latest"
        $response = Invoke-RestMethod -Uri $url -ErrorAction Stop
        return $response.tag_name
    } catch {
        Write-Warning "Could not fetch latest release for $Repo"
        return $null
    }
}

function Install-OpenClaw {
    Write-Header "Installing OpenClaw Community Edition"
    
    Write-Step "Installation path: $InstallPath"
    
    if (Test-Path $InstallPath) {
        Write-Warning "Installation directory already exists: $InstallPath"
        
        if (-not $NonInteractive) {
            $response = Read-Host "Do you want to remove it and reinstall? (y/N)"
            if ($response -eq 'y' -or $response -eq 'Y') {
                Remove-Item -Path $InstallPath -Recurse -Force
                Write-Success "Removed existing installation"
            } else {
                Write-Host "Installation cancelled" -ForegroundColor $ColorInfo
                exit 0
            }
        } else {
            Write-Error-Message "Installation directory exists. Please remove it first."
            exit 1
        }
    }
    
    Write-Step "Cloning OpenClaw CE from GitHub..."
    
    try {
        git clone --depth 1 https://github.com/ssfdre38/openclaw-community-edition.git $InstallPath
        Write-Success "Repository cloned successfully"
    } catch {
        Write-Error-Message "Failed to clone repository: $_"
        exit 1
    }
    
    Push-Location $InstallPath
    
    try {
        Write-Step "Installing dependencies with pnpm..."
        pnpm install
        Write-Success "Dependencies installed"
        
        Write-Step "Building OpenClaw CE..."
        pnpm run build
        Write-Success "Build completed"
        
    } catch {
        Write-Error-Message "Installation failed: $_"
        Pop-Location
        exit 1
    } finally {
        Pop-Location
    }
}

function Install-OllamaCE {
    Write-Header "Installing Ollama Community Edition"
    
    $ollamaPath = "$InstallPath\.ollama-ce"
    
    Write-Step "Ollama CE will be installed to: $ollamaPath"
    
    if (Test-Path $ollamaPath) {
        Write-Warning "Ollama CE directory already exists"
        
        if (-not $NonInteractive) {
            $response = Read-Host "Do you want to update it? (y/N)"
            if ($response -ne 'y' -and $response -ne 'Y') {
                Write-Host "Skipping Ollama CE installation" -ForegroundColor $ColorInfo
                return
            }
        }
    }
    
    Write-Step "Cloning Ollama CE from GitHub..."
    
    try {
        if (Test-Path $ollamaPath) {
            Push-Location $ollamaPath
            git pull origin community-edition
            Pop-Location
            Write-Success "Ollama CE updated"
        } else {
            git clone --depth 1 --branch community-edition https://github.com/ssfdre38/ollama.git $ollamaPath
            Write-Success "Ollama CE cloned"
        }
        
        Push-Location $ollamaPath
        
        Write-Step "Building Ollama CE..."
        Write-Warning "This may take several minutes..."
        
        # Check if Go is installed
        if (-not (Test-CommandExists "go")) {
            Write-Error-Message "Go is required to build Ollama CE"
            Write-Host "Please install Go from: https://go.dev/dl/" -ForegroundColor $ColorInfo
            Pop-Location
            return
        }
        
        # Build Ollama
        go generate ./...
        go build .
        
        Write-Success "Ollama CE built successfully"
        Write-Host "Ollama CE executable: $ollamaPath\ollama.exe" -ForegroundColor $ColorInfo
        
    } catch {
        Write-Error-Message "Failed to install Ollama CE: $_"
        Pop-Location
        return
    } finally {
        Pop-Location
    }
}

function Initialize-Configuration {
    Write-Header "Setting Up Configuration"
    
    $configPath = "$InstallPath\.env"
    $examplePath = "$InstallPath\.env.example"
    
    if (Test-Path $configPath) {
        Write-Warning "Configuration file already exists: $configPath"
        return
    }
    
    if (Test-Path $examplePath) {
        Write-Step "Creating configuration from template..."
        Copy-Item $examplePath $configPath
        Write-Success "Configuration file created"
        Write-Host "Please edit $configPath to customize your settings" -ForegroundColor $ColorInfo
    } else {
        Write-Warning "No .env.example found, skipping configuration setup"
    }
}

function Show-NextSteps {
    Write-Header "Installation Complete!"
    
    Write-Host "OpenClaw CE has been installed to:" -ForegroundColor $ColorSuccess
    Write-Host "  $InstallPath" -ForegroundColor $ColorInfo
    Write-Host ""
    
    Write-Host "Next steps:" -ForegroundColor $ColorHeader
    Write-Host "  1. Configure your settings:" -ForegroundColor $ColorInfo
    Write-Host "     Edit: $InstallPath\.env" -ForegroundColor $ColorInfo
    Write-Host ""
    Write-Host "  2. Run the interactive onboarding:" -ForegroundColor $ColorInfo
    Write-Host "     cd $InstallPath" -ForegroundColor $ColorInfo
    Write-Host "     openclaw onboard" -ForegroundColor $ColorInfo
    Write-Host ""
    Write-Host "  3. Start OpenClaw Gateway:" -ForegroundColor $ColorInfo
    Write-Host "     openclaw gateway" -ForegroundColor $ColorInfo
    Write-Host ""
    
    if (Test-Path "$InstallPath\.ollama-ce\ollama.exe") {
        Write-Host "  3. Start Ollama CE (optional):" -ForegroundColor $ColorInfo
        Write-Host "     $InstallPath\.ollama-ce\ollama.exe serve" -ForegroundColor $ColorInfo
        Write-Host ""
        Write-Host "     Pull a model:" -ForegroundColor $ColorInfo
        Write-Host "     $InstallPath\.ollama-ce\ollama.exe pull llama3.2" -ForegroundColor $ColorInfo
        Write-Host ""
    }
    
    Write-Host "Standalone Installers:" -ForegroundColor $ColorHeader
    Write-Host "  Ollama CE: irm https://raw.githubusercontent.com/ssfdre38/ollama/community-edition/install.ps1 | iex" -ForegroundColor $ColorInfo
    Write-Host "  Image Gen: $InstallPath\scripts\setup-image-generation.ps1" -ForegroundColor $ColorInfo
    Write-Host ""
    
    Write-Host "For more information, visit:" -ForegroundColor $ColorHeader
    Write-Host "  https://openclawce.com" -ForegroundColor $ColorInfo
    Write-Host "  https://github.com/ssfdre38/openclaw-community-edition" -ForegroundColor $ColorInfo
    Write-Host ""
}

# Main installation flow
try {
    Write-Header "OpenClaw Community Edition Installer"
    
    Write-Host "This script will install OpenClaw CE on your system." -ForegroundColor $ColorInfo
    Write-Host ""
    
    # Check prerequisites
    Write-Header "Checking Prerequisites"
    
    $canProceed = $true
    
    # Check Git
    if (-not (Install-Prerequisite -Name "Git" -Command "git" -Validator { Test-CommandExists "git" } -InstallUrl "https://git-scm.com/download/win")) {
        $canProceed = $false
    }
    
    # Check Node.js
    if (-not (Install-Prerequisite -Name "Node.js (v18+)" -Command "node" -Validator { Test-NodeVersion } -InstallUrl "https://nodejs.org/")) {
        $canProceed = $false
    }
    
    if (-not $canProceed) {
        Write-Error-Message "Please install missing prerequisites and run this script again."
        exit 1
    }
    
    # Check/Install pnpm
    if (-not (Test-CommandExists "pnpm")) {
        if (-not (Install-Pnpm)) {
            Write-Error-Message "pnpm installation failed"
            exit 1
        }
    } else {
        Write-Success "pnpm is already installed"
    }
    
    # Install OpenClaw
    Install-OpenClaw
    
    # Ask about Ollama CE
    if (-not $SkipOllama) {
        Write-Host ""
        $installOllama = $true
        
        if (-not $NonInteractive) {
            $response = Read-Host "Would you like to install Ollama Community Edition? (Y/n)"
            $installOllama = ($response -ne 'n' -and $response -ne 'N')
        }
        
        if ($installOllama) {
            Install-OllamaCE
        } else {
            Write-Host "Skipping Ollama CE installation" -ForegroundColor $ColorInfo
        }
    }
    
    # Initialize configuration
    Initialize-Configuration
    
    # Show next steps
    Show-NextSteps
    
} catch {
    Write-Error-Message "Installation failed: $_"
    Write-Host $_.ScriptStackTrace -ForegroundColor $ColorError
    exit 1
}
