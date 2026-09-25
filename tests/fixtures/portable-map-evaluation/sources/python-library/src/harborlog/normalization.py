"""Canonicalize human-entered identifiers and finding text."""

from __future__ import annotations

import re

from .errors import ValidationError
from .models import Finding, InspectionRequest, Severity

_IDENTIFIER = re.compile(r"^[a-z0-9][a-z0-9._-]{1,63}$")


def normalize_text(value: str, *, field: str, limit: int = 500) -> str:
    cleaned = " ".join(value.split())
    if not cleaned:
        raise ValidationError(f"{field} must not be blank")
    if len(cleaned) > limit:
        raise ValidationError(f"{field} exceeds {limit} characters")
    return cleaned


def normalize_identifier(value: str, *, field: str) -> str:
    cleaned = value.strip().lower()
    if not _IDENTIFIER.fullmatch(cleaned):
        raise ValidationError(
            f"{field} must use 2-64 lowercase letters, digits, dots, dashes, or underscores"
        )
    return cleaned


def coerce_severity(value: Severity | str) -> Severity:
    try:
        return value if isinstance(value, Severity) else Severity(value.strip().lower())
    except (AttributeError, ValueError) as exc:
        raise ValidationError(f"unknown severity: {value!r}") from exc


def normalize_finding(finding: Finding) -> Finding:
    return Finding(
        code=normalize_identifier(finding.code, field="finding code"),
        severity=coerce_severity(finding.severity),
        note=normalize_text(finding.note, field="finding note"),
        resolved=finding.resolved,
    )


def normalize_request(request: InspectionRequest) -> InspectionRequest:
    findings = tuple(normalize_finding(finding) for finding in request.findings)
    return InspectionRequest(
        asset_id=normalize_identifier(request.asset_id, field="asset id"),
        inspected_on=request.inspected_on,
        inspector=normalize_text(request.inspector, field="inspector", limit=120),
        findings=findings,
        notes="" if not request.notes.strip() else normalize_text(request.notes, field="notes"),
    )
