from .models import SlotRequest


def priority_key(request: SlotRequest, priority_depot: str) -> tuple[int, int, str, str]:
    return (
        0 if request.depot_code == priority_depot else 1,
        -request.box_count,
        request.depot_code,
        request.request_id,
    )
