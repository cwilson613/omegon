#!/usr/bin/env python3
"""Agent bundle verification and SBOM generation.

Computes a canonical SHA-256 digest of a bundle directory, generates a
CycloneDX SBOM enumerating the bundle contents, and writes a
verified.json stamp. Designed for CI (verify-bundle.yml).

Usage:
    python3 scripts/bundle_sign.py verify catalog/styrene.infra-engineer/
    python3 scripts/bundle_sign.py sbom   catalog/styrene.infra-engineer/

Subcommands:
    verify  — run content screening + structural validation, exit 1 on failure
    sbom    — generate bundle-sbom.cdx.json + verified.json in the bundle dir
"""

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# ── Screening patterns (must match bundle_verify.rs) ───────────────────

INJECTION_PATTERNS = [
    "ignore previous",
    "ignore all previous",
    "ignore your instructions",
    "disregard your",
    "do not follow your",
    "you are now",
    "new persona",
    "override your",
    "system prompt",
    "reveal your",
    "output your instructions",
    "print your prompt",
    "show me your rules",
    "forget everything",
    "jailbreak",
    "dan mode",
    "developer mode",
    "pretend you",
    "act as if you have no",
    "bypass your",
]

DESTRUCTIVE_PATTERNS = [
    "rm -rf /",
    "rm -rf ~",
    "rm -rf .",
    "drop table",
    "drop database",
    "truncate table",
    "--no-verify",
    "--force push",
    "push --force",
    "reset --hard",
    "chmod 777",
    "chmod -r 777",
    "mkfs.",
    "dd if=",
    "> /dev/sd",
]

EXFILTRATION_PATTERNS = [
    r"curl.*token",
    r"curl.*key",
    r"curl.*secret",
    r"curl.*password",
    r"wget.*token",
    r"wget.*key",
    r"env \| grep",
    r"env \| curl",
    r"printenv \| curl",
    r"printenv \| wget",
    r"cat.*credentials",
    r"cat.*/etc/shadow",
    r"cat.*/etc/passwd",
    r"cat.*id_rsa",
    r"cat.*id_ed25519",
    r"base64.*secret",
    r"base64.*token",
    r"base64.*key",
]

SCREENING_VERSION = "1.0.0"


def compute_bundle_digest(bundle_dir: Path) -> str:
    """Compute SHA-256 over all bundle files in sorted order."""
    h = hashlib.sha256()
    files = sorted(
        p for p in bundle_dir.rglob("*")
        if p.is_file()
        and p.name != "verified.json"
        and p.name != "bundle-sbom.cdx.json"
    )
    for f in files:
        rel = f.relative_to(bundle_dir)
        h.update(str(rel).encode())
        h.update(f.read_bytes())
    return f"sha256:{h.hexdigest()}"


def screen_text(text: str, source: str) -> list[dict]:
    """Screen text for injection, destructive, and exfiltration patterns."""
    findings = []
    lower = text.lower()

    for pat in INJECTION_PATTERNS:
        if pat in lower:
            findings.append({
                "severity": "error",
                "category": "prompt-injection",
                "message": f"contains prompt injection pattern: '{pat}'",
                "location": source,
            })

    for pat in DESTRUCTIVE_PATTERNS:
        if pat in lower:
            findings.append({
                "severity": "error",
                "category": "destructive-command",
                "message": f"contains destructive command pattern: '{pat}'",
                "location": source,
            })

    for pat in EXFILTRATION_PATTERNS:
        if re.search(pat, lower):
            findings.append({
                "severity": "error",
                "category": "secret-exfiltration",
                "message": f"matches exfiltration pattern: '{pat}'",
                "location": source,
            })

    return findings


def verify_bundle(bundle_dir: Path) -> list[dict]:
    """Run all screening checks on a bundle directory."""
    findings = []

    # Load manifest
    manifest_path = bundle_dir / "agent.toml"
    pkl_path = bundle_dir / "agent.pkl"
    if not manifest_path.exists() and not pkl_path.exists():
        findings.append({
            "severity": "error",
            "category": "missing-manifest",
            "message": "no agent.toml or agent.pkl found",
            "location": str(bundle_dir),
        })
        return findings

    # Screen PERSONA.md
    persona_path = bundle_dir / "PERSONA.md"
    if persona_path.exists():
        findings.extend(screen_text(persona_path.read_text(), str(persona_path)))

    # Screen AGENTS.md
    agents_path = bundle_dir / "AGENTS.md"
    if agents_path.exists():
        findings.extend(screen_text(agents_path.read_text(), str(agents_path)))

    # Screen mind facts
    facts_path = bundle_dir / "mind" / "facts.jsonl"
    if facts_path.exists():
        for i, line in enumerate(facts_path.read_text().splitlines(), 1):
            line = line.strip()
            if not line:
                continue
            try:
                json.loads(line)
            except json.JSONDecodeError:
                findings.append({
                    "severity": "error",
                    "category": "invalid-json",
                    "message": f"line {i} is not valid JSON",
                    "location": str(facts_path),
                })
                continue
            findings.extend(screen_text(line, f"{facts_path}:{i}"))

    # Screen trigger templates (from TOML manifest)
    if manifest_path.exists():
        try:
            import tomllib
        except ImportError:
            import tomli as tomllib  # type: ignore[no-redef]

        with open(manifest_path, "rb") as f:
            manifest = tomllib.load(f)

        for trigger in manifest.get("triggers", []):
            template = trigger.get("template", "")
            findings.extend(screen_text(template, f"trigger:{trigger.get('name', '?')}"))

    return findings


def generate_sbom(bundle_dir: Path, manifest: dict) -> dict:
    """Generate a CycloneDX 1.4 SBOM for the bundle."""
    agent = manifest.get("agent", {})
    extensions = manifest.get("extensions", [])
    triggers = manifest.get("triggers", [])

    # Count facts
    facts_path = bundle_dir / "mind" / "facts.jsonl"
    fact_count = 0
    if facts_path.exists():
        fact_count = sum(1 for line in facts_path.read_text().splitlines() if line.strip())

    # Persona directive hash
    persona_hash = ""
    persona_path = bundle_dir / "PERSONA.md"
    if persona_path.exists():
        persona_hash = hashlib.sha256(persona_path.read_bytes()).hexdigest()

    components = []

    # Bundle itself as the main component
    components.append({
        "type": "application",
        "name": agent.get("id", "unknown"),
        "version": agent.get("version", "0.0.0"),
        "description": agent.get("description", ""),
        "properties": [
            {"name": "omegon:domain", "value": agent.get("domain", "")},
            {"name": "omegon:persona-sha256", "value": persona_hash},
            {"name": "omegon:mind-fact-count", "value": str(fact_count)},
            {"name": "omegon:trigger-count", "value": str(len(triggers))},
        ],
    })

    # Extension dependencies
    for ext in extensions:
        components.append({
            "type": "library",
            "name": ext.get("name", "unknown"),
            "version": ext.get("version", "*"),
            "description": f"Extension dependency: {ext.get('name', '')}",
        })

    return {
        "bomFormat": "CycloneDX",
        "specVersion": "1.4",
        "version": 1,
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "tools": [{"name": "omegon-bundle-sign", "version": SCREENING_VERSION}],
            "component": {
                "type": "application",
                "name": agent.get("id", "unknown"),
                "version": agent.get("version", "0.0.0"),
            },
        },
        "components": components,
    }


def cmd_verify(args):
    bundle_dir = Path(args.bundle_dir)
    findings = verify_bundle(bundle_dir)

    errors = [f for f in findings if f["severity"] == "error"]
    warnings = [f for f in findings if f["severity"] == "warning"]

    for w in warnings:
        print(f"  WARNING [{w['category']}] {w['location']}: {w['message']}")
    for e in errors:
        print(f"  ERROR   [{e['category']}] {e['location']}: {e['message']}")

    print(f"\n{len(errors)} error(s), {len(warnings)} warning(s)")

    if errors:
        print("\nBundle FAILED verification.")
        return 1
    print("\nBundle passed verification.")
    return 0


def cmd_sbom(args):
    bundle_dir = Path(args.bundle_dir)

    # Load manifest
    manifest_path = bundle_dir / "agent.toml"
    if not manifest_path.exists():
        print(f"ERROR: {manifest_path} not found", file=sys.stderr)
        return 1

    try:
        import tomllib
    except ImportError:
        import tomli as tomllib  # type: ignore[no-redef]

    with open(manifest_path, "rb") as f:
        manifest = tomllib.load(f)

    # Generate SBOM
    sbom = generate_sbom(bundle_dir, manifest)
    sbom_path = bundle_dir / "bundle-sbom.cdx.json"
    sbom_path.write_text(json.dumps(sbom, indent=2))
    print(f"SBOM written to {sbom_path}")

    # Generate verified.json stamp
    digest = compute_bundle_digest(bundle_dir)
    stamp = {
        "verified_at": datetime.now(timezone.utc).isoformat(),
        "verified_by": os.environ.get(
            "GITHUB_WORKFLOW_REF",
            f"local:{os.environ.get('USER', 'unknown')}",
        ),
        "digest": digest,
        "screening_version": SCREENING_VERSION,
    }
    stamp_path = bundle_dir / "verified.json"
    stamp_path.write_text(json.dumps(stamp, indent=2))
    print(f"Verification stamp written to {stamp_path}")
    print(f"Bundle digest: {digest}")

    return 0


def main():
    parser = argparse.ArgumentParser(description="Agent bundle verification and SBOM")
    sub = parser.add_subparsers(dest="command", required=True)

    p_verify = sub.add_parser("verify", help="Screen bundle content for safety issues")
    p_verify.add_argument("bundle_dir", help="Path to agent bundle directory")

    p_sbom = sub.add_parser("sbom", help="Generate CycloneDX SBOM + verified.json")
    p_sbom.add_argument("bundle_dir", help="Path to agent bundle directory")

    args = parser.parse_args()

    if args.command == "verify":
        sys.exit(cmd_verify(args))
    elif args.command == "sbom":
        sys.exit(cmd_sbom(args))


if __name__ == "__main__":
    main()
