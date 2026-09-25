import unittest

from harborlog.models import InspectionSummary, RiskAssessment
from harborlog.reporting import render_assessment, render_summary


class ReportingTests(unittest.TestCase):
    def test_summary_is_operator_scan_friendly(self):
        output = render_summary(InspectionSummary(4, 2, 1, 1))

        self.assertIn("inspections: 4", output)
        self.assertIn("needs attention: 1", output)
        self.assertIn("unresolved critical findings: 1", output)

    def test_assessment_includes_schedule_state(self):
        output = render_assessment(RiskAssessment("crane-1-20240601-001", 60, "high", True))

        self.assertEqual(output, "crane-1-20240601-001: high (60/100, overdue)")


if __name__ == "__main__":
    unittest.main()
