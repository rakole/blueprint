import unittest
from datetime import date

from harborlog import Asset, Finding, InspectionPolicy, InspectionRequest, Severity, ValidationError
from harborlog.validation import validate_asset, validate_request


class ValidationTests(unittest.TestCase):
    def setUp(self):
        self.today = date(2024, 6, 30)
        self.asset = Asset("crane-1", "North Crane", "crane", date(2020, 1, 1))
        self.policy = InspectionPolicy(category_due_days={"crane": 30})

    def test_asset_text_is_canonicalized(self):
        asset = validate_asset(
            Asset("CRANE-1", "  North   Crane ", "CRANE", date(2020, 1, 1)),
            today=self.today,
        )

        self.assertEqual(asset.asset_id, "crane-1")
        self.assertEqual(asset.name, "North Crane")
        self.assertEqual(asset.category, "crane")

    def test_duplicate_finding_codes_are_rejected(self):
        request = InspectionRequest(
            "crane-1",
            date(2024, 6, 20),
            "A. Singh",
            findings=(
                Finding("loose-bolt", Severity.HIGH, "first"),
                Finding("loose-bolt", Severity.LOW, "second"),
            ),
        )

        with self.assertRaisesRegex(ValidationError, "unique"):
            validate_request(request, self.asset, today=self.today, policy=self.policy)

    def test_future_inspection_is_rejected(self):
        request = InspectionRequest("crane-1", date(2024, 7, 1), "A. Singh")

        with self.assertRaisesRegex(ValidationError, "future"):
            validate_request(request, self.asset, today=self.today, policy=self.policy)


if __name__ == "__main__":
    unittest.main()
