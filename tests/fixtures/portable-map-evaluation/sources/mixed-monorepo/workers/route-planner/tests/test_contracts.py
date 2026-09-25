import json
import unittest

from routeplanner.contracts import validate_dispatch_event
from routeplanner.errors import PlanningError


class ContractTests(unittest.TestCase):
    def test_assigned_event_matches_shared_vocabulary(self):
        result = validate_dispatch_event(json.loads('{"eventType":"dispatch.assigned","dispatchId":"d","boxId":"b","depotCode":"NORTH-01","routeDate":"2026-09-25","status":"ASSIGNED"}'))
        self.assertEqual(result, ("dispatch.assigned", "ASSIGNED"))

    def test_other_lifecycle_is_rejected(self):
        with self.assertRaises(PlanningError):
            validate_dispatch_event({"eventType": "dispatch.cancelled", "status": "CANCELLED"})
