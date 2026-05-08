"""
Authentication dependencies for protected FastAPI routes.
"""

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from services.auth_service import get_user_by_email, is_token_revoked
from services.jwt_service import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    token = None
    if credentials and credentials.scheme.lower() == "bearer":
        token = credentials.credentials
    elif request.cookies.get("access_token"):
        token = request.cookies["access_token"]

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(token)
    if await is_token_revoked(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await get_user_by_email(payload["email"])
    return {
        "email": user["email"],
        "is_email_verified": bool(user.get("is_email_verified")),
        "created_at": user.get("created_at"),
    }


async def get_current_token_payload(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    token = None
    if credentials and credentials.scheme.lower() == "bearer":
        token = credentials.credentials
    elif request.cookies.get("access_token"):
        token = request.cookies["access_token"]

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    return token, decode_access_token(token)
