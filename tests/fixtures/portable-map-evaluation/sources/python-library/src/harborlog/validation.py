"""Validation for domain inputs and inspection lifecycle transitions."""

from __future__ import annotations

from datetime import date

from .errors import ValidationError
from .models import Asset, Inspection, InspectionRequest, InspectionStatus
from .normalization import normalize_identifier, normalize_request, normalize_text
from .policy import InspectionPolicy


def validate_asset(asset: Asset, *, today: date) -> Asset:
    asset_id = normalize_identifier(asset.asset_id, field="asset id")
    name = normalize_text(asset.name, field="asset name", limit=160)
    category = normalize_identifier(asset.category.lower(), field="asset category")
    if asset.commissioned_on > today:
        raise ValidationError("commissioned date cannot be in the future")
    return Asset(
        asset_id=asset_id,
        name=name,
        category=category,
        commissioned_on=asset.commissioned_on,
        active=asset.active,
        metadata=dict(asset.metadata),
    )


def validate_request(
    request: InspectionRequest,
    asset: Asset,
    *,
    today: date,
    policy: InspectionPolicy,
) -> InspectionRequest:
    normalized = normalize_request(request)
    if normalized.asset_id != asset.asset_id:
        raise ValidationError("inspection asset does not match the registered asset")
    if normalized.inspected_on < asset.commissioned_on:
        raise ValidationError("inspection cannot predate asset commissioning")
    if normalized.inspected_on > today:
        raise ValidationError("inspection date cannot be in the future")
    if len({finding.code for finding in normalized.findings}) != len(normalized.findings):
        raise ValidationError("finding codes must be unique within an inspection")
    if policy.max_open_days < 1 or policy.standard_due_days < 1:
        raise ValidationError("policy day limits must be positive")
    return normalized


def validate_transition(
    inspection: Inspection,
    target: InspectionStatus,
    *,
    today: date,
    policy: InspectionPolicy,
) -> None:
    if inspection.status is not InspectionStatus.OPEN:
        raise ValidationError(f"cannot transition {inspection.status.value} inspection")
    if target is InspectionStatus.CLOSED:
        if not policy.can_close(inspection):
            raise ValidationError("critical findings must be resolved before closing")
    elif target is InspectionStatus.WAIVED:
        if not policy.can_waive(inspection):
            raise ValidationError("only open inspections without findings may be waived")
    else:
        raise ValidationError("an open inspection has no other lifecycle transition")
    if today < inspection.inspected_on:
        raise ValidationError("transition date cannot predate inspection")
