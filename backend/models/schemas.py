"""Pydantic models for requests and responses.

Sensitive-field exclusion is baked in: response models never include
`password_hash` or `twilio_auth_token`.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

# -----------------------------------------------------------------------------
# Shared
# -----------------------------------------------------------------------------

OrgStatus = Literal["active", "paused"]
MessageChannel = Literal["whatsapp", "sms"]
MessageStatus = Literal["sent", "delivered", "failed", "queued", "undelivered", "read"]
BillingCycle = Literal["monthly", "quarterly", "annual"]
UserRole = Literal["admin", "staff"]
LogLevel = Literal["info", "warning", "error"]
Period = Literal["today", "week", "month", "year", "custom"]
GroupBy = Literal["day", "week", "month"]


class PaginatedResponse(BaseModel):
    data: list[Any]
    total: int
    page: int
    limit: int


# -----------------------------------------------------------------------------
# Plans
# -----------------------------------------------------------------------------

class PlanInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    amount: float = Field(..., ge=0)
    billing_cycle: BillingCycle = "monthly"
    description: Optional[str] = None


class PlanRead(BaseModel):
    id: UUID
    organisation_id: UUID
    name: str
    amount: float
    billing_cycle: BillingCycle
    description: Optional[str] = None
    created_at: datetime


class PlanUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = Field(default=None, ge=0)
    billing_cycle: Optional[BillingCycle] = None
    description: Optional[str] = None


# -----------------------------------------------------------------------------
# Organisation users (per-org staff records — NOT admin console login)
# -----------------------------------------------------------------------------

class OrgUserInput(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=200)
    username: str = Field(..., min_length=3, max_length=50)
    mobile: str = Field(..., min_length=6, max_length=20)
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: UserRole = "staff"


class OrgUserUpdate(BaseModel):
    full_name: Optional[str] = None
    username: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(default=None, min_length=6)
    role: Optional[UserRole] = None


class OrgUserRead(BaseModel):
    id: UUID
    organisation_id: UUID
    full_name: str
    username: str
    mobile: str
    email: str
    role: UserRole
    created_at: datetime


# -----------------------------------------------------------------------------
# Organisations
# -----------------------------------------------------------------------------

class OrganisationCreateForm(BaseModel):
    """Used when parsing the JSON portion of the multipart create request."""

    name: str = Field(..., min_length=1, max_length=200)
    type: str = Field(..., min_length=1, max_length=100)
    custom_type: Optional[str] = None
    address: Optional[str] = None
    maps_url: Optional[str] = None
    upi_id: Optional[str] = Field(default=None, max_length=200)
    upi_number: Optional[str] = Field(default=None, max_length=50)
    whatsapp_enabled: bool = True
    sms_enabled: bool = False
    users: list[OrgUserInput] = Field(..., min_length=2)
    plans: list[PlanInput] = Field(..., min_length=1, max_length=5)


class OrganisationUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    custom_type: Optional[str] = None
    address: Optional[str] = None
    maps_url: Optional[str] = None
    upi_id: Optional[str] = Field(default=None, max_length=200)
    upi_number: Optional[str] = Field(default=None, max_length=50)
    whatsapp_enabled: Optional[bool] = None
    sms_enabled: Optional[bool] = None
    users: Optional[list[OrgUserInput]] = None
    plans: Optional[list[PlanInput]] = None

    @field_validator("plans")
    @classmethod
    def _plan_count(cls, v: Optional[list[PlanInput]]):
        if v is not None and (len(v) < 1 or len(v) > 5):
            raise ValueError("plans must contain 1 to 5 entries")
        return v

    @field_validator("users")
    @classmethod
    def _user_count(cls, v: Optional[list[OrgUserInput]]):
        if v is not None and len(v) < 2:
            raise ValueError("users must contain at least 2 entries")
        return v


class OrganisationStatusUpdate(BaseModel):
    status: OrgStatus


class OrganisationRead(BaseModel):
    id: UUID
    name: str
    type: str
    custom_type: Optional[str] = None
    logo_url: Optional[str] = None
    logo_signed_url: Optional[str] = None
    address: Optional[str] = None
    maps_url: Optional[str] = None
    upi_id: Optional[str] = None
    upi_number: Optional[str] = None
    whatsapp_enabled: bool = True
    sms_enabled: bool = False
    status: OrgStatus
    created_at: datetime
    member_count: Optional[int] = None
    message_count_month: Optional[int] = None


class OrganisationDetail(OrganisationRead):
    users: list[OrgUserRead] = []
    plans: list[PlanRead] = []


# -----------------------------------------------------------------------------
# Members
# -----------------------------------------------------------------------------

class MemberCreate(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=200)
    mobile: str = Field(..., min_length=6, max_length=20)
    email: Optional[EmailStr] = None
    plan_id: UUID
    join_date: Optional[date] = None
    next_due_date: Optional[date] = None


class MemberUpdate(BaseModel):
    full_name: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[EmailStr] = None
    plan_id: Optional[UUID] = None
    join_date: Optional[date] = None
    next_due_date: Optional[date] = None


class MemberRead(BaseModel):
    id: UUID
    organisation_id: UUID
    plan_id: Optional[UUID] = None
    plan_name: Optional[str] = None
    full_name: str
    mobile: str
    email: Optional[str] = None
    join_date: Optional[date] = None
    next_due_date: Optional[date] = None
    created_at: datetime


# -----------------------------------------------------------------------------
# Members CSV import
# -----------------------------------------------------------------------------

class CsvImportError(BaseModel):
    row: int
    reason: str


class CsvImportPreview(BaseModel):
    import_id: UUID
    organisation_id: UUID
    valid_rows: int
    error_rows: int
    errors: list[CsvImportError]
    expires_at: datetime


class CsvImportResult(BaseModel):
    imported: int
    skipped: int
    errors: list[CsvImportError]


# -----------------------------------------------------------------------------
# Messages
# -----------------------------------------------------------------------------

class MessageRead(BaseModel):
    id: UUID
    organisation_id: UUID
    member_id: Optional[UUID] = None
    channel: MessageChannel
    status: MessageStatus
    twilio_sid: Optional[str] = None
    body: Optional[str] = None
    error: Optional[str] = None
    sent_at: datetime


class SendMessageRequest(BaseModel):
    member_id: UUID
    message_body: Optional[str] = Field(default=None, max_length=2000)


class SendMessageResponse(BaseModel):
    message_id: UUID
    channel_used: MessageChannel
    status: MessageStatus
    twilio_sid: Optional[str] = None
    error: Optional[str] = None


class BulkSendRequest(BaseModel):
    organisation_id: UUID
    member_ids: Optional[list[UUID]] = None
    message_body: Optional[str] = Field(default=None, max_length=2000)


class BulkSendItem(BaseModel):
    member_id: UUID
    success: bool
    channel: Optional[MessageChannel] = None
    status: Optional[MessageStatus] = None
    twilio_sid: Optional[str] = None
    error: Optional[str] = None


class BulkSendResponse(BaseModel):
    sent: int
    failed: int
    results: list[BulkSendItem]


class DueRemindersResponse(BaseModel):
    organisation_id: UUID
    due_today: BulkSendResponse
    due_tomorrow: BulkSendResponse


class MessageListResponse(BaseModel):
    data: list[MessageRead]
    total: int
    page: int
    limit: int
    whatsapp_count: int
    sms_count: int


# -----------------------------------------------------------------------------
# Analytics
# -----------------------------------------------------------------------------

class AnalyticsSummary(BaseModel):
    total_orgs: int
    total_members: int
    total_messages: int
    whatsapp_count: int
    sms_count: int
    estimated_cost: float


class TimeseriesMessagesPoint(BaseModel):
    date: datetime
    whatsapp: int
    sms: int
    total: int


class TimeseriesMessagesResponse(BaseModel):
    data: list[TimeseriesMessagesPoint]


class TimeseriesCostPoint(BaseModel):
    date: datetime
    whatsapp_count: int
    sms_count: int
    whatsapp_cost: float
    sms_cost: float
    cost: float


class TimeseriesCostResponse(BaseModel):
    data: list[TimeseriesCostPoint]


# -----------------------------------------------------------------------------
# Settings
# -----------------------------------------------------------------------------

class SettingsRead(BaseModel):
    id: int = 1
    messaging_enabled: bool
    sms_fallback_enabled: bool
    twilio_whatsapp_cost: float
    twilio_sms_cost: float
    twilio_account_sid: Optional[str] = None
    twilio_auth_token_masked: Optional[str] = None
    whatsapp_sender: Optional[str] = None
    sms_sender: Optional[str] = None
    updated_at: Optional[datetime] = None


class SettingsUpdate(BaseModel):
    messaging_enabled: Optional[bool] = None
    sms_fallback_enabled: Optional[bool] = None
    twilio_whatsapp_cost: Optional[float] = Field(default=None, ge=0)
    twilio_sms_cost: Optional[float] = Field(default=None, ge=0)
    twilio_account_sid: Optional[str] = None
    twilio_auth_token: Optional[str] = None
    whatsapp_sender: Optional[str] = None
    sms_sender: Optional[str] = None


# -----------------------------------------------------------------------------
# Logs
# -----------------------------------------------------------------------------

class LogRead(BaseModel):
    id: UUID
    level: LogLevel
    event: str
    organisation_id: Optional[UUID] = None
    meta: Optional[dict[str, Any]] = None
    created_at: datetime


# -----------------------------------------------------------------------------
# Organisation users — client-app login (JWT kind=user)
# -----------------------------------------------------------------------------


class UserOrgSnippet(BaseModel):
    id: UUID
    name: str
    status: OrgStatus
    upi_id: Optional[str] = None
    upi_number: Optional[str] = None


class UserMe(BaseModel):
    id: UUID
    full_name: str
    username: str
    email: str
    role: UserRole
    organisation_id: UUID
    organisation: UserOrgSnippet


class UserLoginRequest(BaseModel):
    identifier: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=1)


class UserChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6)


class UserTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserMe
