"""
OTP email authentication routes.
"""

import logging
import os

from fastapi import APIRouter, Depends, Response

from dependencies.auth import get_current_token_payload, get_current_user
from models.auth_schemas import AuthMessageResponse, AuthTokenResponse, AuthUser, OtpRequest, OtpVerifyRequest
from services.auth_service import revoke_token, send_login_otp, verify_login_otp
from services.jwt_service import JWT_EXPIRY_DAYS

router = APIRouter()
logger = logging.getLogger(__name__)

COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax")


@router.post("/auth/request-otp", response_model=AuthMessageResponse)
async def request_otp(payload: OtpRequest):
    await send_login_otp(str(payload.email))
    logger.info("Auth OTP requested: email=%s", payload.email)
    return {"message": "OTP sent to email"}


@router.post("/auth/resend-otp", response_model=AuthMessageResponse)
async def resend_otp(payload: OtpRequest):
    await send_login_otp(str(payload.email))
    logger.info("Auth OTP resent: email=%s", payload.email)
    return {"message": "OTP resent to email"}


@router.post("/auth/verify-otp", response_model=AuthTokenResponse)
async def verify_otp(payload: OtpVerifyRequest, response: Response):
    result = await verify_login_otp(str(payload.email), payload.otp)
    response.set_cookie(
        key="access_token",
        value=result["access_token"],
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=JWT_EXPIRY_DAYS * 24 * 60 * 60,
    )
    logger.info("Auth OTP verified: email=%s", payload.email)
    return result


@router.post("/auth/logout", response_model=AuthMessageResponse)
async def logout(
    response: Response,
    token_payload=Depends(get_current_token_payload),
):
    token, payload = token_payload
    await revoke_token(token, payload)
    response.delete_cookie("access_token")
    logger.info("Auth logout complete: email=%s", payload.get("email"))
    return {"message": "Logged out successfully"}


@router.get("/auth/me", response_model=AuthUser)
async def get_me(current_user=Depends(get_current_user)):
    return current_user
