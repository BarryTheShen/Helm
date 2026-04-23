"""
Cryptography helpers for Helm backend.

Single source of truth for Fernet cipher construction. All modules that need
to encrypt or decrypt data should import get_fernet() from here rather than
duplicating the key-check pattern.
"""
from __future__ import annotations

from cryptography.fernet import Fernet

from app.config import settings


def get_fernet() -> Fernet:
    """Return a Fernet cipher initialised from settings.encryption_key.

    Raises ValueError if the key is not configured, which surfaces as a 500
    at request time. The key itself is validated at application startup via
    the fail-fast check in config.py.
    """
    if not settings.encryption_key:
        raise ValueError(
            "ENCRYPTION_KEY is not set. "
            "Set it in your .env file or environment. "
            "For local dev only, set HELM_ALLOW_INSECURE_DEV=1 to skip this check."
        )
    return Fernet(settings.encryption_key.encode())
