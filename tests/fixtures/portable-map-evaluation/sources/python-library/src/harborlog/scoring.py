"""Risk scoring kept separate from storage and lifecycle policy."""

from __future__ import annotations

from datetime import date

from .models import Asset, Finding, Inspection, RiskAssessment, Severity
from .policy import InspectionPolicy

_WEIGHTS = {
    Severity.LOW: 5,
    Severity.MEDIUM: 15,
    Severity.HIGH: 30,
    Severity.CRITICAL: 60,
}


def _finding_score(finding: Finding) -> int:
    base = _WEIGHTS[finding.severity]
    return base if finding.resolved else base * 2


def assess_risk(
    inspection: Inspection,
    asset: Asset,
    *,
    today: date,
    policy: InspectionPolicy,
) -> RiskAssessment:
    score = min(100, sum(_finding_score(finding) for finding in inspection.findings))
    overdue = policy.is_overdue(inspection, asset, today)
    if overdue:
        score = min(100, score + 10)
    if score >= 80:
        band = "critical"
    elif score >= 40:
        band = "high"
    elif score >= 15:
        band = "moderate"
    else:
        band = "low"
    return RiskAssessment(
        inspection_id=inspection.inspection_id,
        score=score,
        band=band,
        overdue=overdue,
    )
