from .models import SlotRequest


class InMemoryRequestRepository:
    def __init__(self, requests: list[SlotRequest] | None = None):
        self._requests = {request.request_id: request for request in requests or []}

    def add(self, request: SlotRequest) -> None:
        self._requests[request.request_id] = request

    def pending_for(self, route_date: str) -> list[SlotRequest]:
        return [request for request in self._requests.values() if request.route_date == route_date]
