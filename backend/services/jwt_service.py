"""
Small HS256 JWT utility built on the Python standard library.
"""

import base64
import hashlib
import hmac
import json
import logging
import os
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict

from dotenv import load_dotenv
from fastapi import HTTPException, status

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
logger = logging.getLogger(__name__)

JWT_SECRET = os.getenv("JWT_SECRET", "skillgap-dev-secret-change-me")
JWT_EXPIRY_DAYS = int(os.getenv("JWT_EXPIRY_DAYS", "7"))

if JWT_SECRET == "skillgap-dev-secret-change-me":
    logger.warning("JWT_SECRET is not configured; using development fallback secret")


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode((data + padding).encode("ascii"))


def _sign(message: str) -> str:
    signature = hmac.new(
        JWT_SECRET.encode("utf-8"),
        message.encode("ascii"),
        hashlib.sha256,
    ).digest()
    return _b64encode(signature)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_access_token(email: str, user_id: str) -> str:
    now = datetime.utcnow()
    exp = now + timedelta(days=JWT_EXPIRY_DAYS)
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": email,
        "email": email,
        "user_id": user_id,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
        "jti": str(uuid.uuid4()),
    }

    header_part = _b64encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_part = _b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_part}.{payload_part}"
    return f"{signing_input}.{_sign(signing_input)}"


def decode_access_token(token: str) -> Dict[str, Any]:
    try:
        header_part, payload_part, signature = token.split(".")
        signing_input = f"{header_part}.{payload_part}"
        expected_signature = _sign(signing_input)
        if not hmac.compare_digest(signature, expected_signature):
            raise ValueError("Invalid JWT signature")

        header = json.loads(_b64decode(header_part))
        if header.get("alg") != "HS256":
            raise ValueError("Unsupported JWT algorithm")

        payload = json.loads(_b64decode(payload_part))
        exp = int(payload.get("exp", 0))
        if datetime.utcnow().timestamp() >= exp:
            raise ValueError("JWT has expired")

        if not payload.get("email"):
            raise ValueError("JWT missing email")
        return payload
    except Exception as e:
        logger.warning("JWT validation failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
