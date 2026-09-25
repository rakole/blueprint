from dataclasses import dataclass


@dataclass(frozen=True)
class SlotRequest:
    request_id: str
    member_id: str
    depot_code: str
    box_count: int
    route_date: str


@dataclass(frozen=True)
class PlannedStop:
    request_id: str
    depot_code: str
    route_date: str
    box_count: int
    sequence: int


@dataclass(frozen=True)
class RoutePlan:
    route_date: str
    total_boxes: int
    stops: tuple[PlannedStop, ...]
