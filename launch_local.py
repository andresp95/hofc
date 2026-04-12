from __future__ import annotations

import hashlib
import os
import subprocess
import sys
from pathlib import Path
from shutil import which


BASE_DIR = Path(__file__).resolve().parent
VENV_DIR = BASE_DIR / ".venv"
REQUIREMENTS_FILE = BASE_DIR / "requirements.txt"
HASH_FILE = VENV_DIR / ".requirements.sha256"
APP_URL = "http://127.0.0.1:5000"
DEFAULT_REPO_URL = "https://github.com/andresp95/hofc.git"


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


def git_executable() -> str | None:
    return which("git")


def repo_url() -> str:
    git_path = git_executable()
    if not git_path or not (BASE_DIR / ".git").exists():
        return DEFAULT_REPO_URL

    result = subprocess.run(
        [git_path, "remote", "get-url", "origin"],
        cwd=BASE_DIR,
        text=True,
        capture_output=True,
        check=False,
    )
    return result.stdout.strip() or DEFAULT_REPO_URL


def current_branch(git_path: str) -> str | None:
    result = subprocess.run(
        [git_path, "rev-parse", "--abbrev-ref", "HEAD"],
        cwd=BASE_DIR,
        text=True,
        capture_output=True,
        check=False,
    )
    branch = result.stdout.strip()
    if result.returncode != 0 or not branch or branch == "HEAD":
        return None
    return branch


def has_tracked_changes(git_path: str) -> bool:
    result = subprocess.run(
        [git_path, "status", "--porcelain", "--untracked-files=no"],
        cwd=BASE_DIR,
        text=True,
        capture_output=True,
        check=False,
    )
    return bool(result.stdout.strip())


def ensure_latest_code() -> None:
    git_path = git_executable()
    if not git_path:
        print("Git no está instalado. Se omite la actualización automática del repositorio.")
        return

    git_dir = BASE_DIR / ".git"
    if not git_dir.exists():
        print("No se detectó un repositorio Git en esta carpeta.")
        print(f"En una PC nueva, primero cloná el proyecto con: git clone {repo_url()}")
        print("Se continúa sin actualización automática.")
        return

    branch = current_branch(git_path)
    if branch is None:
        print("No se pudo detectar la rama actual. Se omite la actualización automática.")
        return

    if has_tracked_changes(git_path):
        print("Hay cambios locales sin guardar en Git. Se omite el git pull automático.")
        return

    print(f"Buscando actualizaciones en Git para la rama {branch}...")

    fetch_result = subprocess.run(
        [git_path, "fetch", "origin", branch],
        cwd=BASE_DIR,
        text=True,
        capture_output=True,
        check=False,
    )
    if fetch_result.returncode != 0:
        print("No se pudo consultar el remoto. Se continúa con la copia local.")
        return

    compare_result = subprocess.run(
        [git_path, "rev-list", "--left-right", "--count", f"{branch}...origin/{branch}"],
        cwd=BASE_DIR,
        text=True,
        capture_output=True,
        check=False,
    )
    if compare_result.returncode != 0:
        print("No se pudo comparar la rama local con el remoto. Se continúa con la copia local.")
        return

    ahead_str, behind_str = compare_result.stdout.strip().split()
    ahead = int(ahead_str)
    behind = int(behind_str)

    if behind == 0:
        if ahead > 0:
            print("La copia local tiene commits propios sin subir. No se hace pull automático.")
        else:
            print("El repositorio local ya está actualizado.")
        return

    if ahead > 0:
        print("La rama local y la remota divergen. Resolvé ese estado manualmente antes de actualizar.")
        return

    print("Actualizando copia local desde Git...")
    subprocess.check_call([git_path, "pull", "--ff-only", "origin", branch], cwd=BASE_DIR)


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
    ensure_latest_code()
    ensure_venv()
    ensure_dependencies()

    print(f"Iniciando servidor local en {APP_URL}")

    process = subprocess.run([str(venv_python()), str(BASE_DIR / "app.py")], cwd=BASE_DIR)
    return process.returncode


if __name__ == "__main__":
    raise SystemExit(main())
