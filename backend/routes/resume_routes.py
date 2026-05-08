"""
Resume Routes - /api/upload-resume
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import uuid
import logging
from config.database import get_collection
from models.schemas import ResumeAnalysis
from services.resume_parser import parse_resume

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/upload-resume")
async def upload_resume(file: UploadFile = File(...)):
    """
    Upload and parse a resume PDF.
    Returns extracted skills, technologies, frameworks, and a session ID.
    """
    # Validate file type
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    # Read file
    file_bytes = await file.read()

    # Validate file size
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max 10MB allowed.")

    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    try:
        # Parse resume
        parsed = parse_resume(file_bytes)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Resume parsing error: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse resume")

    # Generate session ID
    session_id = str(uuid.uuid4())

    # Persist to MongoDB (if available)
    collection = get_collection("resume_analyses")
    if collection is not None:
        try:
            existing = await collection.find_one({"session_id": session_id}, {"_id": 1})
            if existing is None:
                data = ResumeAnalysis(
                    session_id=session_id,
                    extracted_skills=parsed["skills"],
                    technologies=parsed["technologies"],
                    frameworks=parsed["frameworks"],
                    projects=parsed["projects"],
                    raw_text_preview=parsed["raw_text_preview"]
                )
                insert_result = await collection.insert_one(data.dict())
                logger.info(
                    f"MongoDB insert successful: collection=resume_analyses, "
                    f"session={session_id}, id={insert_result.inserted_id}"
                )
            else:
                logger.info(f"Resume analysis already persisted: session={session_id}")
        except Exception as e:
            logger.warning(f"MongoDB insert failed: {e}")

    logger.info(f"Resume parsed: session={session_id}, skills={len(parsed['skills'])}")

    return JSONResponse({
        "session_id": session_id,
        "filename": file.filename,
        "skills": parsed["skills"],
        "technologies": parsed["technologies"],
        "frameworks": parsed["frameworks"],
        "projects": parsed["projects"],
        "raw_text_preview": parsed["raw_text_preview"],
        "total_skills_found": len(parsed["skills"])
    })


@router.get("/resume/{session_id}")
async def get_resume_analysis(session_id: str):
    """Retrieve a stored resume analysis by session ID"""
    collection = get_collection("resume_analyses")
    if collection is None:
        raise HTTPException(status_code=503, detail="Database not available")

    doc = await collection.find_one({"session_id": session_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Resume analysis not found")

    return doc
