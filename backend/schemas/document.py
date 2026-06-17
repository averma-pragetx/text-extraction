from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class DocumentStatus(BaseModel):
    file_id: str
    filename: str
    status: str  # pending, scanning, ocr, structuring, inferring, completed, failed
    progress: int
    message: str
    timestamp: datetime = datetime.now()

class ExtractionResult(BaseModel):
    file_id: str
    metadata: Dict[str, Any]
    extraction: Dict[str, Any]

class SavedExtractionCreate(BaseModel):
    filename: str
    original_name: Optional[str] = None
    raw_json: Dict[str, Any]
