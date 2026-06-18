from fastapi import APIRouter, HTTPException
from database import get_dashboard_stats, get_monthly_invoice_volume, get_latest_updates
import logging

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
logger = logging.getLogger(__name__)

@router.get("/stats")
async def dashboard_stats():
    """Returns high-level summary statistics."""
    return get_dashboard_stats()

@router.get("/volume")
async def monthly_volume():
    """Returns monthly invoice volume for charts."""
    return get_monthly_invoice_volume()

@router.get("/updates")
async def latest_updates():
    """Returns the latest document activity updates."""
    return get_latest_updates()
