import unittest

from helpers import load

A = load("bb_audit", "audit.py")


def money(mcp, **stacks):
    return {"yields": [{"label": k, "value": v} for k, v in stacks.items()] + [{"label": "MCP targets", "value": mcp}]}


class AllocationFindings(unittest.TestCase):
    def test_flags_the_2026_11_18_gap(self):
        # Before the change: MCP $0.20m/s per TB, stacks $0.36-1.93m/s, silver-helix left out.
        manager = {"plan": [{"target": "phantasy"}], "estimates": [
            {"target": "phantasy", "perSec": 30e6, "perTB": 2.8e6, "ramNeeded": 10830},
            {"target": "silver-helix", "perSec": 55.6e6, "perTB": 1.95e6, "ramNeeded": 29155}]}
        flags = A.allocation_findings(money(0.2e6, phantasy=1.93e6, iron_gym=0.36e6 * 2), manager)
        self.assertEqual(len(flags), 2)
        self.assertIn("MCP earns", flags[0])
        self.assertIn("silver-helix not stacked", flags[1])

    def test_quiet_when_allocation_is_sound(self):
        manager = {"plan": [{"target": "a"}], "estimates": [{"target": "a", "perSec": 1e6, "perTB": 1e6},
                                                            {"target": "b", "perSec": 1e6, "perTB": 1e6}]}
        self.assertEqual(A.allocation_findings(money(0.69e6, a=1.06e6), manager), [])

    def test_missing_files_are_quiet(self):
        self.assertEqual(A.allocation_findings(None, None), [])


if __name__ == "__main__":
    unittest.main()
