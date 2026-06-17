from pydantic import BaseModel

class InvoiceMetadataSchema(BaseModel):
    """Schema for visual and parsing metadata of the document extraction process."""
    source: str
    parsed_at: str
    page_count: int
    total_blocks: int
