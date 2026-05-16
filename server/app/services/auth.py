from typing import Optional
from sqlalchemy.orm import Session
from app.models.user import User
from app.security import verify_password, create_access_token


def authenticate(db: Session, email: str, password: str) -> Optional[str]:
    """Return a JWT if credentials are valid, None otherwise."""
    user = db.query(User).filter(User.email == email, User.active.is_(True)).first()
    if user is None:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return create_access_token(str(user.id))
