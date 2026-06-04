from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import app.logging as app_logging
from app.config import settings
from app.routers import (
    health, auth, operators, products, defect_types, devices, defect_logs,
    inspection_logs, inspections, kpi, stats, feature_flags, constants,
)

app_logging.setup_logging()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    from app.mqtt.bridge import start, stop, on_connected
    from app.mqtt.publisher import publish_products_config, publish_operator_list

    def _republish_retained_config() -> None:
        # Runs after every (re)connect. Publishing here — rather than right
        # after start() — avoids the race where connect_async() hasn't
        # completed yet and the publish is dropped with rc=NO_CONN, which left
        # devices without operators/products until the next dashboard mutation.
        publish_products_config()
        publish_operator_list()

    on_connected(_republish_retained_config)
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
app.include_router(products.router)
app.include_router(defect_types.router)
app.include_router(devices.router)
app.include_router(defect_logs.router)
app.include_router(inspection_logs.router)
app.include_router(inspections.router)
app.include_router(kpi.router)
app.include_router(stats.router)
app.include_router(feature_flags.router)
app.include_router(constants.router)
