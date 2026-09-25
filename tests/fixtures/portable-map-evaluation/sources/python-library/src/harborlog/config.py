"""TOML configuration loading for the command line boundary."""

from __future__ import annotations

import tomllib
from dataclasses import dataclass
from pathlib import Path

from .policy import InspectionPolicy


@dataclass(frozen=True)
class AppConfig:
    policy: InspectionPolicy


def load_config(path: str | Path) -> AppConfig:
    with Path(path).open("rb") as stream:
        document = tomllib.load(stream)
    raw_policy = document.get("policy", {})
    category_due_days = {
        str(category).lower(): int(days)
        for category, days in raw_policy.get("category_due_days", {}).items()
    }
    policy = InspectionPolicy(
        max_open_days=int(raw_policy.get("max_open_days", 30)),
        critical_requires_resolution=bool(
            raw_policy.get("critical_requires_resolution", True)
        ),
        standard_due_days=int(raw_policy.get("standard_due_days", 180)),
        category_due_days=category_due_days,
    )
    if policy.max_open_days < 1 or policy.standard_due_days < 1:
        raise ValueError("policy day limits must be positive")
    if any(days < 1 for days in category_due_days.values()):
        raise ValueError("category due days must be positive")
    return AppConfig(policy=policy)
