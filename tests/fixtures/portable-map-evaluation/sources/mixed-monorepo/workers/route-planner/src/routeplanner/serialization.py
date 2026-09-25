import json

from .models import RoutePlan, SlotRequest


def request_from_dict(value: dict[str, object]) -> SlotRequest:
    return SlotRequest(
        request_id=str(value["requestId"]),
        member_id=str(value["memberId"]),
        depot_code=str(value["depotCode"]),
        box_count=int(value["boxCount"]),
        route_date=str(value["routeDate"]),
    )


def plan_to_json(plan: RoutePlan) -> str:
    return json.dumps(
        {
            "routeDate": plan.route_date,
            "totalBoxes": plan.total_boxes,
            "stops": [
                {"requestId": stop.request_id, "depotCode": stop.depot_code, "boxCount": stop.box_count, "sequence": stop.sequence}
                for stop in plan.stops
            ],
        },
        sort_keys=True,
    )
