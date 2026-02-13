from __future__ import annotations

import subprocess
import sys
import os
from pathlib import Path


def parse_frcm_output(output: str) -> list[dict[str, float | str]]:
    lines = [line.strip() for line in output.splitlines() if line.strip()]
    try:
        header_index = lines.index("timestamp,ttf")
    except ValueError as exc:
        raise ValueError(
            "Could not find 'timestamp,ttf' header in FRCM output."
        ) from exc

    rows: list[dict[str, float | str]] = []
    for line in lines[header_index + 1 :]:
        timestamp, separator, ttf_text = line.partition(",")
        if separator != ",":
            continue
        rows.append({"timestamp": timestamp, "ttf": float(ttf_text)})

    if not rows:
        raise ValueError("FRCM output did not contain any data rows.")
    return rows


def run_frcm_baseline(csv_path: str) -> list[dict[str, float | str]]:
    project_root = Path(__file__).resolve().parents[2]
    submodule_root = project_root / "third_party" / "dynamic-frcm-simple"
    script_path = submodule_root / "src" / "frcm" / "__main__.py"

    if not script_path.exists():
        raise FileNotFoundError(f"FRCM script not found: {script_path}")

    input_csv = Path(csv_path).expanduser().resolve()
    if not input_csv.exists():
        raise FileNotFoundError(f"CSV input file not found: {input_csv}")

    env = dict(os.environ)
    src_path = str(submodule_root / "src")
    current_pythonpath = env.get("PYTHONPATH", "")
    env["PYTHONPATH"] = (
        src_path if not current_pythonpath else f"{src_path}{os.pathsep}{current_pythonpath}"
    )

    command = [str(sys.executable), str(script_path), str(input_csv)]

    try:
        completed = subprocess.run(
            command,
            cwd=submodule_root,
            capture_output=True,
            text=True,
            check=True,
            env=env,
        )
    except subprocess.CalledProcessError as exc:
        stderr = exc.stderr.strip() if exc.stderr else "(no stderr)"
        stdout = exc.stdout.strip() if exc.stdout else "(no stdout)"
        raise RuntimeError(
            "FRCM execution failed.\n"
            f"Command: {' '.join(command)}\n"
            f"STDOUT: {stdout}\n"
            f"STDERR: {stderr}"
        ) from exc

    return parse_frcm_output(completed.stdout)


def main(argv: list[str] | None = None) -> int:
    args = argv if argv is not None else sys.argv[1:]
    if len(args) != 1:
        print("Usage: python -m fireguard.frcm_adapter <path_to_csv>")
        return 1

    try:
        rows = run_frcm_baseline(args[0])
    except Exception as exc:
        print(f"Error: {exc}")
        return 1

    print(f"Parsed rows: {len(rows)}")
    print("First 3 rows:")
    for row in rows[:3]:
        print(row)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
