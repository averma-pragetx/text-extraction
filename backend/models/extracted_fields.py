from pydantic import BaseModel
from typing import Optional, List

class LineItemSchema(BaseModel):
    """Schema for individual line items in an invoice."""
    description: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    amount: Optional[float] = None

class ExtractedFieldsSchema(BaseModel):
    """Schema for structured financial and identifier metrics parsed from the document."""
    budget_at_completion: Optional[float] = None
    actual_cost: Optional[float] = None
    variance: Optional[float] = None
    invoice_number: Optional[str] = None
    date: Optional[str] = None
    vendor_name: Optional[str] = None
    line_items: Optional[List[LineItemSchema]] = None
    total_amount: Optional[float] = None
