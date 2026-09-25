import unittest
from datetime import date

from harborlog import Finding, Inspection, InspectionStatus, Severity


class ModelTests(unittest.TestCase):
    def test_inspection_reports_unresolved_findings(self):
        inspection = Inspection(
            inspection_id="crane-1-20240601-001",
            asset_id="crane-1",
            inspected_on=date(2024, 6, 1),
            inspector="A. Singh",
            findings=(Finding("loose-bolt", Severity.HIGH, "bolt needs torque"),),
        )

        self.assertTrue(inspection.has_unresolved_findings)
        self.assertIs(inspection.status, InspectionStatus.OPEN)

    def test_empty_inspection_is_immutable(self):
        inspection = Inspection(
            inspection_id="crane-1-20240601-001",
            asset_id="crane-1",
            inspected_on=date(2024, 6, 1),
            inspector="A. Singh",
        )

        with self.assertRaises(AttributeError):
            inspection.status = InspectionStatus.CLOSED


if __name__ == "__main__":
    unittest.main()
