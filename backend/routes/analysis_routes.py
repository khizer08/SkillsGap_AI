"""
Analysis Routes - /api/analyze
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
import logging
from config.database import get_collection
from models.schemas import SkillGapResult
from services.skill_gap_engine import analyze_skill_gap, get_available_roles

router = APIRouter()
logger = logging.getLogger(__name__)


class AnalyzeRequest(BaseModel):
    session_id: str
    resume_skills: List[str]
    job_role: Optional[str] = None
    jd_text: Optional[str] = None


@router.post("/analyze")
async def analyze_skills(request: AnalyzeRequest):
    """
    Analyze skill gap between resume skills and job role/JD.
    Returns categorized skills (have/partial/missing) and a recommendation.
    """
    # Validation
    if not request.resume_skills:
        raise HTTPException(status_code=400, detail="resume_skills cannot be empty")

    if not request.job_role and not request.jd_text:
        raise HTTPException(
            status_code=400,
            detail="Either job_role or jd_text must be provided"
        )

    try:
        result = analyze_skill_gap(
            resume_skills=request.resume_skills,
            job_role=request.job_role,
            jd_text=request.jd_text
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Skill gap analysis error: {e}")
        raise HTTPException(status_code=500, detail="Analysis failed")

    # Add session ID to result
    result["session_id"] = request.session_id

    # Persist to MongoDB
    collection = get_collection("skill_gap_results")
    if collection is not None:
        try:
            existing = await collection.find_one({"session_id": request.session_id}, {"_id": 1})
            if existing is None:
                data = SkillGapResult(
                    session_id=request.session_id,
                    job_role=result["job_role"],
                    match_percentage=result["match_percentage"],
                    have_skills=result["have_skills"],
                    partial_skills=result["partial_skills"],
                    missing_skills=result["missing_skills"],
                    recommendation=result["recommendation"]
                )
                insert_result = await collection.insert_one(data.dict())
                logger.info(
                    f"MongoDB insert successful: collection=skill_gap_results, "
                    f"session={request.session_id}, id={insert_result.inserted_id}"
                )
            else:
                logger.info(f"Skill gap result already persisted: session={request.session_id}")
        except Exception as e:
            logger.warning(f"MongoDB insert failed: {e}")

    logger.info(
        f"Analysis complete: session={request.session_id}, "
        f"match={result['match_percentage']}%, "
        f"recommendation={result['recommendation']}"
    )

    return JSONResponse(result)


@router.get("/roles")
async def get_roles():
    """Get list of available job roles"""
    return {"roles": get_available_roles()}


@router.get("/analysis/{session_id}")
async def get_analysis(session_id: str):
    """Retrieve stored analysis result"""
    collection = get_collection("skill_gap_results")
    if collection is None:
        raise HTTPException(status_code=503, detail="Database not available")

    doc = await collection.find_one({"session_id": session_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Analysis not found")

    return doc
