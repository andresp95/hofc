#!/usr/bin/env sh
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_URL="https://github.com/andresp95/hofc.git"
REPO_DIR="$SCRIPT_DIR"

if [ ! -f "$REPO_DIR/launch_local.py" ]; then
  REPO_DIR="$SCRIPT_DIR/hofc"
fi

if ! command -v git >/dev/null 2>&1; then
  echo "Git no está instalado o no está disponible en PATH."
  echo "Instalá Git y volvé a ejecutar este archivo."
  exit 1
fi

if [ ! -d "$REPO_DIR/.git" ]; then
  echo "No se detectó una copia local del proyecto."
  echo "Clonando repositorio en '$REPO_DIR'..."
  git clone "$REPO_URL" "$REPO_DIR" || exit 1
fi

cd "$REPO_DIR" || exit 1

if [ ! -f "$REPO_DIR/launch_local.py" ]; then
  echo "No se encontró launch_local.py en esta carpeta."
  exit 1
fi

if command -v python3 >/dev/null 2>&1; then
  python3 launch_local.py
else
  python launch_local.py
fi
