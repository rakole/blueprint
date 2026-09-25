"""Human-readable summaries for operators and command-line callers."""

from __future__ import annotations

from .models import InspectionSummary, RiskAssessment


def render_summary(summary: InspectionSummary) -> str:
    return "\n".join(
        (
            f"inspections: {summary.total}",
            f"open: {summary.open_count}",
            f"needs attention: {summary.overdue_count}",
            f"unresolved critical findings: {summary.critical_count}",
        )
    )


def render_assessment(assessment: RiskAssessment) -> str:
    state = "overdue" if assessment.overdue else "within schedule"
    return f"{assessment.inspection_id}: {assessment.band} ({assessment.score}/100, {state})"
