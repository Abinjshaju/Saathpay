"""Application configuration loaded from environment variables."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Load `.env` from the project root.
_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_PATH),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "Saathpay Admin API"
    app_env: str = "development"

    supabase_url: str
    supabase_service_role_key: str
    supabase_logo_bucket: str = "org-logos"
    logo_signed_url_ttl_seconds: int = 3600
    logo_max_bytes: int = 2 * 1024 * 1024

    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expiry_minutes: int = 480

    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_whatsapp_sender: str = ""
    twilio_sms_sender: str = ""

    #: Send a welcome WhatsApp/SMS when POST /organisations/{id}/members creates a member.
    member_welcome_enabled: bool = True
    member_welcome_message: str = Field(
        default=(
            "Hi {full_name}, welcome to {org_name}! You're on the {plan_name} plan. "
            "We'll send payment reminders to this number. Thank you for joining!"
        ),
    )
    #: Twilio WhatsApp Content SID for an *approved* template (business-initiated / outside 24h).
    #: Leave empty to send `member_welcome_message` as freeform (may hit error 63016 on WhatsApp).
    twilio_welcome_whatsapp_content_sid: str = ""
    #: Optional JSON object for template variables, e.g. {{"1":"Anna","2":"Zen Yoga"}}.
    #: If empty but content SID is set, defaults to {{"1": full_name, "2": org_name, "3": plan_name}}.
    twilio_welcome_whatsapp_content_variables: str = ""

    cors_allowed_origins: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
