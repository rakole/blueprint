import json
import unittest

from routeplanner.models import SlotRequest
from routeplanner.planner import build_plan
from routeplanner.serialization import plan_to_json, request_from_dict


class SerializationTests(unittest.TestCase):
    def test_shared_request_names_and_plan_shape(self):
        request = request_from_dict({"requestId": "r1", "memberId": "m1", "depotCode": "NORTH-01", "boxCount": 1, "routeDate": "2026-09-25"})
        output = json.loads(plan_to_json(build_plan([request], "2026-09-25")))
        self.assertEqual(output["stops"][0]["requestId"], "r1")
        self.assertEqual(output["totalBoxes"], 1)
