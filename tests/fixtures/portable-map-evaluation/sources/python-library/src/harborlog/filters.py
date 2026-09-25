"""Composable inspection query predicates."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from .models import Asset, Inspection, InspectionStatus, Severity
from .policy import InspectionPolicy


@dataclass(frozen=True)
class InspectionQuery:
    asset_id: str | None = None
    status: InspectionStatus | None = None
    severity: Severity | None = None
    overdue_only: bool = False


def matches(
    inspection: Inspection,
    query: InspectionQuery,
    assets: dict[str, Asset],
    *,
    today: date,
    policy: InspectionPolicy,
) -> bool:
    if query.asset_id is not None and inspection.asset_id != query.asset_id:
        return False
    if query.status is not None and inspection.status is not query.status:
        return False
    if query.severity is not None and not any(
        finding.severity is query.severity for finding in inspection.findings
    ):
        return False
    if query.overdue_only and not policy.is_overdue(
        inspection, assets[inspection.asset_id], today
    ):
        return False
    return True
