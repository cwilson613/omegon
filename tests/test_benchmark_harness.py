import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "benchmark_harness.py"


class BenchmarkHarnessTests(unittest.TestCase):
    def write_task(self, repo: Path, content: str) -> Path:
        task = repo / "task.yaml"
        task.write_text(content)
        return task

    def run_script(self, *args: str, cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["python3", str(SCRIPT), *args],
            cwd=cwd or ROOT,
            check=False,
            capture_output=True,
            text=True,
        )

    def init_repo(self, repo: Path) -> None:
        (repo / "ai" / "benchmarks" / "tasks").mkdir(parents=True, exist_ok=True)
        (repo / "scripts").mkdir(parents=True, exist_ok=True)
        (repo / "core").mkdir(parents=True, exist_ok=True)
        (repo / "core" / "Cargo.toml").write_text("[workspace]\n")

    def test_rejects_missing_required_fields(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            repo = Path(tmpdir)
            self.init_repo(repo)
            task = self.write_task(repo, "id: broken\nrepo: .\n")
            result = self.run_script(str(task), "--root", str(repo))
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("missing required fields", result.stderr)

    def test_rejects_unknown_harness(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            repo = Path(tmpdir)
            self.init_repo(repo)
            task = self.write_task(
                repo,
                """
id: t1
repo: .
base_ref: main
prompt: hi
harnesses: [bogus]
acceptance: [echo ok]
""",
            )
            result = self.run_script(str(task), "--root", str(repo))
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("unsupported harness", result.stderr)

    def test_declared_but_unimplemented_harness_fails_closed(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            repo = Path(tmpdir)
            self.init_repo(repo)
            task = self.write_task(
                repo,
                """
id: t2
repo: .
base_ref: main
prompt: hi
harnesses: [claude-code]
acceptance: [echo ok]
""",
            )
            result = self.run_script(str(task), "--root", str(repo), "--harness", "claude-code")
            self.assertEqual(result.returncode, 2)
            self.assertIn("not implemented in v1", result.stderr)

    def test_writes_result_for_mocked_omegon_run(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            repo = Path(tmpdir)
            self.init_repo(repo)
            fake_cargo = repo / "scripts" / "cargo"
            fake_cargo.write_text(
                "#!/bin/sh\n"
                "usage_json=''\n"
                "prev=''\n"
                "for arg in \"$@\"; do\n"
                "  if [ \"$prev\" = \"--usage-json\" ]; then usage_json=\"$arg\"; fi\n"
                "  prev=\"$arg\"\n"
                "done\n"
                "if [ -n \"$usage_json\" ]; then\n"
                "  cat > \"$usage_json\" <<'JSON'\n"
                '{"input_tokens": 1200, "output_tokens": 300, "cache_tokens": 0, "extra": {"context": {"sys": 100, "tools": 50}}}\n'
                "JSON\n"
                "fi\n"
                "echo fake omegon run\n"
                "exit 0\n"
            )
            fake_cargo.chmod(0o755)
            task = self.write_task(
                repo,
                """
id: t3
repo: .
base_ref: main
prompt: hi
harnesses: [omegon]
acceptance:
  - python3 -c \"print('ok')\"
""",
            )
            env = dict(os.environ)
            env["PATH"] = f"{repo / 'scripts'}:{env['PATH']}"
            result = subprocess.run(
                ["python3", str(SCRIPT), str(task), "--root", str(repo)],
                cwd=ROOT,
                check=False,
                capture_output=True,
                text=True,
                env=env,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            result_path = Path(result.stdout.strip())
            payload = json.loads(result_path.read_text())
            self.assertEqual(payload["status"], "pass")
            self.assertEqual(payload["tokens"]["total"], 1500)
            self.assertEqual(payload["harness"], "omegon")
            self.assertEqual(payload["extra"]["context"]["sys"], 100)


if __name__ == "__main__":
    unittest.main()
