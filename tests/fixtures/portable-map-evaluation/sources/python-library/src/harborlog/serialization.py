"""Lossless JSON-compatible encoding for persisted inspection records."""

from __future__ import annotations

from datetime import date
from typing import Any

from .models import Finding, Inspection, InspectionStatus, Severity


def finding_to_dict(finding: Finding) -> dict[str, Any]:
    return {
        "code": finding.code,
        "severity": finding.severity.value,
        "note": finding.note,
        "resolved": finding.resolved,
    }


def finding_from_dict(payload: dict[str, Any]) -> Finding:
    return Finding(
        code=str(payload["code"]),
        severity=Severity(str(payload["severity"])),
        note=str(payload["note"]),
        resolved=bool(payload.get("resolved", False)),
    )


def inspection_to_dict(inspection: Inspection) -> dict[str, Any]:
    return {
        "inspection_id": inspection.inspection_id,
        "asset_id": inspection.asset_id,
        "inspected_on": inspection.inspected_on.isoformat(),
        "inspector": inspection.inspector,
        "status": inspection.status.value,
        "findings": [finding_to_dict(finding) for finding in inspection.findings],
        "notes": inspection.notes,
        "closed_on": inspection.closed_on.isoformat() if inspection.closed_on else None,
        "revision": inspection.revision,
    }


def inspection_from_dict(payload: dict[str, Any]) -> Inspection:
    closed_on = payload.get("closed_on")
    return Inspection(
        inspection_id=str(payload["inspection_id"]),
        asset_id=str(payload["asset_id"]),
        inspected_on=date.fromisoformat(str(payload["inspected_on"])),
        inspector=str(payload["inspector"]),
        status=InspectionStatus(str(payload["status"])),
        findings=tuple(finding_from_dict(item) for item in payload.get("findings", [])),
        notes=str(payload.get("notes", "")),
        closed_on=date.fromisoformat(str(closed_on)) if closed_on else None,
        revision=int(payload.get("revision", 1)),
    )
