"""
Bootstrap script: creates a venv and installs requirements.

Designed to be called from Electron during first-run setup:
  python install.py --target <path-to-install-dir>

Progress lines are written to stdout so Electron can show a progress bar:
  PROGRESS:<0-100>:<message>
  DONE
  ERROR:<message>
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def emit(kind: str, value: str) -> None:
    print(f"{kind}:{value}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", required=True, help="Directory where the venv will be created")
    args = parser.parse_args()

    target = Path(args.target)
    venv_dir = target / "venv"
    req_file = Path(__file__).parent / "requirements.txt"

    # Step 1 – create venv
    emit("PROGRESS", "5:Creating Python virtual environment...")
    try:
        subprocess.run(
            [sys.executable, "-m", "venv", str(venv_dir)],
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as exc:
        emit("ERROR", f"venv creation failed: {exc.stderr.strip()}")
        sys.exit(1)

    # Step 2 – determine pip path
    if sys.platform == "win32":
        pip = str(venv_dir / "Scripts" / "pip.exe")
        python_exe = str(venv_dir / "Scripts" / "python.exe")
    else:
        pip = str(venv_dir / "bin" / "pip")
        python_exe = str(venv_dir / "bin" / "python")

    emit("PROGRESS", "10:Upgrading pip...")
    subprocess.run([pip, "install", "--upgrade", "pip"], capture_output=True)

    # Step 3 – install requirements line by line for progress reporting
    requirements = [
        line.strip()
        for line in req_file.read_text().splitlines()
        if line.strip() and not line.startswith("#")
    ]

    total = len(requirements)
    for i, pkg in enumerate(requirements):
        pct = 15 + int((i / total) * 80)
        emit("PROGRESS", f"{pct}:Installing {pkg}...")
        result = subprocess.run(
            [pip, "install", pkg],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            emit("ERROR", f"Failed to install {pkg}: {result.stderr.strip()}")
            sys.exit(1)

    emit("PROGRESS", "98:Verifying installation...")
    verify = subprocess.run(
        [python_exe, "-c", "import faster_whisper; import websockets; import numpy"],
        capture_output=True,
        text=True,
    )
    if verify.returncode != 0:
        emit("ERROR", f"Verification failed: {verify.stderr.strip()}")
        sys.exit(1)

    emit("PROGRESS", "100:Done")
    print("DONE", flush=True)


if __name__ == "__main__":
    main()
