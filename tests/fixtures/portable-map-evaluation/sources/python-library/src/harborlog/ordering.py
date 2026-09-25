"""Stable ordering helpers for list and report views."""

from __future__ import annotations

from collections.abc import Iterable

from .models import Inspection


def order_inspections(
    inspections: Iterable[Inspection], *, newest_first: bool = True
) -> list[Inspection]:
    return sorted(
        inspections,
        key=lambda inspection: (inspection.inspected_on, inspection.inspection_id),
        reverse=newest_first,
    )
