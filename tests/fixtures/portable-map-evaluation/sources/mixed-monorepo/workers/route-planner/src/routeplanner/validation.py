import re

from .errors import PlanningError
from .models import SlotRequest

_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def validate_request(request: SlotRequest, max_boxes: int = 12) -> SlotRequest:
    if not request.request_id or not request.member_id or not request.depot_code:
        raise PlanningError("request ids and depot code are required")
    if request.box_count < 1 or request.box_count > max_boxes:
        raise PlanningError(f"box count must be between one and {max_boxes}")
    if not _DATE.fullmatch(request.route_date):
        raise PlanningError("route date must use YYYY-MM-DD")
    return request
