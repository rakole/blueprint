"""Persistence adapters for inspection records.

The JSON-lines adapter deliberately rewrites one small file atomically. That
keeps the fixture deterministic while leaving the service independent from a
particular database.
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Protocol

from .errors import DuplicateInspectionError
from .models import Inspection
from .serialization import inspection_from_dict, inspection_to_dict


class InspectionStore(Protocol):
    def all(self) -> list[Inspection]:
        """Return every stored inspection."""

    def get(self, inspection_id: str) -> Inspection | None:
        """Return one inspection or ``None``."""

    def insert(self, inspection: Inspection) -> None:
        """Persist a new inspection."""

    def replace(self, inspection: Inspection) -> None:
        """Replace an existing inspection."""


class InMemoryInspectionStore:
    def __init__(self) -> None:
        self._records: dict[str, Inspection] = {}

    def all(self) -> list[Inspection]:
        return list(self._records.values())

    def get(self, inspection_id: str) -> Inspection | None:
        return self._records.get(inspection_id)

    def insert(self, inspection: Inspection) -> None:
        if inspection.inspection_id in self._records:
            raise DuplicateInspectionError(inspection.inspection_id)
        self._records[inspection.inspection_id] = inspection

    def replace(self, inspection: Inspection) -> None:
        if inspection.inspection_id not in self._records:
            raise KeyError(inspection.inspection_id)
        self._records[inspection.inspection_id] = inspection


class JsonlInspectionStore:
    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)

    def all(self) -> list[Inspection]:
        if not self.path.exists():
            return []
        with self.path.open("r", encoding="utf-8") as stream:
            return [
                inspection_from_dict(json.loads(line))
                for line in stream
                if line.strip()
            ]

    def get(self, inspection_id: str) -> Inspection | None:
        return next(
            (inspection for inspection in self.all() if inspection.inspection_id == inspection_id),
            None,
        )

    def insert(self, inspection: Inspection) -> None:
        records = self.all()
        if any(item.inspection_id == inspection.inspection_id for item in records):
            raise DuplicateInspectionError(inspection.inspection_id)
        self._write(records + [inspection])

    def replace(self, inspection: Inspection) -> None:
        records = self.all()
        for index, current in enumerate(records):
            if current.inspection_id == inspection.inspection_id:
                records[index] = inspection
                self._write(records)
                return
        raise KeyError(inspection.inspection_id)

    def _write(self, records: list[Inspection]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        handle = tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=self.path.parent, delete=False
        )
        temporary = Path(handle.name)
        try:
            with handle:
                for record in records:
                    json.dump(inspection_to_dict(record), handle, sort_keys=True)
                    handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, self.path)
        finally:
            temporary.unlink(missing_ok=True)
