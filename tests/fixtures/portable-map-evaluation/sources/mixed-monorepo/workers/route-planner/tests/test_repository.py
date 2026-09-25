import unittest

from routeplanner.models import SlotRequest
from routeplanner.repository import InMemoryRequestRepository
from routeplanner.schedule import by_route_date


class RepositoryTests(unittest.TestCase):
    def test_pending_requests_and_date_groups(self):
        requests = [SlotRequest("r1", "m1", "NORTH-01", 1, "2026-09-25"), SlotRequest("r2", "m2", "SOUTH-02", 2, "2026-09-26")]
        repository = InMemoryRequestRepository(requests)
        self.assertEqual([item.request_id for item in repository.pending_for("2026-09-25")], ["r1"])
        self.assertEqual(list(by_route_date(requests)), ["2026-09-25", "2026-09-26"])
