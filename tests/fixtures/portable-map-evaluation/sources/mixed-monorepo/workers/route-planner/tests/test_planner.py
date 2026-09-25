import unittest

from routeplanner.errors import PlanningError
from routeplanner.models import SlotRequest
from routeplanner.planner import build_plan


class PlannerTests(unittest.TestCase):
    def setUp(self):
        self.requests = [
            SlotRequest("r2", "m2", "SOUTH-02", 2, "2026-09-25"),
            SlotRequest("r1", "m1", "NORTH-01", 3, "2026-09-25"),
        ]

    def test_priority_depot_is_first(self):
        plan = build_plan(self.requests, "2026-09-25")
        self.assertEqual([stop.request_id for stop in plan.stops], ["r1", "r2"])
        self.assertEqual(plan.total_boxes, 5)

    def test_capacity_is_enforced(self):
        with self.assertRaises(PlanningError):
            build_plan(self.requests, "2026-09-25", daily_capacity=4)
