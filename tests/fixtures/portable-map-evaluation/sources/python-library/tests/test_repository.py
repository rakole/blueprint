import tempfile
import unittest
from datetime import date
from pathlib import Path

from harborlog import (
    DuplicateInspectionError,
    Finding,
    InMemoryInspectionStore,
    Inspection,
    InspectionRepository,
    JsonlInspectionStore,
    Severity,
)


class RepositoryTests(unittest.TestCase):
    def test_jsonl_adapter_round_trips_nested_records(self):
        record = Inspection(
            inspection_id="vehicle-7-20240601-001",
            asset_id="vehicle-7",
            inspected_on=date(2024, 6, 1),
            inspector="M. Rao",
            findings=(Finding("tire-wear", Severity.MEDIUM, "replace soon"),),
            notes="morning route",
        )
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "records.jsonl"
            repository = InspectionRepository(JsonlInspectionStore(path))
            repository.add(record)
            reloaded = InspectionRepository(JsonlInspectionStore(path)).get(record.inspection_id)

        self.assertEqual(reloaded, record)

    def test_duplicate_identifier_is_rejected(self):
        record = Inspection("vehicle-7-20240601-001", "vehicle-7", date(2024, 6, 1), "M. Rao")
        repository = InspectionRepository(InMemoryInspectionStore())
        repository.add(record)
        with self.assertRaises(DuplicateInspectionError):
            repository.add(record)


if __name__ == "__main__":
    unittest.main()
