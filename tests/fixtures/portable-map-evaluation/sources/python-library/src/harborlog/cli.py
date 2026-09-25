"""Minimal standard-library CLI for inspecting policy configuration."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Sequence

from .config import load_config


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="harborlog")
    parser.add_argument(
        "--config",
        type=Path,
        required=True,
        help="path to a HarborLog TOML configuration",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("policy", help="print configured inspection limits")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    config = load_config(args.config)
    if args.command == "policy":
        policy = config.policy
        print(f"max-open-days: {policy.max_open_days}")
        print(f"standard-due-days: {policy.standard_due_days}")
        print(f"critical-resolution-required: {policy.critical_requires_resolution}")
        return 0
    return 2
