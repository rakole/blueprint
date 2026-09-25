from .errors import PlanningError
from .models import PlannedStop, RoutePlan, SlotRequest
from .scoring import priority_key
from .validation import validate_request


def build_plan(
    requests: list[SlotRequest],
    route_date: str,
    daily_capacity: int = 40,
    priority_depot: str = "NORTH-01",
) -> RoutePlan:
    selected = [request for request in requests if request.route_date == route_date]
    for request in selected:
        validate_request(request)
    total = sum(request.box_count for request in selected)
    if total > daily_capacity:
        raise PlanningError(f"plan needs {total} boxes but capacity is {daily_capacity}")
    ordered = sorted(selected, key=lambda request: priority_key(request, priority_depot))
    stops = tuple(
        PlannedStop(request.request_id, request.depot_code, request.route_date, request.box_count, index)
        for index, request in enumerate(ordered, start=1)
    )
    return RoutePlan(route_date, total, stops)
