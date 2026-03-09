@echo off
rem OpenClaw Community Edition Gateway Launcher
title OpenClaw Gateway (Community Edition)

cd /d E:\openclaw

echo.
echo ================================================================================
echo   OpenClaw Community Edition Gateway
echo   Starting on port 18789...
echo ================================================================================
echo.

node dist\index.js gateway --port 18789 --verbose

echo.
echo ================================================================================
echo   Gateway stopped. Exit code: %ERRORLEVEL%
echo   Press any key to close this window...
echo ================================================================================
pause >nul
