"""Immutable domain models for equipment inspections."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from typing import Mapping


class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class InspectionStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"
    WAIVED = "waived"


@dataclass(frozen=True)
class Asset:
    asset_id: str
    name: str
    category: str
    commissioned_on: date
    active: bool = True
    metadata: Mapping[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class Finding:
    code: str
    severity: Severity
    note: str
    resolved: bool = False


@dataclass(frozen=True)
class InspectionRequest:
    asset_id: str
    inspected_on: date
    inspector: str
    findings: tuple[Finding, ...] = ()
    notes: str = ""


@dataclass(frozen=True)
class Inspection:
    inspection_id: str
    asset_id: str
    inspected_on: date
    inspector: str
    status: InspectionStatus = InspectionStatus.OPEN
    findings: tuple[Finding, ...] = ()
    notes: str = ""
    closed_on: date | None = None
    revision: int = 1

    @property
    def has_unresolved_findings(self) -> bool:
        return any(not finding.resolved for finding in self.findings)


@dataclass(frozen=True)
class RiskAssessment:
    inspection_id: str
    score: int
    band: str
    overdue: bool


@dataclass(frozen=True)
class InspectionSummary:
    total: int
    open_count: int
    overdue_count: int
    critical_count: int
