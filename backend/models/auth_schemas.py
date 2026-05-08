"""
Authentication request/response schemas for OTP email login.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class OtpRequest(BaseModel):
    email: str = Field(..., pattern=EMAIL_PATTERN)


class OtpVerifyRequest(BaseModel):
    email: str = Field(..., pattern=EMAIL_PATTERN)
    otp: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")


class AuthUser(BaseModel):
    email: str = Field(..., pattern=EMAIL_PATTERN)
    is_email_verified: bool = False
    created_at: Optional[datetime] = None


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AuthUser


class AuthMessageResponse(BaseModel):
    message: str
