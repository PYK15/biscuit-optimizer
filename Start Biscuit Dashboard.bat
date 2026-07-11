@echo off
title Biscuit Cost-Optimization Dashboard
echo Starting the Biscuit Cost-Optimization Dashboard...
echo (First run installs dependencies and can take a few minutes. Later runs are fast.)
echo.
powershell.exe -NoExit -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1"
