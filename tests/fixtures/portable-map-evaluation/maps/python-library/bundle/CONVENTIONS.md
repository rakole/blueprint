# Conventions

## Purpose

Inputs are canonicalized before domain use: identifiers are stripped, lowercased, and constrained to 2–64 lowercase identifier characters; text is whitespace-collapsed and bounded; finding severities accept enum values or normalized strings. Domain dataclasses are frozen, and enums carry lowercase wire values. Inspection records use date-based identifiers and revision increments for lifecycle updates.

## Validation and naming

Asset ids and categories are normalized through normalize_identifier; asset names, inspector names, notes, and finding notes use normalize_text. Duplicate finding codes are rejected within a request, dates may not be future-dated or before commissioning, and asset categories are stored lowercase.

## Lifecycle representation

Inspections begin OPEN with revision 1. Closing or waiving uses dataclasses.replace to set the target status and current closed_on date while incrementing revision. Enum identity checks are used for statuses and severities, and serialized values use their lowercase enum strings.

## Evidence

- `src/harborlog/normalization.py`
- `src/harborlog/validation.py`
- `src/harborlog/models.py`
- `src/harborlog/service.py`
- `src/harborlog/serialization.py`
