"""Exceptions raised by HarborLog's domain and adapter boundaries."""


class HarborLogError(Exception):
    """Base class for expected HarborLog failures."""


class ValidationError(HarborLogError):
    """Raised when an asset, request, or state transition is invalid."""


class DuplicateInspectionError(HarborLogError):
    """Raised when an inspection identifier is already stored."""


class RecordNotFoundError(HarborLogError):
    """Raised when a requested asset or inspection does not exist."""
