#!/usr/bin/env python3
"""Summarize provider drift runs into a deterministic issue payload."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any

FAILED_TEST_RE = re.compile(r"^test\s+([^\s]+)\s+\.\.\.\s+FAILED$", re.MULTILINE)
PANIC_RE = re.compile(r"^thread '([^']+)' panicked at (.+)$", re.MULTILINE)
ERROR_RE = re.compile(r"^(Error:\s+.+|assertion failed:.+)$", re.MULTILINE)
FAILURES_BLOCK_RE = re.compile(r"^failures:\n(?P<body>(?:\s{4}.+\n)+)", re.MULTILINE)

TRANSIENT_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"timed? out",
        r"timeout",
        r"connection reset",
        r"connection refused",
        r"temporary failure",
        r"server error",
        r"bad gateway",
        r"gateway timeout",
        r"service unavailable",
        r"dns",
        r"network is unreachable",
        r"transport error",
        r"5\\d\\d",
    ]
]
AUTH_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"401",
        r"403",
        r"unauthoriz",
        r"forbidden",
        r"invalid api key",
        r"authentication",
        r"permission denied",
        r"quota",
        r"rate limit",
        r"billing",
        r"insufficient credits",
        r"account inactive",
    ]
]


def parse_failures(log_text: str) -> dict[str, list[str]]:
    failed_tests: list[str] = []
    block = FAILURES_BLOCK_RE.search(log_text)
    if block:
        failed_tests.extend(line.strip() for line in block.group("body").splitlines() if line.strip())
    failed_tests.extend(FAILED_TEST_RE.findall(log_text))
    failed_tests = sorted(set(failed_tests))

    snippets: list[str] = []
    snippets.extend(f"panic in {name}: {detail.strip()}" for name, detail in PANIC_RE.findall(log_text))
    snippets.extend(match.strip() for match in ERROR_RE.findall(log_text))
    snippets = [line for line in snippets if line]

    return {"failed_tests": failed_tests, "snippets": snippets[:8]}


def classify_failure(snippets: list[str]) -> str:
    haystack = "\n".join(snippets)
    if any(pattern.search(haystack) for pattern in AUTH_PATTERNS):
        return "auth_or_quota"
    if any(pattern.search(haystack) for pattern in TRANSIENT_PATTERNS):
        return "transient"
    return "likely_drift"


def classification_summary(classification: str) -> str:
    return {
        "clean": "clean",
        "transient": "transient provider/runtime failure",
        "auth_or_quota": "credential / quota / billing failure",
        "likely_drift": "likely provider behavior drift",
    }[classification]


def classification_guidance(classification: str) -> list[str]:
    if classification == "transient":
        return [
            "1. Inspect the uploaded `provider-drift-report` artifact for the full smoke log and summary.",
            "2. Confirm whether the failure was a transient provider/network event before changing code or baselines.",
            "3. Only treat this as drift if the same failure shape persists across reruns.",
        ]
    if classification == "auth_or_quota":
        return [
            "1. Inspect the uploaded `provider-drift-report` artifact for the full smoke log and summary.",
            "2. Verify the dedicated drift credentials, quota ceilings, and billing state before changing code.",
            "3. Reclassify as drift only if credentials are healthy and the provider still rejects the expected contract.",
        ]
    if classification == "likely_drift":
        return [
            "1. Inspect the uploaded `provider-drift-report` artifact for the full smoke log and summary.",
            "2. Confirm the upstream behavior change against the checked-in expectation matrix / live smoke assertions.",
            "3. Update the runtime matrix or provider implementation only after the change is understood.",
        ]
    return ["1. No action required."]


def build_fingerprint(failed_tests: list[str], snippets: list[str], classification: str) -> str:
    material = "\n".join([classification, *failed_tests, *snippets[:3]])
    return hashlib.sha256(material.encode("utf-8")).hexdigest()[:12]


def build_issue_payload(*, log_path: Path, repo: str, run_id: str, sha: str, event_name: str) -> dict[str, Any]:
    log_text = log_path.read_text() if log_path.exists() else ""
    parsed = parse_failures(log_text)
    failed_tests = parsed["failed_tests"]
    snippets = parsed["snippets"]
    classification = classify_failure(snippets) if failed_tests else "clean"
    drift_detected = classification == "likely_drift"
    fingerprint = build_fingerprint(failed_tests, snippets, classification) if failed_tests else "clean"
    run_url = f"https://github.com/{repo}/actions/runs/{run_id}" if repo and run_id else ""
    short_sha = sha[:12] if sha else "unknown"

    summary_lines = [
        "## Provider drift run",
        "",
        f"- Event: `{event_name or 'unknown'}`",
        f"- Commit: `{short_sha}`",
        f"- Classification: `{classification_summary(classification)}`",
        f"- Drift detected: `{'yes' if drift_detected else 'no'}`",
    ]
    if run_url:
        summary_lines.append(f"- Run: {run_url}")
    if failed_tests:
        summary_lines.extend(["", "### Failing checks", *[f"- `{name}`" for name in failed_tests]])
    if snippets:
        summary_lines.extend(["", "### Failure excerpts", "```text", *snippets, "```"])

    title_prefix = {
        "transient": "Provider smoke transient failure",
        "auth_or_quota": "Provider smoke credential/quota failure",
        "likely_drift": "Provider API drift detected",
        "clean": "Provider drift run clean",
    }[classification]
    body_lines = [
        f"<!-- provider-drift-fingerprint: {fingerprint} -->",
        f"# {title_prefix}",
        "",
        "The daily live upstream verification workflow found a failure shape that needs triage.",
        "",
        f"- Commit: `{short_sha}`",
        f"- Workflow run: {run_url or 'n/a'}",
        f"- Classification: `{classification_summary(classification)}`",
        "",
        "## Failing checks",
        *([f"- `{name}`" for name in failed_tests] if failed_tests else ["- none captured"]),
    ]
    if snippets:
        body_lines.extend(["", "## Failure excerpts", "```text", *snippets, "```"])
    body_lines.extend(["", "## Triage", *classification_guidance(classification)])

    return {
        "classification": classification,
        "drift_detected": drift_detected,
        "fingerprint": fingerprint,
        "title": f"{title_prefix} ({fingerprint})",
        "body": "\n".join(body_lines) + "\n",
        "summary": "\n".join(summary_lines) + "\n",
        "failed_tests": failed_tests,
        "snippets": snippets,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--log", type=Path, required=True)
    parser.add_argument("--repo", default="")
    parser.add_argument("--run-id", default="")
    parser.add_argument("--sha", default="")
    parser.add_argument("--event-name", default="")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    payload = build_issue_payload(
        log_path=args.log,
        repo=args.repo,
        run_id=args.run_id,
        sha=args.sha,
        event_name=args.event_name,
    )
    rendered = json.dumps(payload, indent=2)
    if args.output:
        args.output.write_text(rendered + "\n")
    else:
        print(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
