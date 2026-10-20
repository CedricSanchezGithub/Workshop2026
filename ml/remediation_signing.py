"""Signature des alertes (HMAC-SHA256 du corps brut), identique à services/remediation/remediation/signing.py."""

import hashlib
import hmac


def sign(key: bytes, body: bytes) -> str:
    return "sha256=" + hmac.new(key, body, hashlib.sha256).hexdigest()
