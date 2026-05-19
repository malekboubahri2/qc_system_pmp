# Import all models so Alembic autogenerate sees the full metadata.
from app.models.base import Base  # noqa: F401
from app.models.operator import Operator  # noqa: F401
from app.models.device import Device  # noqa: F401
from app.models.product import Product  # noqa: F401
from app.models.defect import DefectType, DefectLog  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.feature_flag import FeatureFlag  # noqa: F401
