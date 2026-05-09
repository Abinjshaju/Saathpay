"""Standardised error codes and HTTPException helper.

Every user-facing error follows the shape:
    { "detail": { "code": "<CODE>", "message": "<msg>" } }
"""

from __future__ import annotations

from enum import StrEnum

from fastapi import HTTPException, status


class ErrorCode(StrEnum):
    ORG_NOT_FOUND = "ORG_NOT_FOUND"
    MEMBER_NOT_FOUND = "MEMBER_NOT_FOUND"
    PLAN_NOT_FOUND = "PLAN_NOT_FOUND"
    PLAN_IN_USE = "PLAN_IN_USE"
    PLAN_LIMIT_EXCEEDED = "PLAN_LIMIT_EXCEEDED"
    USER_MIN_REQUIRED = "USER_MIN_REQUIRED"
    DUPLICATE_USERNAME = "DUPLICATE_USERNAME"
    DUPLICATE_EMAIL = "DUPLICATE_EMAIL"
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    MESSAGING_DISABLED = "MESSAGING_DISABLED"
    ORG_PAUSED = "ORG_PAUSED"
    TWILIO_NOT_CONFIGURED = "TWILIO_NOT_CONFIGURED"
    TWILIO_CREDENTIALS_INVALID = "TWILIO_CREDENTIALS_INVALID"
    SEND_FAILED = "SEND_FAILED"
    INVALID_FILE_TYPE = "INVALID_FILE_TYPE"
    FILE_TOO_LARGE = "FILE_TOO_LARGE"
    INVALID_CSV = "INVALID_CSV"
    IMPORT_NOT_FOUND = "IMPORT_NOT_FOUND"
    IMPORT_EXPIRED = "IMPORT_EXPIRED"
    IMPORT_ALREADY_CONFIRMED = "IMPORT_ALREADY_CONFIRMED"
    INVALID_REQUEST = "INVALID_REQUEST"
    INVALID_SIGNATURE = "INVALID_SIGNATURE"
    INTERNAL_ERROR = "INTERNAL_ERROR"


def api_error(
    code: ErrorCode | str,
    message: str,
    status_code: int = status.HTTP_400_BAD_REQUEST,
) -> HTTPException:
    """Build a FastAPI HTTPException with our standard error envelope."""
    return HTTPException(
        status_code=status_code,
        detail={"code": str(code), "message": message},
    )


def not_found(code: ErrorCode | str, message: str) -> HTTPException:
    return api_error(code, message, status.HTTP_404_NOT_FOUND)


def forbidden(code: ErrorCode | str, message: str) -> HTTPException:
    return api_error(code, message, status.HTTP_403_FORBIDDEN)


def unauthorized(code: ErrorCode | str, message: str) -> HTTPException:
    return api_error(code, message, status.HTTP_401_UNAUTHORIZED)
