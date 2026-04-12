@echo off
setlocal
set "REPO_URL=https://github.com/andresp95/hofc.git"
cd /d "%~dp0"

if not exist "launch_local.py" (
  echo No se encontro launch_local.py en esta carpeta.
  echo Primero clona el proyecto con: git clone %REPO_URL%
  exit /b 1
)

where py >nul 2>nul
if %errorlevel%==0 (
  py -3 launch_local.py
) else (
  python launch_local.py
)
