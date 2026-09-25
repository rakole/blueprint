import json
import sys

from .errors import PlanningError


def validate_dispatch_event(value: object) -> tuple[str, str]:
    if not isinstance(value, dict):
        raise PlanningError("dispatch event must be an object")
    required = ("eventType", "dispatchId", "boxId", "depotCode", "routeDate", "status")
    if any(not isinstance(value.get(field), str) or not value[field] for field in required):
        raise PlanningError("dispatch event fields are required")
    if value["eventType"] != "dispatch.assigned" or value["status"] != "ASSIGNED":
        raise PlanningError("dispatch event is not an assigned event")
    return value["eventType"], value["status"]


def main() -> None:
    if sys.argv[1:] != ["--probe"]:
        raise SystemExit("usage: python -m routeplanner.contracts --probe")
    event_type, status = validate_dispatch_event(json.load(sys.stdin))
    print(f"{event_type}:{status}")


if __name__ == "__main__":
    main()
