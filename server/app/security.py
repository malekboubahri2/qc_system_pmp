import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
import argon2
from argon2 import PasswordHasher
import jwt
from app.config import settings

_ph = PasswordHasher()


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return _ph.verify(hashed, password)
    except argon2.exceptions.VerifyMismatchError:
        return False


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(seconds=settings.jwt_expiry_seconds)
    return jwt.encode(
        {"sub": subject, "exp": expire},
        settings.jwt_secret,
        algorithm="HS256",
    )


def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


# PIN hashing — SHA-256 with random salt so firmware can verify in C.
# Format: "sha256:<16-hex-char-salt>:<64-hex-char-digest>"
def hash_pin(pin: str) -> str:
    salt = secrets.token_hex(8)
    digest = hashlib.sha256(f"{salt}{pin}".encode()).hexdigest()
    return f"sha256:{salt}:{digest}"


def generate_numeric_pin(length: int) -> str:
    """Return a cryptographically-random numeric PIN of the given length.
    Uses `secrets` (CSPRNG); leading zeros are kept so every PIN is exactly
    `length` digits. Uniqueness across operators is enforced by the caller."""
    return "".join(secrets.choice("0123456789") for _ in range(length))


def verify_pin(pin: str, pin_hash: str) -> bool:
    try:
        algo, salt, expected = pin_hash.split(":")
    except ValueError:
        return False
    if algo != "sha256":
        return False
    return hashlib.sha256(f"{salt}{pin}".encode()).hexdigest() == expected
