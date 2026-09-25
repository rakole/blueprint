import argparse
import json
import sys

from .planner import build_plan
from .serialization import plan_to_json, request_from_dict


def main() -> None:
    parser = argparse.ArgumentParser(description="plan MarketRoute pickup stops")
    parser.add_argument("route_date")
    parser.add_argument("--capacity", type=int, default=40)
    args = parser.parse_args()
    requests = [request_from_dict(item) for item in json.load(sys.stdin)]
    print(plan_to_json(build_plan(requests, args.route_date, args.capacity)))


if __name__ == "__main__":
    main()
