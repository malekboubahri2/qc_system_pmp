from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import app.logging as app_logging
from app.config import settings
from app.routers import (
    health, auth, operators, products, defect_types, devices, defect_logs,
    inspection_logs, stats, feature_flags, constants,
)

app_logging.setup_logging()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    from app.mqtt.bridge import start, stop
    from app.mqtt.publisher import publish_products_config, publish_operator_list
    start()
    # Re-publish retained config so devices get current state even if
    # Mosquitto's persistence DB was wiped between restarts.
    publish_products_config()
    publish_operator_list()
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
app.include_router(products.router)
app.include_router(defect_types.router)
app.include_router(devices.router)
app.include_router(defect_logs.router)
app.include_router(inspection_logs.router)
app.include_router(stats.router)
app.include_router(feature_flags.router)
app.include_router(constants.router)
