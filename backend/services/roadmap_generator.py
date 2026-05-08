"""
Roadmap generator compatibility layer.
The route imports this module, while Gemini generation lives in gemini_service.
"""

from typing import Dict, List

from services.gemini_service import call_gemini
from services.gemini_service import generate_roadmap as generate_gemini_roadmap


async def generate_roadmap(
    job_role: str,
    missing_skills: List[str],
    have_skills: List[str],
) -> Dict:
    """
    Generate a personalized roadmap using Gemini.
    Keeps the existing route/service function signature intact.
    """
    return await generate_gemini_roadmap(
        job_role=job_role,
        missing_skills=missing_skills,
        extracted_resume_skills=have_skills,
    )
