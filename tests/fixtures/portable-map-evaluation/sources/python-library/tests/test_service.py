import unittest
from datetime import date

from harborlog import (
    Asset,
    Finding,
    FrozenClock,
    InMemoryInspectionStore,
    InspectionPolicy,
    InspectionQuery,
    InspectionRepository,
    InspectionRequest,
    InspectionService,
    InspectionStatus,
    Severity,
    ValidationError,
)


class ServiceTests(unittest.TestCase):
    def setUp(self):
        store = InMemoryInspectionStore()
        self.service = InspectionService(
            InspectionRepository(store),
            policy=InspectionPolicy(category_due_days={"crane": 5}),
            clock=FrozenClock(date(2024, 6, 30)),
        )
        self.service.register_asset(
            Asset("crane-1", "North Crane", "crane", date(2020, 1, 1))
        )

    def test_open_assess_search_and_close(self):
        inspection = self.service.open_inspection(
            InspectionRequest(
                "CRANE-1",
                date(2024, 6, 20),
                " A.   Singh ",
                findings=(Finding("loose-bolt", Severity.HIGH, "bolt needs torque"),),
            )
        )

        assessment = self.service.assess(inspection.inspection_id)
        self.assertEqual(assessment.band, "high")
        self.assertTrue(assessment.overdue)
        self.assertEqual(
            [item.inspection_id for item in self.service.search(InspectionQuery(status=InspectionStatus.OPEN))],
            [inspection.inspection_id],
        )

        closed = self.service.close_inspection(inspection.inspection_id)
        self.assertIs(closed.status, InspectionStatus.CLOSED)
        self.assertEqual(closed.revision, 2)

    def test_unresolved_critical_finding_cannot_close(self):
        inspection = self.service.open_inspection(
            InspectionRequest(
                "crane-1",
                date(2024, 6, 29),
                "A. Singh",
                findings=(Finding("brake-failure", Severity.CRITICAL, "stop use"),),
            )
        )

        with self.assertRaisesRegex(ValidationError, "resolved"):
            self.service.close_inspection(inspection.inspection_id)

    def test_summary_counts_attention_and_open_records(self):
        self.service.open_inspection(
            InspectionRequest("crane-1", date(2024, 6, 1), "A. Singh")
        )

        summary = self.service.summary()
        self.assertEqual(summary.total, 1)
        self.assertEqual(summary.open_count, 1)
        self.assertEqual(summary.overdue_count, 1)


if __name__ == "__main__":
    unittest.main()
