from collections import defaultdict

from .models import SlotRequest


def by_route_date(requests: list[SlotRequest]) -> dict[str, list[SlotRequest]]:
    grouped: dict[str, list[SlotRequest]] = defaultdict(list)
    for request in requests:
        grouped[request.route_date].append(request)
    return dict(sorted(grouped.items()))
