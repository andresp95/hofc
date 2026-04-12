from __future__ import annotations

import hashlib
import os
import subprocess
import sys
import threading
import webbrowser
from contextlib import suppress
from pathlib import Path
from shutil import which


BASE_DIR = Path(__file__).resolve().parent
VENV_DIR = BASE_DIR / ".venv"
REQUIREMENTS_FILE = BASE_DIR / "requirements.txt"
HASH_FILE = VENV_DIR / ".requirements.sha256"
APP_URL = "http://127.0.0.1:5000"
DEFAULT_REPO_URL = "https://github.com/andresp95/hofc.git"
TRAY_FLAG = "--tray"


def venv_python() -> Path:
    if os.name == "nt":
        return VENV_DIR / "Scripts" / "python.exe"
    return VENV_DIR / "bin" / "python"


def venv_pythonw() -> Path:
    if os.name == "nt":
        return VENV_DIR / "Scripts" / "pythonw.exe"
    return venv_python()


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


def should_spawn_windows_tray() -> bool:
    return os.name == "nt" and TRAY_FLAG not in sys.argv


def show_windows_message(title: str, message: str) -> None:
    if os.name != "nt":
        print(f"{title}: {message}")
        return

    with suppress(Exception):
        import ctypes

        ctypes.windll.user32.MessageBoxW(None, message, title, 0x10)


def spawn_windows_tray_process() -> int:
    pythonw_path = venv_pythonw()
    if not pythonw_path.exists():
        print("No se encontró pythonw.exe en el entorno virtual. Se inicia en modo consola.")
        return run_console_server()

    creationflags = 0
    detached = getattr(subprocess, "DETACHED_PROCESS", 0)
    new_group = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
    creationflags |= detached | new_group

    try:
        subprocess.Popen(
            [str(pythonw_path), str(BASE_DIR / "launch_local.py"), TRAY_FLAG],
            cwd=BASE_DIR,
            creationflags=creationflags,
            close_fds=True,
        )
    except OSError as exc:
        print(f"No se pudo iniciar el modo bandeja: {exc}")
        print("Se inicia en modo consola.")
        return run_console_server()

    print("La app quedó iniciada en segundo plano, junto al reloj de Windows.")
    return 0


def create_tray_image():
    from PIL import Image

    logo_path = BASE_DIR / "static" / "res" / "logo.png"
    if not logo_path.exists():
        return Image.new("RGBA", (64, 64), (240, 144, 160, 255))

    logo = Image.open(logo_path).convert("RGBA")
    canvas = Image.new("RGBA", (64, 64), (255, 255, 255, 0))
    logo.thumbnail((52, 52))
    offset = ((64 - logo.width) // 2, (64 - logo.height) // 2)
    canvas.paste(logo, offset, logo)
    return canvas


class LocalServer:
    def __init__(self) -> None:
        from app import create_app
        from db import ensure_schema
        from werkzeug.serving import make_server

        ensure_schema()
        app = create_app()
        self._server = make_server("127.0.0.1", 5000, app, threaded=True)
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        self._server.shutdown()
        self._thread.join(timeout=5)


def restart_windows_app() -> None:
    launcher_path = BASE_DIR / "iniciar_local.bat"
    if not launcher_path.exists():
        pythonw_path = venv_pythonw()
        python_path = pythonw_path if pythonw_path.exists() else venv_python()
        subprocess.Popen(
            [str(python_path), str(BASE_DIR / "launch_local.py"), TRAY_FLAG],
            cwd=BASE_DIR,
            creationflags=getattr(subprocess, "DETACHED_PROCESS", 0) | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0),
            close_fds=True,
        )
        return

    startupinfo = None
    if os.name == "nt":
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        startupinfo.wShowWindow = 0

    subprocess.Popen(
        ["cmd.exe", "/c", str(launcher_path)],
        cwd=BASE_DIR,
        creationflags=getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0),
        close_fds=True,
        startupinfo=startupinfo,
    )


def run_windows_tray() -> int:
    try:
        import pystray
    except ImportError as exc:
        show_windows_message(
            "Inicio local",
            "Faltan dependencias para el modo bandeja. Ejecutá iniciar_local.bat otra vez.",
        )
        raise SystemExit(1) from exc

    try:
        server = LocalServer()
        server.start()
    except OSError as exc:
        show_windows_message(
            "Inicio local",
            f"No se pudo iniciar el servidor en {APP_URL}. {exc}",
        )
        return 1

    def open_panel(icon: pystray.Icon, item: object) -> None:
        del icon, item
        webbrowser.open(APP_URL)

    def restart_app(icon: pystray.Icon, item: object) -> None:
        del item
        restart_windows_app()
        icon.stop()

    def stop_app(icon: pystray.Icon, item: object) -> None:
        del item
        icon.stop()

    icon = pystray.Icon(
        "hofc",
        create_tray_image(),
        "House Of Craft",
        menu=pystray.Menu(
            pystray.MenuItem("Abrir panel", open_panel, default=True),
            pystray.MenuItem("Reiniciar", restart_app),
            pystray.MenuItem("Salir", stop_app),
        ),
    )

    try:
        icon.run()
    finally:
        server.stop()
    return 0


def run_console_server() -> int:
    print(f"Iniciando servidor local en {APP_URL}")
    process = subprocess.run([str(venv_python()), str(BASE_DIR / "app.py")], cwd=BASE_DIR)
    return process.returncode


def main() -> int:
    os.chdir(BASE_DIR)
    ensure_latest_code()
    ensure_venv()
    ensure_dependencies()

    if should_spawn_windows_tray():
        return spawn_windows_tray_process()

    if TRAY_FLAG in sys.argv:
        return run_windows_tray()

    return run_console_server()


if __name__ == "__main__":
    raise SystemExit(main())
