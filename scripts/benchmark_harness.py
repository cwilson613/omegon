#!/usr/bin/env python3
"""Lightweight token-efficiency comparison harness (Phase 1).

This runner stays deliberately small:
- loads a task spec
- validates declared harnesses
- runs a single adapter (default: first harness in the task)
- executes deterministic acceptance commands
- writes a JSON result artifact

Only the Omegon adapter is implemented in v1.
Claude Code and default pi are declared targets but intentionally fail closed until
we add their runner surfaces.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import yaml

SUPPORTED_HARNESSES = {"omegon", "claude-code", "pi"}
IMPLEMENTED_HARNESSES = {"omegon"}


class TaskSpecError(ValueError):
    pass


@dataclass
class TaskSpec:
    id: str
    repo: str
    base_ref: str
    prompt: str
    acceptance: list[str]
    harnesses: list[str]
    success_files: list[str]
    budget: dict[str, Any]
    notes: str | None = None


@dataclass
class AdapterResult:
    model: str | None
    usage: dict[str, Any]
    extra: dict[str, Any]
    log_path: Path | None = None
    patch_path: Path | None = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run a benchmark task through one harness")
    parser.add_argument("task", help="Path to task YAML")
    parser.add_argument("--root", default=".", help="Repo root for relative task paths")
    parser.add_argument("--harness", help="Harness to run; defaults to first declared harness")
    parser.add_argument("--model", help="Optional model override for implemented adapters")
    parser.add_argument(
        "--out-dir",
        help="Directory for JSON result artifacts (default: <root>/ai/benchmarks/runs)",
    )
    return parser.parse_args()


def load_task_spec(path: Path) -> TaskSpec:
    raw = yaml.safe_load(path.read_text())
    if not isinstance(raw, dict):
        raise TaskSpecError("task file must contain a YAML object")

    required = ["id", "repo", "base_ref", "prompt", "acceptance"]
    missing = [key for key in required if key not in raw]
    if missing:
        raise TaskSpecError(f"missing required fields: {', '.join(missing)}")

    harnesses = raw.get("harnesses") or ["omegon"]
    if not isinstance(harnesses, list) or not all(isinstance(v, str) for v in harnesses):
        raise TaskSpecError("harnesses must be a list of strings")
    for harness in harnesses:
        if harness not in SUPPORTED_HARNESSES:
            raise TaskSpecError(f"unsupported harness: {harness}")

    acceptance = raw["acceptance"]
    if not isinstance(acceptance, list) or not acceptance or not all(isinstance(v, str) for v in acceptance):
        raise TaskSpecError("acceptance must be a non-empty list of shell commands")

    return TaskSpec(
        id=str(raw["id"]),
        repo=str(raw["repo"]),
        base_ref=str(raw["base_ref"]),
        prompt=str(raw["prompt"]),
        acceptance=acceptance,
        harnesses=harnesses,
        success_files=[str(v) for v in raw.get("success_files", [])],
        budget=raw.get("budget") or {},
        notes=str(raw["notes"]) if raw.get("notes") is not None else None,
    )


def resolve_repo_path(root: Path, spec: TaskSpec) -> Path:
    repo_path = Path(spec.repo)
    if not repo_path.is_absolute():
        repo_path = (root / repo_path).resolve()
    return repo_path


def ensure_clean_out_dir(root: Path, out_dir: str | None) -> Path:
    path = Path(out_dir).resolve() if out_dir else (root / "ai" / "benchmarks" / "runs").resolve()
    path.mkdir(parents=True, exist_ok=True)
    return path


def select_harness(spec: TaskSpec, explicit: str | None) -> str:
    harness = explicit or spec.harnesses[0]
    if harness not in spec.harnesses:
        raise TaskSpecError(f"harness '{harness}' not declared in task harnesses")
    if harness not in IMPLEMENTED_HARNESSES:
        raise NotImplementedError(f"harness '{harness}' is declared but not implemented in v1")
    return harness


def run_omegon(spec: TaskSpec, repo_path: Path, *, model: str | None) -> AdapterResult:
    usage_file = Path(tempfile.NamedTemporaryFile(prefix="benchmark-usage-", suffix=".json", delete=False).name)
    log_file = Path(tempfile.NamedTemporaryFile(prefix="benchmark-omegon-", suffix=".log", delete=False).name)
    cmd = [
        "cargo",
        "run",
        "--manifest-path",
        str((repo_path / "core" / "Cargo.toml").resolve()),
        "-p",
        "omegon",
        "--",
        "bench",
        "run-task",
        "--prompt",
        spec.prompt,
        "--usage-json",
        str(usage_file),
    ]
    if model:
        cmd.extend(["--model", model])

    # v1 contract: if the CLI surface doesn't exist yet, operators can replace `cargo`
    # in PATH with a fixture binary/script during tests. Real implementation wiring comes next.
    with log_file.open("w") as handle:
        proc = subprocess.run(cmd, cwd=repo_path, check=False, stdout=handle, stderr=subprocess.STDOUT, text=True)

    usage: dict[str, Any] = {}
    if usage_file.exists():
        try:
            usage = json.loads(usage_file.read_text())
        except json.JSONDecodeError:
            usage = {"raw_usage_error": "invalid json"}
    usage.setdefault("input_tokens", None)
    usage.setdefault("output_tokens", None)
    usage.setdefault("cache_tokens", None)
    usage["exit_code"] = proc.returncode

    return AdapterResult(
        model=model or usage.get("model") or "omegon-default",
        usage=usage,
        extra=usage.get("extra", {}),
        log_path=log_file,
        patch_path=None,
    )


def run_acceptance(commands: list[str], repo_path: Path) -> tuple[str, float, list[dict[str, Any]]]:
    started = time.monotonic()
    results: list[dict[str, Any]] = []
    status = "pass"
    for cmd in commands:
        proc = subprocess.run(cmd, cwd=repo_path, shell=True, check=False, capture_output=True, text=True)
        results.append(
            {
                "cmd": cmd,
                "exit": proc.returncode,
                "stdout": proc.stdout,
                "stderr": proc.stderr,
            }
        )
        if proc.returncode != 0:
            status = "fail"
            break
    return status, time.monotonic() - started, results


def compute_total_tokens(usage: dict[str, Any]) -> int | None:
    values = [usage.get("input_tokens"), usage.get("output_tokens"), usage.get("cache_tokens")]
    if all(v is None for v in values):
        return None
    return int(sum(v or 0 for v in values))


def build_result(
    *,
    spec: TaskSpec,
    harness: str,
    adapter: AdapterResult,
    acceptance_status: str,
    acceptance_results: list[dict[str, Any]],
    wall_clock_sec: float,
) -> dict[str, Any]:
    total_tokens = compute_total_tokens(adapter.usage)
    return {
        "task_id": spec.id,
        "harness": harness,
        "model": adapter.model,
        "status": acceptance_status,
        "score": 1.0 if acceptance_status == "pass" else 0.0,
        "wall_clock_sec": round(wall_clock_sec, 3),
        "attempts": 1,
        "tokens": {
            "input": adapter.usage.get("input_tokens"),
            "output": adapter.usage.get("output_tokens"),
            "cache": adapter.usage.get("cache_tokens"),
            "total": total_tokens,
        },
        "acceptance": {
            "commands": acceptance_results,
        },
        "artifact_paths": {
            "patch": str(adapter.patch_path) if adapter.patch_path else None,
            "log": str(adapter.log_path) if adapter.log_path else None,
        },
        "extra": adapter.extra,
    }


def write_result(out_dir: Path, spec: TaskSpec, harness: str, payload: dict[str, Any]) -> Path:
    timestamp = datetime.now(UTC).strftime("%Y-%m-%dT%H-%M-%SZ")
    out_path = out_dir / f"{timestamp}-{spec.id}-{harness}.json"
    out_path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")
    return out_path


def main() -> int:
    args = parse_args()
    root = Path(args.root).resolve()
    task_path = Path(args.task).resolve()

    try:
        spec = load_task_spec(task_path)
        harness = select_harness(spec, args.harness)
    except TaskSpecError as err:
        print(str(err), file=sys.stderr)
        return 1
    except NotImplementedError as err:
        print(str(err), file=sys.stderr)
        return 2

    repo_path = resolve_repo_path(root, spec)
    out_dir = ensure_clean_out_dir(root, args.out_dir)

    run_started = time.monotonic()
    if harness == "omegon":
        adapter = run_omegon(spec, repo_path, model=args.model)
    else:
        print(f"harness '{harness}' is not implemented", file=sys.stderr)
        return 2

    acceptance_status, acceptance_elapsed, acceptance_results = run_acceptance(spec.acceptance, repo_path)
    payload = build_result(
        spec=spec,
        harness=harness,
        adapter=adapter,
        acceptance_status=acceptance_status,
        acceptance_results=acceptance_results,
        wall_clock_sec=time.monotonic() - run_started,
    )
    payload.setdefault("timing", {})
    payload["timing"] = {"acceptance_wall_clock_sec": round(acceptance_elapsed, 3)}
    result_path = write_result(out_dir, spec, harness, payload)
    print(result_path)
    return 0 if acceptance_status == "pass" else 3


if __name__ == "__main__":
    raise SystemExit(main())
