@echo off
rem OpenClaw Community Edition Gateway Launcher
title OpenClaw Gateway (Community Edition)

cd /d E:\openclaw

rem Use environment variable for port, default to 18789
if "%OPENCLAW_GATEWAY_PORT%"=="" (
    set OPENCLAW_GATEWAY_PORT=18789
)

echo.
echo ================================================================================
echo   OpenClaw Community Edition Gateway
echo   Starting on port %OPENCLAW_GATEWAY_PORT%...
echo ================================================================================
echo.

node dist\index.js gateway --port %OPENCLAW_GATEWAY_PORT% --verbose

echo.
echo ================================================================================
echo   Gateway stopped. Exit code: %ERRORLEVEL%
echo   Press any key to close this window...
echo ================================================================================
pause >nul
