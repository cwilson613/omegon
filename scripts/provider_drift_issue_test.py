#!/usr/bin/env python3

from pathlib import Path
import tempfile
import unittest

from provider_drift_issue import build_issue_payload


class ProviderDriftIssueTests(unittest.TestCase):
    def write_log(self, text: str) -> Path:
        tmp = tempfile.NamedTemporaryFile("w+", delete=False)
        tmp.write(text)
        tmp.flush()
        tmp.close()
        return Path(tmp.name)

    def test_clean_log_is_not_drift(self) -> None:
        path = self.write_log("running 1 test\ntest live_upstream_suite_is_opt_in ... ok\n")
        payload = build_issue_payload(log_path=path, repo="styrene-lab/omegon", run_id="1", sha="deadbeef", event_name="schedule")
        self.assertEqual(payload["classification"], "clean")
        self.assertFalse(payload["drift_detected"])
        self.assertEqual(payload["fingerprint"], "clean")

    def test_transient_failure_is_not_marked_as_drift(self) -> None:
        path = self.write_log(
            "test live_openai_prompt_round_trip ... FAILED\n"
            "thread 'live_openai_prompt_round_trip' panicked at connection timed out while calling provider\n"
        )
        payload = build_issue_payload(log_path=path, repo="styrene-lab/omegon", run_id="1", sha="deadbeef", event_name="schedule")
        self.assertEqual(payload["classification"], "transient")
        self.assertFalse(payload["drift_detected"])

    def test_auth_failure_is_not_marked_as_drift(self) -> None:
        path = self.write_log(
            "test live_anthropic_prompt_round_trip ... FAILED\n"
            "Error: 401 unauthorized: invalid api key\n"
        )
        payload = build_issue_payload(log_path=path, repo="styrene-lab/omegon", run_id="1", sha="deadbeef", event_name="schedule")
        self.assertEqual(payload["classification"], "auth_or_quota")
        self.assertFalse(payload["drift_detected"])

    def test_assertion_failure_is_marked_as_likely_drift(self) -> None:
        path = self.write_log(
            "test provider_contract_matrix_uses_expected_endpoint_shapes ... FAILED\n"
            "assertion failed: expected reasoning control 'thinking'\n"
        )
        payload = build_issue_payload(log_path=path, repo="styrene-lab/omegon", run_id="1", sha="deadbeef", event_name="schedule")
        self.assertEqual(payload["classification"], "likely_drift")
        self.assertTrue(payload["drift_detected"])


if __name__ == "__main__":
    unittest.main()
