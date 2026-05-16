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

    # CORS — comma-separated list of allowed origins
    cors_allowed_origins: str = Field(default="http://localhost:5173")

    # Feature flags
    feature_flags_refresh_secs: int = Field(default=30)


settings = Settings()  # type: ignore[call-arg]  # pydantic-settings reads from env
