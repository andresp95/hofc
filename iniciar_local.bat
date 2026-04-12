@echo off
setlocal
set "REPO_URL=https://github.com/andresp95/hofc.git"
set "SCRIPT_DIR=%~dp0"
set "REPO_DIR=%SCRIPT_DIR%"

if not exist "%REPO_DIR%launch_local.py" (
  set "REPO_DIR=%SCRIPT_DIR%hofc"
)

where git >nul 2>nul
if %errorlevel% neq 0 (
  echo Git no esta instalado o no esta disponible en PATH.
  echo Instala Git y volve a ejecutar este archivo.
  exit /b 1
)

if not exist "%REPO_DIR%\.git" (
  echo No se detecto una copia local del proyecto.
  echo Clonando repositorio en "%REPO_DIR%"...
  git clone "%REPO_URL%" "%REPO_DIR%"
  if %errorlevel% neq 0 (
    echo No se pudo clonar el repositorio.
    exit /b 1
  )
)

cd /d "%REPO_DIR%"

if not exist "launch_local.py" (
  echo No se encontro launch_local.py en esta carpeta.
  exit /b 1
)

where py >nul 2>nul
if %errorlevel%==0 (
  py -3 launch_local.py
) else (
  python launch_local.py
)
