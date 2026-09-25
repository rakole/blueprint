"""Application service coordinating assets, policy, and persistence."""

from __future__ import annotations

from dataclasses import replace
from datetime import date

from .clock import Clock, SystemClock
from .errors import RecordNotFoundError, ValidationError
from .filters import InspectionQuery, matches
from .models import (
    Asset,
    Inspection,
    InspectionRequest,
    InspectionStatus,
    InspectionSummary,
    RiskAssessment,
    Severity,
)
from .normalization import normalize_identifier
from .ordering import order_inspections
from .policy import InspectionPolicy
from .repository import InspectionRepository
from .scoring import assess_risk
from .validation import validate_asset, validate_request, validate_transition


class InspectionService:
    def __init__(
        self,
        repository: InspectionRepository,
        *,
        policy: InspectionPolicy | None = None,
        clock: Clock | None = None,
    ) -> None:
        self._repository = repository
        self._policy = policy or InspectionPolicy()
        self._clock = clock or SystemClock()
        self._assets: dict[str, Asset] = {}

    @property
    def policy(self) -> InspectionPolicy:
        return self._policy

    def register_asset(self, asset: Asset) -> Asset:
        normalized = validate_asset(asset, today=self._clock.today())
        current = self._assets.get(normalized.asset_id)
        if current is not None and current != normalized:
            raise ValidationError(f"asset already registered: {normalized.asset_id}")
        self._assets[normalized.asset_id] = normalized
        return normalized

    def open_inspection(self, request: InspectionRequest) -> Inspection:
        asset_id = normalize_identifier(request.asset_id, field="asset id")
        asset = self._asset(asset_id)
        if not asset.active:
            raise ValidationError("inactive assets cannot receive inspections")
        normalized = validate_request(
            request,
            asset,
            today=self._clock.today(),
            policy=self._policy,
        )
        sequence = 1 + sum(item.asset_id == asset.asset_id for item in self._repository.list())
        inspection = Inspection(
            inspection_id=f"{asset.asset_id}-{normalized.inspected_on:%Y%m%d}-{sequence:03d}",
            asset_id=asset.asset_id,
            inspected_on=normalized.inspected_on,
            inspector=normalized.inspector,
            findings=normalized.findings,
            notes=normalized.notes,
        )
        return self._repository.add(inspection)

    def close_inspection(self, inspection_id: str) -> Inspection:
        current = self._repository.get(inspection_id)
        today = self._clock.today()
        validate_transition(current, InspectionStatus.CLOSED, today=today, policy=self._policy)
        return self._repository.update(
            replace(current, status=InspectionStatus.CLOSED, closed_on=today, revision=current.revision + 1)
        )

    def waive_inspection(self, inspection_id: str) -> Inspection:
        current = self._repository.get(inspection_id)
        today = self._clock.today()
        validate_transition(current, InspectionStatus.WAIVED, today=today, policy=self._policy)
        return self._repository.update(
            replace(current, status=InspectionStatus.WAIVED, closed_on=today, revision=current.revision + 1)
        )

    def search(self, query: InspectionQuery | None = None) -> list[Inspection]:
        query = query or InspectionQuery()
        selected = [
            inspection
            for inspection in self._repository.list()
            if matches(
                inspection,
                query,
                self._assets,
                today=self._clock.today(),
                policy=self._policy,
            )
        ]
        return order_inspections(selected)

    def assess(self, inspection_id: str) -> RiskAssessment:
        inspection = self._repository.get(inspection_id)
        return assess_risk(
            inspection,
            self._asset(inspection.asset_id),
            today=self._clock.today(),
            policy=self._policy,
        )

    def summary(self) -> InspectionSummary:
        records = self._repository.list()
        overdue_count = 0
        critical_count = 0
        for inspection in records:
            asset = self._asset(inspection.asset_id)
            if self._policy.is_overdue(inspection, asset, self._clock.today()) or self._policy.is_open_stale(
                inspection, self._clock.today()
            ):
                overdue_count += 1
            critical_count += sum(
                finding.severity is Severity.CRITICAL and not finding.resolved
                for finding in inspection.findings
            )
        return InspectionSummary(
            total=len(records),
            open_count=sum(item.status is InspectionStatus.OPEN for item in records),
            overdue_count=overdue_count,
            critical_count=critical_count,
        )

    def _asset(self, asset_id: str) -> Asset:
        try:
            return self._assets[asset_id]
        except KeyError as exc:
            raise RecordNotFoundError(f"asset not found: {asset_id}") from exc
