"""
Brevo email delivery service for OTP login messages.
"""

import logging
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
logger = logging.getLogger(__name__)

BREVO_API_KEY = os.getenv("BREVO_API_KEY")
EMAIL_USER = os.getenv("EMAIL_USER")
BREVO_URL = "https://api.brevo.com/v3/smtp/email"


class EmailDeliveryError(Exception):
    """Raised when Brevo rejects or fails an email request."""


async def send_otp_email(email: str, otp: str) -> None:
    if not BREVO_API_KEY:
        raise EmailDeliveryError("BREVO_API_KEY is not configured")
    if not EMAIL_USER:
        raise EmailDeliveryError("EMAIL_USER is not configured")

    payload = {
        "sender": {
            "name": "SkillGap AI",
            "email": EMAIL_USER,
        },
        "to": [{"email": email}],
        "subject": "Your SkillGap AI login code",
        "htmlContent": f"""
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
              <h2>Your SkillGap AI login code</h2>
              <p>Use this one-time password to continue signing in:</p>
              <p style="font-size:28px;font-weight:700;letter-spacing:6px">{otp}</p>
              <p>This code expires in 2 minutes.</p>
              <p>If you did not request this code, you can ignore this email.</p>
            </div>
        """,
    }

    headers = {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
    }

    logger.info("Sending OTP email through Brevo: email=%s", email)
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(BREVO_URL, json=payload, headers=headers)
            response.raise_for_status()
        logger.info("OTP email sent successfully: email=%s", email)
    except httpx.HTTPStatusError as e:
        logger.error("Brevo rejected OTP email: status=%s body=%s", e.response.status_code, e.response.text)
        raise EmailDeliveryError("Failed to send OTP email")
    except httpx.HTTPError as e:
        logger.error("Brevo OTP email request failed: %s", e)
        raise EmailDeliveryError("Failed to send OTP email")
