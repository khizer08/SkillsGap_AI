"""
Async OTP authentication service backed by MongoDB.
"""

import logging
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Tuple

from dotenv import load_dotenv
from fastapi import HTTPException, status

from config.database import get_collection
from services.email_service import EmailDeliveryError, send_otp_email
from services.jwt_service import create_access_token, hash_token
from services.otp_service import generate_otp, hash_otp, verify_otp_hash

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
logger = logging.getLogger(__name__)

OTP_EXPIRY_MINUTES = int(os.getenv("OTP_EXPIRY_MINUTES", "2"))
OTP_RESEND_LIMIT = int(os.getenv("OTP_RESEND_LIMIT", "3"))
OTP_RESEND_WINDOW_MINUTES = int(os.getenv("OTP_RESEND_WINDOW_MINUTES", "10"))

USERS_COLLECTION = "users"
REVOKED_TOKENS_COLLECTION = "auth_revoked_tokens"


def normalize_email(email: str) -> str:
    return email.strip().lower()


def _users_collection():
    collection = get_collection(USERS_COLLECTION)
    if collection is None:
        raise HTTPException(status_code=503, detail="Database not available")
    return collection


def _revoked_tokens_collection():
    collection = get_collection(REVOKED_TOKENS_COLLECTION)
    if collection is None:
        raise HTTPException(status_code=503, detail="Database not available")
    return collection


def _rate_limit_state(user: Dict, now: datetime) -> Tuple[int, bool]:
    attempts = int(user.get("email_otp_attempts") or 0) if user else 0
    last_sent = user.get("email_otp_last_sent_at") if user else None

    inside_window = (
        last_sent is not None
        and now - last_sent < timedelta(minutes=OTP_RESEND_WINDOW_MINUTES)
    )

    if inside_window and attempts >= OTP_RESEND_LIMIT:
        return attempts, False

    if not inside_window:
        attempts = 0

    return attempts + 1, True


async def send_login_otp(email: str) -> None:
    email = normalize_email(email)
    users = _users_collection()
    now = datetime.utcnow()
    user = await users.find_one({"email": email})

    next_attempts, allowed = _rate_limit_state(user or {}, now)
    if not allowed:
        logger.warning("OTP resend limit reached: email=%s", email)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="OTP resend limit reached. Please try again later.",
        )

    otp = generate_otp()
    expires_at = now + timedelta(minutes=OTP_EXPIRY_MINUTES)
    update = {
        "$set": {
            "email": email,
            "email_otp_hash": hash_otp(otp),
            "email_otp_expires": expires_at,
            "email_otp_attempts": next_attempts,
            "email_otp_last_sent_at": now,
        },
        "$setOnInsert": {
            "is_email_verified": False,
            "created_at": now,
        },
    }

    try:
        await users.update_one({"email": email}, update, upsert=True)
        try:
            await send_otp_email(email, otp)
            logger.info("OTP login code issued: email=%s attempts=%s", email, next_attempts)
        except EmailDeliveryError:
            # DEV FALLBACK: If Brevo fails, log OTP to console so dev can test
            if os.getenv("PRODUCTION") == "true":
                raise
            logger.warning("=" * 60)
            logger.warning("  DEV MODE: Brevo email failed — OTP printed below")
            logger.warning("  Email: %s", email)
            logger.warning("  OTP:   %s", otp)
            logger.warning("  Expires in %s minutes", OTP_EXPIRY_MINUTES)
            logger.warning("=" * 60)
    except EmailDeliveryError:
        raise HTTPException(status_code=502, detail="Failed to send OTP email")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("OTP login setup failed: email=%s error=%s", email, e)
        raise HTTPException(status_code=500, detail="Failed to start OTP login")


async def verify_login_otp(email: str, otp: str) -> Dict:
    email = normalize_email(email)
    users = _users_collection()
    now = datetime.utcnow()
    user = await users.find_one({"email": email})

    if not user or not user.get("email_otp_hash"):
        logger.warning("OTP verification attempted without pending OTP: email=%s", email)
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    expires_at = user.get("email_otp_expires")
    if not expires_at or expires_at < now:
        await users.update_one(
            {"email": email},
            {"$unset": {"email_otp_hash": "", "email_otp_expires": ""}},
        )
        logger.warning("Expired OTP rejected: email=%s", email)
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    if not verify_otp_hash(otp, user.get("email_otp_hash")):
        logger.warning("Invalid OTP rejected: email=%s", email)
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    await users.update_one(
        {"email": email},
        {
            "$set": {
                "is_email_verified": True,
                "email_otp_attempts": 0,
            },
            "$unset": {
                "email_otp_hash": "",
                "email_otp_expires": "",
            },
        },
    )

    user_id = str(user["_id"])
    token = create_access_token(email=email, user_id=user_id)
    logger.info("OTP verified and JWT issued: email=%s", email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "email": email,
            "is_email_verified": True,
            "created_at": user.get("created_at"),
        },
    }


async def get_user_by_email(email: str) -> Dict:
    users = _users_collection()
    user = await users.find_one({"email": normalize_email(email)}, {"email_otp_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Authenticated user not found")
    return user


async def is_token_revoked(token: str) -> bool:
    collection = _revoked_tokens_collection()
    token_hash = hash_token(token)
    doc = await collection.find_one({"token_hash": token_hash})
    return doc is not None


async def revoke_token(token: str, payload: Dict) -> None:
    collection = _revoked_tokens_collection()
    exp = payload.get("exp")
    expires_at = datetime.utcfromtimestamp(exp) if exp else datetime.utcnow()
    await collection.update_one(
        {"token_hash": hash_token(token)},
        {
            "$set": {
                "token_hash": hash_token(token),
                "email": payload.get("email"),
                "expires_at": expires_at,
                "created_at": datetime.utcnow(),
            }
        },
        upsert=True,
    )
    logger.info("JWT revoked on logout: email=%s", payload.get("email"))
