from dataclasses import dataclass
from typing import Optional

@dataclass
class LayoutConfig:
    """Configuration for OCR and layout reconstruction."""
    output_width: int = 80
    row_tolerance: int = 10
    min_confidence: float = 0.5
    pdf_dpi: int = 100
