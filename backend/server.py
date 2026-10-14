import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
from lib.db import client, db, ensure_indexes  # noqa: E402
from routers import records, scenarios, settings  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def _startup_tasks():
    await ensure_indexes()
    try:
        await scenarios.seed_builtin_scenarios()
    except Exception as exc:  # never block boot on seeding
        logger.error("seed failed: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.startup_task = asyncio.create_task(_startup_tasks())
    yield
    client.close()


app = FastAPI(lifespan=lifespan)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"message": "VAL Aim API", "ok": True}


api_router.include_router(scenarios.router)
api_router.include_router(records.router)
api_router.include_router(settings.router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the router in the main app (keep last)
app.include_router(api_router)
