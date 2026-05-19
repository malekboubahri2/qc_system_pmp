from pydantic import BaseModel


class CategoryConstant(BaseModel):
    kind: str
    display_name: str
