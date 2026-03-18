#!/usr/bin/env pwsh
#Requires -Version 5.1

<#
.SYNOPSIS
    Stable Diffusion Image Generation Setup Script for Windows
.DESCRIPTION
    Sets up Stable Diffusion with SDXL support for image generation
.NOTES
    Version: 1.0.0
    Author: OpenClaw Community
#>

param(
    [switch]$SkipSDXL,
    [switch]$NonInteractive,
    [string]$InstallPath = "E:\stable-diffusion",
    [string]$PythonVersion = "3.10.11"
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

function Test-PythonVersion {
    if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
        return $false
    }
    
    try {
        $version = python --version 2>&1
        if ($version -match 'Python 3\.10') {
            return $true
        }
    } catch {
        return $false
    }
    
    return $false
}

function Install-Python {
    Write-Header "Installing Python $PythonVersion"
    
    if (Test-PythonVersion) {
        Write-Success "Python 3.10 is already installed"
        return $true
    }
    
    Write-Warning "Python 3.10 is required for Stable Diffusion"
    
    if ($NonInteractive) {
        Write-Error-Message "Cannot install Python in non-interactive mode"
        Write-Host "Please install Python 3.10 from: https://www.python.org/downloads/" -ForegroundColor $ColorInfo
        return $false
    }
    
    $response = Read-Host "Would you like to open the Python download page? (y/N)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        Start-Process "https://www.python.org/downloads/release/python-31011/"
        Write-Host "Please install Python 3.10.11 and run this script again." -ForegroundColor $ColorInfo
        exit 0
    }
    
    return $false
}

function Setup-VirtualEnvironment {
    Write-Header "Setting Up Python Virtual Environment"
    
    Write-Step "Creating virtual environment at: $InstallPath\venv"
    
    if (Test-Path "$InstallPath\venv") {
        Write-Warning "Virtual environment already exists"
        return $true
    }
    
    try {
        New-Item -ItemType Directory -Force -Path $InstallPath | Out-Null
        python -m venv "$InstallPath\venv"
        Write-Success "Virtual environment created"
        return $true
    } catch {
        Write-Error-Message "Failed to create virtual environment: $_"
        return $false
    }
}

function Install-Dependencies {
    Write-Header "Installing Python Dependencies"
    
    Write-Step "Activating virtual environment..."
    
    $venvPath = "$InstallPath\venv\Scripts\Activate.ps1"
    if (-not (Test-Path $venvPath)) {
        Write-Error-Message "Virtual environment not found"
        return $false
    }
    
    & $venvPath
    
    Write-Step "Upgrading pip..."
    python -m pip install --upgrade pip
    
    Write-Step "Installing PyTorch (CPU version)..."
    Write-Warning "This will download ~2GB of data..."
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
    
    Write-Step "Installing Stable Diffusion libraries..."
    pip install diffusers transformers accelerate safetensors
    
    Write-Step "Installing FastAPI and web server..."
    pip install fastapi uvicorn pillow
    
    Write-Success "All dependencies installed"
    return $true
}

function Download-Models {
    Write-Header "Downloading AI Models"
    
    $modelsDir = "$InstallPath\models"
    New-Item -ItemType Directory -Force -Path $modelsDir | Out-Null
    
    Write-Step "Models will be auto-downloaded on first use"
    Write-Host "  • SD 1.5: ~3.97 GB (runwayml/stable-diffusion-v1-5)" -ForegroundColor $ColorInfo
    
    if (-not $SkipSDXL) {
        Write-Host "  • SDXL: ~6.46 GB (stabilityai/stable-diffusion-xl-base-1.0)" -ForegroundColor $ColorInfo
    }
    
    Write-Warning "Models will download automatically when first used by the server"
    Write-Success "Models directory prepared"
}

function Create-ServerScript {
    Write-Header "Creating Server Files"
    
    # Create image_server.py
    Write-Step "Creating image_server.py..."
    
    $serverScript = @'
import os
import time
import uuid
from pathlib import Path
from typing import Optional

import torch
from diffusers import StableDiffusionPipeline, StableDiffusionXLPipeline
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel


class GenerateRequest(BaseModel):
    prompt: str
    negative_prompt: Optional[str] = ""
    num_inference_steps: int = 20
    width: int = 512
    height: int = 512
    seed: Optional[int] = None
    model: str = "sd15"  # sd15 or sdxl


app = FastAPI(title="Stable Diffusion Image Generation API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables
pipe_sd15 = None
pipe_sdxl = None
OUTPUT_DIR = Path(__file__).parent / "outputs"
OUTPUT_DIR.mkdir(exist_ok=True)

# Mount static files
STATIC_DIR = Path(__file__).parent / "static"
STATIC_DIR.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


def load_sd15_model():
    """Load Stable Diffusion 1.5 model"""
    global pipe_sd15
    if pipe_sd15 is None:
        print("Loading SD 1.5 model (this may take a few minutes)...")
        pipe_sd15 = StableDiffusionPipeline.from_pretrained(
            "runwayml/stable-diffusion-v1-5",
            torch_dtype=torch.float32,
            safety_checker=None
        )
        print("SD 1.5 model loaded!")
    return pipe_sd15


def load_sdxl_model():
    """Load SDXL model"""
    global pipe_sdxl
    if pipe_sdxl is None:
        print("Loading SDXL model (this may take a few minutes)...")
        pipe_sdxl = StableDiffusionXLPipeline.from_pretrained(
            "stabilityai/stable-diffusion-xl-base-1.0",
            torch_dtype=torch.float32,
            use_safetensors=True
        )
        print("SDXL model loaded!")
    return pipe_sdxl


@app.get("/")
async def root():
    """Serve the web UI"""
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "models_loaded": {
        "sd15": pipe_sd15 is not None,
        "sdxl": pipe_sdxl is not None
    }}


@app.post("/generate")
async def generate_image(request: GenerateRequest):
    """Generate an image from a text prompt"""
    start_time = time.time()
    
    try:
        # Select model
        if request.model == "sdxl":
            pipe = load_sdxl_model()
            default_size = 1024
        else:
            pipe = load_sd15_model()
            default_size = 512
        
        # Adjust size if using defaults
        width = request.width if request.width != 512 else default_size
        height = request.height if request.height != 512 else default_size
        
        # Set seed if provided
        generator = None
        if request.seed is not None:
            generator = torch.Generator().manual_seed(request.seed)
        
        # Generate image
        print(f"Generating {width}x{height} image with {request.model}: {request.prompt[:50]}...")
        image = pipe(
            prompt=request.prompt,
            negative_prompt=request.negative_prompt,
            num_inference_steps=request.num_inference_steps,
            width=width,
            height=height,
            generator=generator
        ).images[0]
        
        # Save image
        filename = f"{uuid.uuid4().hex}.png"
        filepath = OUTPUT_DIR / filename
        image.save(filepath)
        
        generation_time = time.time() - start_time
        
        return {
            "status": "success",
            "filename": filename,
            "url": f"/image/{filename}",
            "generation_time": round(generation_time, 2),
            "prompt": request.prompt,
            "model": request.model,
            "size": f"{width}x{height}",
            "steps": request.num_inference_steps
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/image/{filename}")
async def get_image(filename: str):
    """Retrieve a generated image"""
    filepath = OUTPUT_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(filepath)


@app.get("/images")
async def list_images():
    """List all generated images"""
    images = [
        {
            "filename": f.name,
            "url": f"/image/{f.name}",
            "created": f.stat().st_mtime
        }
        for f in OUTPUT_DIR.glob("*.png")
    ]
    return {"images": sorted(images, key=lambda x: x["created"], reverse=True)}


if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*60)
    print("  Stable Diffusion Image Generation Server")
    print("="*60)
    print(f"\n  Server: http://localhost:7860")
    print(f"  Web UI: http://localhost:7860/")
    print(f"  API Docs: http://localhost:7860/docs")
    print(f"\n  Output folder: {OUTPUT_DIR}")
    print("\n" + "="*60 + "\n")
    
    uvicorn.run(app, host="0.0.0.0", port=7860)
'@
    
    Set-Content -Path "$InstallPath\image_server.py" -Value $serverScript
    Write-Success "Server script created"
    
    # Create start_server.bat
    Write-Step "Creating start_server.bat..."
    
    $batchScript = @"
@echo off
echo.
echo ================================================================
echo   Starting Stable Diffusion Image Generation Server
echo ================================================================
echo.

cd /d "%~dp0"
call venv\Scripts\activate.bat

echo Starting server on http://localhost:7860
echo Press Ctrl+C to stop the server
echo.

python image_server.py

pause
"@
    
    Set-Content -Path "$InstallPath\start_server.bat" -Value $batchScript
    Write-Success "Batch launcher created"
    
    # Create simple web UI
    Write-Step "Creating web UI..."
    
    $staticDir = "$InstallPath\static"
    New-Item -ItemType Directory -Force -Path $staticDir | Out-Null
    
    $htmlContent = @'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stable Diffusion Image Generator</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: system-ui, -apple-system, sans-serif; background: #0f0f0f; color: #fff; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { margin-bottom: 30px; color: #00d4ff; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 8px; color: #aaa; }
        input, textarea, select { width: 100%; padding: 12px; background: #1a1a1a; border: 1px solid #333; color: #fff; border-radius: 4px; font-size: 14px; }
        textarea { min-height: 100px; font-family: inherit; }
        .row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        button { background: #00d4ff; color: #000; padding: 14px 28px; border: none; border-radius: 4px; font-weight: 600; cursor: pointer; font-size: 16px; }
        button:hover { background: #00b8e6; }
        button:disabled { background: #333; color: #666; cursor: not-allowed; }
        .status { margin-top: 20px; padding: 15px; background: #1a1a1a; border-radius: 4px; border-left: 4px solid #00d4ff; }
        .result { margin-top: 30px; }
        .result img { max-width: 100%; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
        .info { color: #00d4ff; font-size: 14px; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎨 Stable Diffusion Image Generator</h1>
        
        <div class="form-group">
            <label>Model</label>
            <select id="model">
                <option value="sd15">SD 1.5 (Fast - 512x512)</option>
                <option value="sdxl">SDXL (Quality - 1024x1024)</option>
            </select>
        </div>
        
        <div class="form-group">
            <label>Prompt</label>
            <textarea id="prompt" placeholder="a beautiful sunset over mountains, detailed, high quality"></textarea>
        </div>
        
        <div class="form-group">
            <label>Negative Prompt (optional)</label>
            <textarea id="negative_prompt" placeholder="blurry, low quality, distorted"></textarea>
        </div>
        
        <div class="row">
            <div class="form-group">
                <label>Width</label>
                <input type="number" id="width" value="512" step="64">
            </div>
            <div class="form-group">
                <label>Height</label>
                <input type="number" id="height" value="512" step="64">
            </div>
        </div>
        
        <div class="row">
            <div class="form-group">
                <label>Steps (20-50 recommended)</label>
                <input type="number" id="steps" value="20" min="1" max="100">
            </div>
            <div class="form-group">
                <label>Seed (optional, leave blank for random)</label>
                <input type="number" id="seed" placeholder="Random">
            </div>
        </div>
        
        <button onclick="generate()">Generate Image</button>
        
        <div id="status" class="status" style="display:none;"></div>
        <div id="result" class="result"></div>
    </div>
    
    <script>
        const modelSelect = document.getElementById('model');
        const widthInput = document.getElementById('width');
        const heightInput = document.getElementById('height');
        
        modelSelect.addEventListener('change', (e) => {
            if (e.target.value === 'sdxl') {
                widthInput.value = 1024;
                heightInput.value = 1024;
            } else {
                widthInput.value = 512;
                heightInput.value = 512;
            }
        });
        
        async function generate() {
            const prompt = document.getElementById('prompt').value;
            if (!prompt) {
                alert('Please enter a prompt');
                return;
            }
            
            const statusDiv = document.getElementById('status');
            const resultDiv = document.getElementById('result');
            const button = document.querySelector('button');
            
            statusDiv.style.display = 'block';
            statusDiv.textContent = '🎨 Generating image... This may take 5-20 minutes depending on the model.';
            button.disabled = true;
            resultDiv.innerHTML = '';
            
            const seed = document.getElementById('seed').value;
            
            try {
                const response = await fetch('/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: prompt,
                        negative_prompt: document.getElementById('negative_prompt').value,
                        width: parseInt(document.getElementById('width').value),
                        height: parseInt(document.getElementById('height').value),
                        num_inference_steps: parseInt(document.getElementById('steps').value),
                        seed: seed ? parseInt(seed) : null,
                        model: document.getElementById('model').value
                    })
                });
                
                const data = await response.json();
                
                if (data.status === 'success') {
                    statusDiv.textContent = `✓ Image generated in ${data.generation_time}s`;
                    resultDiv.innerHTML = `
                        <img src="${data.url}" alt="Generated image">
                        <div class="info">
                            ${data.model.toUpperCase()} • ${data.size} • ${data.steps} steps • ${data.generation_time}s
                        </div>
                    `;
                } else {
                    statusDiv.textContent = '✗ Generation failed: ' + data.detail;
                }
            } catch (error) {
                statusDiv.textContent = '✗ Error: ' + error.message;
            } finally {
                button.disabled = false;
            }
        }
    </script>
</body>
</html>
'@
    
    Set-Content -Path "$staticDir\index.html" -Value $htmlContent
    Write-Success "Web UI created"
}

function Create-Documentation {
    Write-Header "Creating Documentation"
    
    $readme = @"
# Stable Diffusion Image Generation Server

Local image generation server using Stable Diffusion and SDXL.

## Quick Start

1. Start the server:
   ``````
   start_server.bat
   ``````

2. Open web UI:
   ``````
   http://localhost:7860
   ``````

## Features

- **Dual Models:**
  - SD 1.5: Fast generation (~5-10 min) at 512x512
  - SDXL: High quality (~15-25 min) at 1024x1024

- **Web UI:** Simple interface for text-to-image generation

- **REST API:** Use from OpenClaw or other applications

## API Usage

### Generate Image

``````bash
POST http://localhost:7860/generate
Content-Type: application/json

{
  "prompt": "a beautiful landscape",
  "model": "sd15",
  "width": 512,
  "height": 512,
  "num_inference_steps": 20
}
``````

### Get Image

``````bash
GET http://localhost:7860/image/{filename}
``````

## Using with OpenClaw

Configure OpenClaw to use this service for image generation by pointing to http://localhost:7860

## Output

All generated images are saved to: ``$InstallPath\outputs\``

## Documentation

- Web UI: http://localhost:7860/
- API Docs: http://localhost:7860/docs
- Health Check: http://localhost:7860/health
"@
    
    Set-Content -Path "$InstallPath\README.md" -Value $readme
    Write-Success "Documentation created"
}

function Show-NextSteps {
    Write-Header "Installation Complete!"
    
    Write-Host "Stable Diffusion has been installed to:" -ForegroundColor $ColorSuccess
    Write-Host "  $InstallPath" -ForegroundColor $ColorInfo
    Write-Host ""
    
    Write-Host "Next steps:" -ForegroundColor $ColorHeader
    Write-Host "  1. Start the image generation server:" -ForegroundColor $ColorInfo
    Write-Host "     $InstallPath\start_server.bat" -ForegroundColor $ColorInfo
    Write-Host ""
    Write-Host "  2. Open the web UI:" -ForegroundColor $ColorInfo
    Write-Host "     http://localhost:7860" -ForegroundColor $ColorInfo
    Write-Host ""
    Write-Host "  3. Models will auto-download on first use:" -ForegroundColor $ColorInfo
    Write-Host "     • SD 1.5: ~3.97 GB" -ForegroundColor $ColorInfo
    
    if (-not $SkipSDXL) {
        Write-Host "     • SDXL: ~6.46 GB" -ForegroundColor $ColorInfo
    }
    
    Write-Host ""
    Write-Host "Generated images saved to:" -ForegroundColor $ColorHeader
    Write-Host "  $InstallPath\outputs\" -ForegroundColor $ColorInfo
    Write-Host ""
}

# Main installation flow
try {
    Write-Header "Stable Diffusion Image Generation Setup"
    
    Write-Host "This script will set up Stable Diffusion for local image generation." -ForegroundColor $ColorInfo
    Write-Host ""
    
    # Check Python
    if (-not (Install-Python)) {
        Write-Error-Message "Python installation required"
        exit 1
    }
    
    # Setup virtual environment
    if (-not (Setup-VirtualEnvironment)) {
        Write-Error-Message "Virtual environment setup failed"
        exit 1
    }
    
    # Install dependencies
    if (-not (Install-Dependencies)) {
        Write-Error-Message "Dependency installation failed"
        exit 1
    }
    
    # Download models info
    Download-Models
    
    # Create server files
    Create-ServerScript
    
    # Create documentation
    Create-Documentation
    
    # Show next steps
    Show-NextSteps
    
} catch {
    Write-Error-Message "Installation failed: $_"
    Write-Host $_.ScriptStackTrace -ForegroundColor $ColorError
    exit 1
}
