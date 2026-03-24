from datetime import datetime

from pydantic import BaseModel


class SetupRequest(BaseModel):
    username: str
    password: str


class SetupResponse(BaseModel):
    user_id: str
    message: str


class LoginRequest(BaseModel):
    username: str
    password: str
    device_id: str
    device_name: str


class LoginResponse(BaseModel):
    session_token: str
    expires_at: datetime
    user_id: str


class RefreshResponse(BaseModel):
    session_token: str
    expires_at: datetime


class LogoutResponse(BaseModel):
    message: str


class StatusResponse(BaseModel):
    setup_complete: bool
    server_name: str
    version: str
