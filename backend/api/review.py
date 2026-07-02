from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_review_queue, update_review_decision, get_extraction_record
from typing import List, Optional
import logging

router = APIRouter(prefix="/review", tags=["review"])
logger = logging.getLogger(__name__)


class ReviewDecisionPayload(BaseModel):
    remarks: Optional[List[str]] = None


@router.get("/queue")
async def review_queue():
    """Returns every document in the review workspace (pending, approved and rejected)."""
    return get_review_queue()


@router.post("/{record_id}/approve")
async def approve_document(record_id: str, payload: ReviewDecisionPayload = ReviewDecisionPayload()):
    """Approves a document and records the decision in the database."""
    if not get_extraction_record(record_id):
        raise HTTPException(status_code=404, detail="Record not found")

    success = update_review_decision(record_id, "Approved", payload.remarks)
    if not success:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"id": record_id, "status": "Approved"}


@router.post("/{record_id}/reject")
async def reject_document(record_id: str, payload: ReviewDecisionPayload = ReviewDecisionPayload()):
    """Rejects a document and saves the reviewer's remarks (if any) to the document's remarks array."""
    if not get_extraction_record(record_id):
        raise HTTPException(status_code=404, detail="Record not found")

    success = update_review_decision(record_id, "Rejected", payload.remarks)
    if not success:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"id": record_id, "status": "Rejected", "remarks": payload.remarks or []}
