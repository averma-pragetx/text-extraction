from typing import List, Dict, Tuple, Any
import numpy as np
from paddleocr import PaddleOCR
from .layout_config import LayoutConfig

class SpatialLayoutReconstructor:
    """Handles core OCR and spatial layout reconstruction logic."""
    
    def __init__(self, config: LayoutConfig, ocr_model: PaddleOCR):
        self.config = config
        self.ocr = ocr_model

    def ocr_page(self, img_np: np.ndarray) -> Tuple[List[str], List[Dict], int]:
        """Processes a single image and reconstructs its spatial layout."""
        img_bgr = img_np[:, :, ::-1].copy()
        result = self.ocr.ocr(img_bgr)

        if not result or not isinstance(result, list) or len(result) == 0:
            return [], [], 0

        # result[0] is either a list of detections (Standard) or a dict (PaddleX)
        page_res = result[0]
        if page_res is None:
            return [], [], 0

        blocks, ix_min, ix_max = self._extract_valid_blocks(page_res)
        
        if not blocks:
            return [], [], 0

        # iw is the effective width used for column mapping
        iw = max(ix_max - ix_min, 1.0)
        
        rows = self._cluster_into_rows(blocks)
        output_lines = self._render_lines(rows, ix_min, iw)
        
        json_rows = [
            {"row": idx + 1, "rendered_line": rendered}
            for idx, rendered in enumerate(output_lines)
        ]

        return output_lines, json_rows, len(blocks)

    def _extract_valid_blocks(self, page_res: Any) -> Tuple[List[Dict], float, float]:
        """Filters detections and calculates horizontal bounds from the result."""
        blocks = []
        ix_min = float("inf")
        ix_max = 0.0

        detections = []
        if isinstance(page_res, dict):
            # Handle PaddleX-style result dictionary
            polys = page_res.get('dt_polys', [])
            texts = page_res.get('rec_texts', [])
            scores = page_res.get('rec_scores', [])
            for box, text, score in zip(polys, texts, scores):
                detections.append((box, (text, score)))
        elif isinstance(page_res, list):
            # Handle standard PaddleOCR result list: [ [box, (text, score)], ... ]
            detections = page_res
        else:
            return [], ix_min, ix_max

        for box, (text, score) in detections:
            text = text.strip()
            
            if score < self.config.min_confidence or not text:
                continue
                
            # box is usually a list/array of 4 points: [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
            xs = [p[0] for p in box]
            ys = [p[1] for p in box]
            
            x_min, x_max = min(xs), max(xs)
            y_mid = (min(ys) + max(ys)) / 2.0
            
            ix_min = min(ix_min, x_min)
            ix_max = max(ix_max, x_max)
            
            blocks.append({
                "x": x_min,
                "x_max": x_max,
                "y": y_mid,
                "text": text,
                "score": score
            })
            
        return blocks, ix_min, ix_max

    def _cluster_into_rows(self, blocks: List[Dict]) -> List[List[Dict]]:
        """Groups blocks into rows based on vertical proximity."""
        blocks.sort(key=lambda b: b["y"])
        
        if not blocks:
            return []
            
        rows = []
        current_row = [blocks[0]]
        
        for b in blocks[1:]:
            if abs(b["y"] - current_row[0]["y"]) <= self.config.row_tolerance:
                current_row.append(b)
            else:
                rows.append(current_row)
                current_row = [b]
        rows.append(current_row)
        
        # Sort each row horizontally
        for row in rows:
            row.sort(key=lambda b: b["x"])
            
        return rows

    def _render_lines(self, rows: List[List[Dict]], ix_min: float, iw: float) -> List[str]:
        """Converts rows of blocks into layout-preserved strings."""
        output_lines = []
        
        def to_col(px: float) -> int:
            return int(((px - ix_min) / iw) * (self.config.output_width - 1))

        for row in rows:
            canvas = [" "] * self.config.output_width
            for b in row:
                col = to_col(b["x"])
                text = b["text"]
                # Ensure we don't overflow the canvas
                end = min(col + len(text), self.config.output_width)
                for i, ch in enumerate(text[:end - col]):
                    canvas[col + i] = ch
            output_lines.append("".join(canvas).rstrip())
            
        return output_lines
