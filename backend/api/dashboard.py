from fastapi import APIRouter, Query
from typing import Optional
from database import (
    build_dashboard_filter,
    get_dashboard_stats,
    get_monthly_invoice_volume,
    get_latest_updates,
    get_status_breakdown,
    get_top_vendors,
    get_dashboard_filter_options,
)
import logging

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
logger = logging.getLogger(__name__)


def _filters(
    status: Optional[str] = Query(None, description="Filter by document status: Saved, Approved, Rejected"),
    vendor: Optional[str] = Query(None, description="Filter by extracted vendor name"),
    date_from: Optional[str] = Query(None, description="Filter by creation date, inclusive lower bound (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Filter by creation date, inclusive upper bound (YYYY-MM-DD)"),
):
    return build_dashboard_filter(status=status, vendor=vendor, date_from=date_from, date_to=date_to)


@router.get("/filters")
async def dashboard_filter_options():
    """Returns the distinct vendors and statuses available to filter the dashboard by."""
    return get_dashboard_filter_options()


@router.get("/stats")
async def dashboard_stats(status: Optional[str] = Query(None), vendor: Optional[str] = Query(None), date_from: Optional[str] = Query(None), date_to: Optional[str] = Query(None)):
    """Returns high-level summary statistics, optionally filtered."""
    return get_dashboard_stats(_filters(status, vendor, date_from, date_to))


@router.get("/volume")
async def monthly_volume(status: Optional[str] = Query(None), vendor: Optional[str] = Query(None), date_from: Optional[str] = Query(None), date_to: Optional[str] = Query(None)):
    """Returns monthly invoice volume for charts, optionally filtered."""
    return get_monthly_invoice_volume(_filters(status, vendor, date_from, date_to))


@router.get("/status-breakdown")
async def status_breakdown(vendor: Optional[str] = Query(None), date_from: Optional[str] = Query(None), date_to: Optional[str] = Query(None)):
    """Returns document counts grouped by status, optionally filtered."""
    return get_status_breakdown(_filters(None, vendor, date_from, date_to))


@router.get("/vendors")
async def top_vendors(status: Optional[str] = Query(None), date_from: Optional[str] = Query(None), date_to: Optional[str] = Query(None), limit: int = Query(6, ge=1, le=50)):
    """Returns the top vendors by extracted invoice value, optionally filtered."""
    return get_top_vendors(_filters(status, None, date_from, date_to), limit=limit)


@router.get("/updates")
async def latest_updates(status: Optional[str] = Query(None), vendor: Optional[str] = Query(None), date_from: Optional[str] = Query(None), date_to: Optional[str] = Query(None), limit: int = Query(5, ge=1, le=50)):
    """Returns the latest document activity updates, optionally filtered."""
    return get_latest_updates(limit=limit, filters=_filters(status, vendor, date_from, date_to))
