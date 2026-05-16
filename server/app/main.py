from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import app.logging as app_logging
from app.config import settings
from app.routers import health, auth, operators, defect_categories, defect_types, devices

app_logging.setup_logging()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    from app.mqtt.bridge import start, stop
    start()
    yield
    stop()


app = FastAPI(title="Painting QC API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_allowed_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(operators.router)
app.include_router(defect_categories.router)
app.include_router(defect_types.router)
app.include_router(devices.router)
