"""Configurable inspection policy and due-date decisions."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Mapping

from .models import Asset, Inspection, InspectionStatus, Severity


@dataclass(frozen=True)
class InspectionPolicy:
    max_open_days: int = 30
    critical_requires_resolution: bool = True
    standard_due_days: int = 180
    category_due_days: Mapping[str, int] = field(default_factory=dict)

    def due_days_for(self, asset: Asset) -> int:
        return self.category_due_days.get(asset.category.lower(), self.standard_due_days)

    def due_on(self, asset: Asset, inspected_on: date) -> date:
        return inspected_on + timedelta(days=self.due_days_for(asset))

    def is_overdue(self, inspection: Inspection, asset: Asset, today: date) -> bool:
        return today > self.due_on(asset, inspection.inspected_on)

    def is_open_stale(self, inspection: Inspection, today: date) -> bool:
        return inspection.status is InspectionStatus.OPEN and today > (
            inspection.inspected_on + timedelta(days=self.max_open_days)
        )

    def can_close(self, inspection: Inspection) -> bool:
        if not self.critical_requires_resolution:
            return True
        return not any(
            finding.severity is Severity.CRITICAL and not finding.resolved
            for finding in inspection.findings
        )

    def can_waive(self, inspection: Inspection) -> bool:
        return inspection.status is InspectionStatus.OPEN and not inspection.has_unresolved_findings
