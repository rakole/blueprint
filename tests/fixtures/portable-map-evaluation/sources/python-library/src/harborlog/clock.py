"""Small clock abstraction used to keep policy decisions testable."""

from __future__ import annotations

from datetime import date
from typing import Protocol


class Clock(Protocol):
    def today(self) -> date:
        """Return the calendar date used by the service."""


class SystemClock:
    def today(self) -> date:
        return date.today()


class FrozenClock:
    def __init__(self, current: date):
        self._current = current

    def today(self) -> date:
        return self._current
