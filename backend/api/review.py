from fastapi import APIRouter, HTTPException, Body
from database import get_review_queue, update_extraction_status, get_extraction_record
from typing import Dict, Any, List
import logging

router = APIRouter(prefix="/review", tags=["review"])
logger = logging.getLogger(__name__)

@router.get("/queue")
async def review_queue():
    """Returns the list of documents requiring manual review."""
    return get_review_queue()

@router.post("/{record_id}/approve")
async def approve_document(record_id: str):
    """Approves a document in the review queue."""
    success = update_extraction_status(record_id, "Approved")
    if not success:
        raise HTTPException(status_code=404, detail="Record not found or already approved")
    return {"id": record_id, "status": "Approved"}

@router.post("/{record_id}/reject")
async def reject_document(record_id: str):
    """Rejects a document in the review queue."""
    success = update_extraction_status(record_id, "Rejected")
    if not success:
        raise HTTPException(status_code=404, detail="Record not found or already rejected")
    return {"id": record_id, "status": "Rejected"}
