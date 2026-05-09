"""Auth endpoints: POST /auth/login, POST /auth/logout."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from supabase import Client

from auth.utils import create_jwt, require_admin, verify_password
from database import get_db
from services.log_service import log_event
from utils.errors import ErrorCode, unauthorized

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: Client = Depends(get_db)):
    res = (
        db.table("admin_users")
        .select("id, full_name, username, email, password_hash, role")
        .eq("username", body.username)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    user = rows[0] if rows else None

    if not user or not verify_password(body.password, user.get("password_hash") or ""):
        raise unauthorized(ErrorCode.INVALID_CREDENTIALS, "invalid username or password")

    token = create_jwt(
        subject=user["id"],
        role=user.get("role", "superadmin"),
        kind="admin",
    )

    log_event(
        level="info",
        event="auth.login",
        meta={"admin_user_id": user["id"], "username": user["username"]},
    )

    return TokenResponse(
        access_token=token,
        user={
            "id": user["id"],
            "full_name": user["full_name"],
            "username": user["username"],
            "email": user["email"],
            "role": user["role"],
        },
    )


class LogoutResponse(BaseModel):
    message: str = "logged out"


@router.post("/logout", response_model=LogoutResponse)
async def logout(claims: dict = Depends(require_admin)):
    log_event(
        level="info",
        event="auth.logout",
        meta={"admin_user_id": claims.get("sub")},
    )
    return LogoutResponse()
