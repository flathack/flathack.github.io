from __future__ import annotations

import os
import sys
from pathlib import Path

DEFAULT_FL_ROOT = Path("C:/Users/steve/Github/FL-Installationen/Freelancer-HD")
_ENV_KEYS = ("FREELANCER2D_FL_ROOT", "FREELANCER_ROOT", "FL_ROOT")
_DATA_ENV_KEYS = ("FREELANCER2D_FL_DATA_ROOT", "FREELANCER_DATA_ROOT", "FL_DATA_ROOT")
_EXE_ENV_KEYS = ("FREELANCER2D_FL_EXE_ROOT", "FREELANCER_EXE_ROOT", "FL_EXE_ROOT")


def _cli_value(name: str) -> str:
    prefix = name + "="
    for index, arg in enumerate(sys.argv[1:], start=1):
        if arg == name and index + 1 < len(sys.argv):
            return sys.argv[index + 1]
        if arg.startswith(prefix):
            return arg[len(prefix):]
    return ""


def freelancer_root(default: Path = DEFAULT_FL_ROOT) -> Path:
    raw = _cli_value("--fl-root") or _cli_value("--freelancer-root")
    if not raw:
        for key in _ENV_KEYS:
            raw = os.environ.get(key, "")
            if raw:
                break
    root = Path(raw).expanduser() if raw else default
    if root.name.upper() == "DATA":
        root = root.parent
    return root.resolve()


def freelancer_data(default: Path = DEFAULT_FL_ROOT) -> Path:
    raw = _cli_value("--fl-data-root") or _cli_value("--data-root")
    if not raw:
        for key in _DATA_ENV_KEYS:
            raw = os.environ.get(key, "")
            if raw:
                break
    if raw:
        path = Path(raw).expanduser()
        return (path if path.name.upper() == "DATA" else path / "DATA").resolve()
    return freelancer_root(default) / "DATA"


def freelancer_exe(default: Path = DEFAULT_FL_ROOT) -> Path:
    raw = _cli_value("--fl-exe-root") or _cli_value("--exe-root")
    if not raw:
        for key in _EXE_ENV_KEYS:
            raw = os.environ.get(key, "")
            if raw:
                break
    if raw:
        path = Path(raw).expanduser()
        return (path if path.name.upper() == "EXE" else path / "EXE").resolve()
    return freelancer_root(default) / "EXE"


def output_data_dir(default: Path) -> Path:
    raw = _cli_value("--output-dir") or os.environ.get("FREELANCER2D_OUTPUT_DIR", "")
    return (Path(raw).expanduser() if raw else default).resolve()


def fl_path_info() -> str:
    root = freelancer_root()
    return f"Freelancer root: {root}"
