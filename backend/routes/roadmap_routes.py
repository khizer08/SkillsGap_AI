"""
Roadmap Routes - /api/generate-roadmap
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ValidationError
from typing import List, Optional
import logging
from config.database import get_collection
from models.schemas import RoadmapResult
from services.roadmap_generator import generate_roadmap

router = APIRouter()
logger = logging.getLogger(__name__)


class RoadmapRequest(BaseModel):
    session_id: str
    job_role: str
    missing_skills: List[str]
    have_skills: Optional[List[str]] = []


@router.post("/generate-roadmap")
async def create_roadmap(request: RoadmapRequest):
    """
    Generate a personalized learning roadmap using LLM.
    """
    if not request.missing_skills:
        raise HTTPException(status_code=400, detail="No missing skills provided")

    if not request.job_role:
        raise HTTPException(status_code=400, detail="job_role is required")

    try:
        roadmap = await generate_roadmap(
            job_role=request.job_role,
            missing_skills=request.missing_skills,
            have_skills=request.have_skills or []
        )
    except Exception as e:
        logger.error(f"Roadmap generation error: {e}")
        raise HTTPException(status_code=500, detail="Roadmap generation failed")

    roadmap["session_id"] = request.session_id

    try:
        data = RoadmapResult(
            session_id=request.session_id,
            job_role=roadmap["job_role"],
            missing_skills=roadmap["missing_skills"],
            weeks=roadmap["weeks"],
            total_duration_weeks=roadmap["total_duration_weeks"],
            project_suggestions=roadmap["project_suggestions"],
            course_recommendations=roadmap["course_recommendations"]
        )
    except (KeyError, ValidationError) as e:
        logger.error(f"Roadmap response validation failed: {e}")
        raise HTTPException(status_code=502, detail="Roadmap generation returned invalid data")

    # Persist to MongoDB
    collection = get_collection("roadmaps")
    if collection is not None:
        try:
            existing = await collection.find_one({"session_id": request.session_id}, {"_id": 1})
            if existing is None:
                insert_result = await collection.insert_one(data.dict())
                logger.info(
                    f"MongoDB insert successful: collection=roadmaps, "
                    f"session={request.session_id}, id={insert_result.inserted_id}"
                )
            else:
                logger.info(f"Roadmap already persisted: session={request.session_id}")
        except Exception as e:
            logger.warning(f"MongoDB insert failed: {e}")

    logger.info(
        f"Roadmap generated: session={request.session_id}, "
        f"weeks={roadmap.get('total_duration_weeks')}"
    )

    return JSONResponse(roadmap)


@router.get("/roadmap/{session_id}")
async def get_roadmap(session_id: str):
    """Retrieve a stored roadmap"""
    collection = get_collection("roadmaps")
    if collection is None:
        raise HTTPException(status_code=503, detail="Database not available")

    doc = await collection.find_one({"session_id": session_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Roadmap not found")

    return doc
