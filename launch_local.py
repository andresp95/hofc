from __future__ import annotations

import hashlib
import os
import subprocess
import sys
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
VENV_DIR = BASE_DIR / ".venv"
REQUIREMENTS_FILE = BASE_DIR / "requirements.txt"
HASH_FILE = VENV_DIR / ".requirements.sha256"
APP_URL = "http://127.0.0.1:5000"


def venv_python() -> Path:
    if os.name == "nt":
        return VENV_DIR / "Scripts" / "python.exe"
    return VENV_DIR / "bin" / "python"


def ensure_venv() -> None:
    python_path = venv_python()
    if python_path.exists():
        return

    print("Creando entorno virtual local...")
    subprocess.check_call([sys.executable, "-m", "venv", str(VENV_DIR)])


def requirements_hash() -> str:
    return hashlib.sha256(REQUIREMENTS_FILE.read_bytes()).hexdigest()


def ensure_dependencies() -> None:
    python_path = venv_python()
    current_hash = requirements_hash()
    saved_hash = HASH_FILE.read_text(encoding="utf-8").strip() if HASH_FILE.exists() else ""

    if saved_hash == current_hash:
        return

    print("Instalando dependencias en el entorno virtual...")
    subprocess.check_call([str(python_path), "-m", "pip", "install", "--upgrade", "pip"])
    subprocess.check_call([str(python_path), "-m", "pip", "install", "-r", str(REQUIREMENTS_FILE)])
    HASH_FILE.write_text(current_hash, encoding="utf-8")


def main() -> int:
    os.chdir(BASE_DIR)
    ensure_venv()
    ensure_dependencies()

    print(f"Iniciando servidor local en {APP_URL}")

    process = subprocess.run([str(venv_python()), str(BASE_DIR / "app.py")], cwd=BASE_DIR)
    return process.returncode


if __name__ == "__main__":
    raise SystemExit(main())
