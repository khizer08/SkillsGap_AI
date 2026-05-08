"""
SkillGap AI - FastAPI Backend
Main application entry point
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from config.database import connect_db, disconnect_db
from config.chroma import init_chroma
from routes.resume_routes import router as resume_router
from routes.analysis_routes import router as analysis_router
from routes.roadmap_routes import router as roadmap_router
from routes.interview_routes import router as interview_router
from routes.auth_routes import router as auth_router

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    logger.info("Starting SkillGap AI backend...")
    await connect_db()
    init_chroma()
    logger.info("Backend ready!")
    yield
    logger.info("Shutting down...")
    await disconnect_db()


app = FastAPI(
    title="SkillGap AI API",
    description="AI-powered career guidance system",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware - allow React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(resume_router, prefix="/api", tags=["Resume"])
app.include_router(analysis_router, prefix="/api", tags=["Analysis"])
app.include_router(roadmap_router, prefix="/api", tags=["Roadmap"])
app.include_router(interview_router, prefix="/api", tags=["Interview"])
app.include_router(auth_router, prefix="/api", tags=["Auth"])


@app.get("/")
async def root():
    return {"message": "SkillGap AI Backend Running", "status": "ok"}


@app.get("/health")
async def health():
    return {"status": "healthy", "version": "1.0.0"}
