@echo off
cd /d "%~dp0"
powershell -NoProfile -Command "npm start"
pause
