#!/usr/bin/env pwsh
#Requires -Version 5.1

<#
.SYNOPSIS
    Build and push OpenClaw CE Docker image
.DESCRIPTION
    Builds Docker image and optionally pushes to Docker Hub
.PARAMETER Push
    Push to Docker Hub after building
.PARAMETER Tag
    Custom tag (default: latest and version from package.json)
#>

param(
    [switch]$Push,
    [string]$Tag = "latest",
    [string]$DockerHubUser = "ssfdre38",
    [string]$ImageName = "openclawce"
)

$ErrorActionPreference = "Stop"

# Read version from package.json
$packageJson = Get-Content -Path ".\package.json" | ConvertFrom-Json
$version = $packageJson.version

Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Building OpenClaw CE Docker Image" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Version: $version" -ForegroundColor Green
Write-Host "Tag: $Tag" -ForegroundColor Green
Write-Host ""

# Build the image
Write-Host "▶ Building Docker image..." -ForegroundColor White
docker build `
    -t "$DockerHubUser/${ImageName}:$version" `
    -t "$DockerHubUser/${ImageName}:$Tag" `
    .

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Build failed" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Build successful" -ForegroundColor Green
Write-Host ""

# List images
docker images "$DockerHubUser/$ImageName"

if ($Push) {
    Write-Host ""
    Write-Host "▶ Pushing to Docker Hub..." -ForegroundColor White
    
    # Push version tag
    docker push "$DockerHubUser/${ImageName}:$version"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Push failed for version tag" -ForegroundColor Red
        exit 1
    }
    
    # Push custom tag (e.g., latest)
    docker push "$DockerHubUser/${ImageName}:$Tag"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Push failed for $Tag tag" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✓ Pushed to Docker Hub" -ForegroundColor Green
    Write-Host ""
    Write-Host "Images available at:" -ForegroundColor Cyan
    Write-Host "  docker pull $DockerHubUser/${ImageName}:$version" -ForegroundColor White
    Write-Host "  docker pull $DockerHubUser/${ImageName}:$Tag" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "To push to Docker Hub, run:" -ForegroundColor Yellow
    Write-Host "  .\scripts\build-docker.ps1 -Push" -ForegroundColor White
}

Write-Host ""
Write-Host "To test locally:" -ForegroundColor Cyan
Write-Host "  docker run -d -p 18789:18789 $DockerHubUser/${ImageName}:$Tag" -ForegroundColor White
Write-Host ""
