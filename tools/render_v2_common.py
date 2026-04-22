from __future__ import annotations

import json
import re
import subprocess
import tempfile
from pathlib import Path

import numpy as np


def extract_ship_nicks(data: dict) -> list[str]:
    datasets = data.get("datasets")
    if isinstance(datasets, dict):
        default_key = data.get("default_dataset") or "default"
        snapshot = datasets.get(default_key) or datasets.get("default") or {}
        ships = snapshot.get("ships", [])
    else:
        ships = data.get("ships", [])
    return [ship["nick"] for ship in ships if isinstance(ship, dict) and ship.get("nick")]


def parse_shiparch(game_path: Path) -> dict[str, str]:
    shiparch = game_path / "DATA" / "SHIPS" / "shiparch.ini"
    text = shiparch.read_text(encoding="latin1")
    sections = re.split(r"(?=\[)", text)
    result: dict[str, str] = {}
    for sec in sections:
        if not sec.strip().lower().startswith("[ship]"):
            continue
        nick = ""
        da = ""
        for line in sec.split("\n"):
            kv = line.strip().split("=", 1)
            if len(kv) != 2:
                continue
            key = kv[0].strip().lower()
            value = kv[1].strip()
            if key == "nickname":
                nick = value.lower()
            elif key == "da_archetype":
                da = value
        if nick and da:
            result[nick] = da
    return result


def resolve_case_insensitive(base_path: Path, relative_path: str) -> Path | None:
    candidate = base_path / relative_path.replace("\\", "/")
    if candidate.exists():
        return candidate

    resolved = base_path
    for part in Path(relative_path.replace("\\", "/")).parts:
        if not resolved.is_dir():
            return None
        match = next((item for item in resolved.iterdir() if item.name.lower() == part.lower()), None)
        if match is None:
            return None
        resolved = match
    return resolved if resolved.exists() else None


def find_v2_exporter() -> Path | None:
    root = Path(__file__).resolve().parent.parent.parent / "FLAtlas-V2"
    candidates = [
        root / "build" / "src" / "flatlas_model_screenshot_exporter.exe",
        root / "build" / "src" / "flatlas_model_screenshot_exporter",
        root / "build" / "flatlas_model_screenshot_exporter.exe",
        root / "build" / "flatlas_model_screenshot_exporter",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    matches = list(root.glob("build/**/flatlas_model_screenshot_exporter.exe"))
    return matches[0] if matches else None


def load_v2_triangles(model_path: Path, exporter_path: Path) -> np.ndarray | None:
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as handle:
        json_path = Path(handle.name)

    try:
        result = subprocess.run(
            [str(exporter_path), "--model", str(model_path), "--output", str(json_path)],
            check=False,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            message = result.stderr.strip() or result.stdout.strip() or f"exporter failed with {result.returncode}"
            print(f"    SKIP (V2 export error): {message}")
            return None

        payload = json.loads(json_path.read_text(encoding="utf-8"))
        triangles = np.array(payload.get("triangles", []), dtype=float)
        if triangles.size == 0:
            print("    SKIP (no V2 triangles)")
            return None
        if triangles.ndim != 3 or triangles.shape[1:] != (3, 3):
            print("    SKIP (unexpected V2 triangle shape)")
            return None

        return triangles[:, :, [0, 2, 1]]
    finally:
        json_path.unlink(missing_ok=True)