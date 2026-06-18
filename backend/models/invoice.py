from pydantic import BaseModel, Field, BeforeValidator
from typing import Annotated, Optional, Dict, Any, List
from datetime import datetime

from .metadata import InvoiceMetadataSchema
from .extracted_fields import ExtractedFieldsSchema

# Custom type to validate/convert PyMongo ObjectId to a string representation in API schemas
PyObjectId = Annotated[str, BeforeValidator(str)]

class InvoiceCreate(BaseModel):
    """Schema representing the input payload when saving a newly processed invoice."""
    document_name: str
    metadata: InvoiceMetadataSchema
    extraction: Dict[str, Any]  # Storing the raw JSON output from the LLM agent
    extracted_fields: Optional[ExtractedFieldsSchema] = None
    s3: Optional[Dict[str, Any]] = None
    remarks: Optional[List[str]] = []

class InvoiceSchema(BaseModel):
    """Full schema representation of an invoice saved in MongoDB, including database ID."""
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    document_name: str
    metadata: InvoiceMetadataSchema
    extraction: Dict[str, Any]
    extracted_fields: Optional[ExtractedFieldsSchema] = None
    s3: Optional[Dict[str, Any]] = None
    remarks: Optional[List[str]] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
