import json
import tempfile
import unittest
from pathlib import Path

from standing_orders_audit import (
    Auditor,
    extract_python_literal_list,
    find_forbidden_apis,
    find_unsafe_loops,
    select_gate_findings,
    validate_approval_records,
    validate_claims_document,
)


class StaticScannerTests(unittest.TestCase):
    def test_forbidden_capital_api_is_detected(self):
        source = "if (live) ns.stock.buyStock(symbol, shares); ns.stock.cancelOrder(order);"
        self.assertEqual(find_forbidden_apis(source), ["buyStock", "cancelOrder"])

    def test_read_only_stock_calls_are_allowed(self):
        source = "ns.stock.getForecast(symbol); ns.stock.getPosition(symbol);"
        self.assertEqual(find_forbidden_apis(source), [])

    def test_share_loop_requires_explicit_cooldown(self):
        source = "export async function main(ns) { while (true) { await ns.share(); } }"
        self.assertIn("calls ns.share without an explicit bounded cooldown", " ".join(find_unsafe_loops(source)))

    def test_share_loop_with_sleep_passes(self):
        source = "export async function main(ns) { while (true) { await ns.share(); await ns.sleep(100); } }"
        self.assertEqual(find_unsafe_loops(source), [])

    def test_generic_busy_loop_is_detected(self):
        source = "while (true) { counter += 1; }"
        self.assertIn("no detectable asynchronous boundary", " ".join(find_unsafe_loops(source)))

    def test_netscript_action_loop_is_a_detectable_async_boundary(self):
        source = "while (true) { await ns.weaken(ns.args[0]); }"
        self.assertEqual(find_unsafe_loops(source), [])


class ManifestFixtureTests(unittest.TestCase):
    def test_extracts_literal_remote_manifests(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "remote.py"
            path.write_text('WATCHED_FILES = ["a.js", "b.js"]\nPULL_FILES = ["out.txt"]\n', encoding="utf-8")
            self.assertEqual(extract_python_literal_list(path, "WATCHED_FILES"), ["a.js", "b.js"])
            self.assertEqual(extract_python_literal_list(path, "PULL_FILES"), ["out.txt"])

    def test_rejects_computed_remote_manifest(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "remote.py"
            path.write_text('BASE = ["a.js"]\nWATCHED_FILES = BASE + ["b.js"]\n', encoding="utf-8")
            with self.assertRaises(ValueError):
                extract_python_literal_list(path, "WATCHED_FILES")


class ApprovalFixtureTests(unittest.TestCase):
    def test_initialization_record_grants_no_approval(self):
        line = json.dumps({"recordType": "ledger-init", "schemaVersion": 1, "createdAt": "2026-08-15", "purpose": "test"})
        records, errors = validate_approval_records([line])
        self.assertEqual(errors, [])
        self.assertEqual(records[0]["recordType"], "ledger-init")

    def test_incomplete_approval_is_rejected(self):
        init = json.dumps({"recordType": "ledger-init", "schemaVersion": 1, "createdAt": "2026-08-15", "purpose": "test"})
        bad = json.dumps({"recordType": "approval", "schemaVersion": 1, "approvalId": "APR-2026-08-15-X"})
        _, errors = validate_approval_records([init, bad])
        self.assertTrue(any("missing" in error for error in errors))


class ClaimFixtureTests(unittest.TestCase):
    def test_live_claim_without_retained_attestation_is_rejected(self):
        data = {
            "schemaVersion": 1,
            "claims": [
                {
                    "claimId": "C1",
                    "statement": "live",
                    "classification": "fact",
                    "status": "live-confirmed",
                    "evidenceClass": "live",
                    "evidence": [{"path": None, "sourceVersion": "unknown", "observedAt": "2026-08-15", "runId": None}],
                    "proves": "something",
                    "doesNotProve": "everything",
                }
            ],
        }
        with tempfile.TemporaryDirectory() as directory:
            errors = validate_claims_document(data, Path(directory))
        self.assertTrue(any("live-confirmed" in error for error in errors))

    def test_reported_observation_can_name_no_local_artifact(self):
        data = {
            "schemaVersion": 1,
            "claims": [
                {
                    "claimId": "C2",
                    "statement": "reported",
                    "classification": "fact",
                    "status": "reported-incident",
                    "evidenceClass": "exploratory-observation",
                    "evidence": [{"path": None, "sourceVersion": "unknown", "observedAt": "2026-08-15", "runId": None}],
                    "proves": "containment is warranted",
                    "doesNotProve": "root cause",
                }
            ],
        }
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual(validate_claims_document(data, Path(directory)), [])


class PromotionFixtureTests(unittest.TestCase):
    @staticmethod
    def _promotion_document(state="disabled-after-incident"):
        return {
            "stateDefinitions": {state: "fixture", "approved-production": "fixture"},
            "subsystems": [
                {
                    "id": "ipvgo",
                    "aliases": [],
                    "riskTier": 3,
                    "state": state,
                    "authority": ["D1"],
                    "owner": "Ken",
                    "sourceFiles": ["ipvgo_player.js"],
                    "conditionsToAdvance": ["bounded canary"],
                    "approvalIds": [],
                    "nextSafeAction": "local tests",
                }
            ],
        }

    def test_tier_zero_remains_open_for_disabled_subsystem(self):
        with tempfile.TemporaryDirectory() as directory:
            auditor = Auditor(Path(directory), "action", "ipvgo", 0)
            auditor.documents["promotion"] = self._promotion_document()
            auditor.action_gate()
            self.assertEqual(auditor.findings, [])

    def test_tier_zero_gate_ignores_visible_scoped_live_block(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            auditor = Auditor(root, "action", "ipvgo", 0)
            auditor.documents["promotion"] = self._promotion_document()
            auditor.add(
                "BLOCK", "fixture-live-hold", "ipvgo", "live hold",
                "live condition failed", "fix live condition", "local tests remain open",
                "bounded live evidence", "Ken", ["action"]
            )
            self.assertEqual(select_gate_findings(auditor.findings, "action", "ipvgo", 0), [])

    def test_live_action_fails_closed_for_disabled_subsystem(self):
        with tempfile.TemporaryDirectory() as directory:
            auditor = Auditor(Path(directory), "action", "ipvgo", 3)
            auditor.documents["promotion"] = self._promotion_document()
            auditor.action_gate()
            self.assertEqual(auditor.findings[0].status, "BLOCK")
            self.assertEqual(auditor.findings[0].scope, "ipvgo")
            self.assertTrue(auditor.findings[0].parallelWork)

    def test_declared_core_alias_passes_and_unknown_name_still_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            promotion = {
                "stateDefinitions": {"operational-baseline": "fixture"},
                "subsystems": [
                    {
                        "id": "core-mcp",
                        "aliases": ["mcp-core"],
                        "riskTier": 2,
                        "state": "operational-baseline",
                        "authority": ["D1"],
                        "owner": "Codex",
                        "sourceFiles": ["startup.js"],
                        "conditionsToAdvance": [],
                        "approvalIds": [],
                        "nextSafeAction": "continue core recovery",
                    }
                ],
            }
            alias = Auditor(Path(directory), "action", "mcp-core", 2)
            alias.documents["promotion"] = promotion
            alias.action_gate()
            self.assertEqual(alias.findings, [])

            unknown = Auditor(Path(directory), "action", "another-core", 2)
            unknown.documents["promotion"] = promotion
            unknown.action_gate()
            self.assertEqual(unknown.findings[0].checkId, "unknown-subsystem")
            self.assertEqual(unknown.findings[0].status, "BLOCK")

    def test_approved_production_without_approval_is_blocked(self):
        with tempfile.TemporaryDirectory() as directory:
            auditor = Auditor(Path(directory), "session", None, None)
            auditor.documents["promotion"] = self._promotion_document("approved-production")
            auditor.documents["directives"] = {"directives": [{"id": "D1"}]}
            auditor.check_promotion_state()
            self.assertTrue(any(f.checkId == "tier3-approval" and f.status == "BLOCK" for f in auditor.findings))


if __name__ == "__main__":
    unittest.main()
