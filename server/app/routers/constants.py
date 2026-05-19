from fastapi import APIRouter
from app.schemas.category_constant import CategoryConstant
from app.constants import CATEGORY_KIND_VALUES, CATEGORY_DISPLAY_NAMES

router = APIRouter(prefix="/constants", tags=["constants"])


@router.get("/categories", response_model=list[CategoryConstant])
def get_categories():
    return [
        CategoryConstant(kind=k, display_name=CATEGORY_DISPLAY_NAMES[k])
        for k in CATEGORY_KIND_VALUES
    ]
