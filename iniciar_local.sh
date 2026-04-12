#!/usr/bin/env sh
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_URL="https://github.com/andresp95/hofc.git"
cd "$SCRIPT_DIR" || exit 1

if [ ! -f "$SCRIPT_DIR/launch_local.py" ]; then
  echo "No se encontró launch_local.py en esta carpeta."
  echo "Primero cloná el proyecto con: git clone $REPO_URL"
  exit 1
fi

if command -v python3 >/dev/null 2>&1; then
  python3 launch_local.py
else
  python launch_local.py
fi
