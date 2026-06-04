from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    database_url: str = Field(default="sqlite:////var/lib/qc/qc.db")

    # JWT
    jwt_secret: str = Field(
        ...,
        min_length=32,
        description="HMAC signing key for JWTs. Must be ≥32 bytes. "
                    "Required at startup — no default. Generate with: "
                    "python -c 'import secrets; print(secrets.token_urlsafe(48))'",
    )
    jwt_expiry_seconds: int = Field(default=3600)

    # MQTT
    mqtt_host: str = Field(default="mosquitto")
    mqtt_port: int = Field(default=1883)
    mqtt_username: str = Field(default="qc-server")
    mqtt_password: str = Field(default="change-me")
    enable_mqtt_tls: bool = Field(default=False)

    # Logging
    log_level: str = Field(default="INFO")

    # Plant-local timezone for dashboard display + hourly bucketing.
    # Storage stays UTC; this only controls how days/hours are presented.
    plant_tz: str = Field(default="Africa/Tunis")

    # CORS — comma-separated list of allowed origins
    cors_allowed_origins: str = Field(default="http://localhost:5173")

    # Feature flags
    feature_flags_refresh_secs: int = Field(default=30)

    # Operator credentials — length of the auto-generated numeric PIN (legacy).
    # Kept within the 4–8 range the firmware/login UI accept.
    operator_pin_length: int = Field(default=6, ge=4, le=8)

    # Length of the auto-generated operator login password (ADR-018).
    operator_password_length: int = Field(default=8, ge=6, le=24)


settings = Settings()  # type: ignore[call-arg]  # pydantic-settings reads from env
