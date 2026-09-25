"""Repository boundary that translates adapter details into domain errors."""

from __future__ import annotations

from .errors import RecordNotFoundError
from .models import Inspection
from .storage import InspectionStore


class InspectionRepository:
    def __init__(self, store: InspectionStore) -> None:
        self._store = store

    def add(self, inspection: Inspection) -> Inspection:
        self._store.insert(inspection)
        return inspection

    def get(self, inspection_id: str) -> Inspection:
        inspection = self._store.get(inspection_id)
        if inspection is None:
            raise RecordNotFoundError(f"inspection not found: {inspection_id}")
        return inspection

    def list(self) -> list[Inspection]:
        return self._store.all()

    def update(self, inspection: Inspection) -> Inspection:
        try:
            self._store.replace(inspection)
        except KeyError as exc:
            raise RecordNotFoundError(f"inspection not found: {inspection.inspection_id}") from exc
        return inspection
