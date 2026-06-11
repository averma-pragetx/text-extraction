import os
import json
import glob
import logging
import time
from datetime import datetime
from dataclasses import asdict
from typing import List, Dict, Tuple, Optional, Any

import numpy as np
from PIL import Image
from pypdf import PdfReader
import fitz  # PyMuPDF

from .layout_config import LayoutConfig
from .spatial_reconstructor import SpatialLayoutReconstructor

logger = logging.getLogger(__name__)

class DocumentProcessor:
    """Handles file-level processing for images and PDFs with metric tracking."""
    
    def __init__(self, reconstructor: SpatialLayoutReconstructor, output_dir: str):
        self.reconstructor = reconstructor
        self.output_dir = output_dir
        self.config = reconstructor.config

    def identify_target_pages(self, pdf_path: str) -> List[int]:
        """
        Scans the document structure and identifies pages to process.
        Currently returns all pages by default.
        """
        try:
            reader = PdfReader(pdf_path)
            total_pages = len(reader.pages)
            logger.info(f"  [INFO] Document structure scanned. Total pages: {total_pages}")
            return list(range(1, total_pages + 1))
        except Exception as e:
            logger.error(f"  [ERROR] Failed to scan PDF structure: {e}")
            return []

    def process_image(self, image_path: str) -> Dict[str, Any]:
        """Processes a single image file and returns metrics."""
        start_time = time.time()
        stem = os.path.splitext(os.path.basename(image_path))[0]
        
        try:
            with Image.open(image_path) as img:
                img_np = np.array(img.convert("RGB"))
        except Exception as e:
            logger.error(f"  [ERROR] Failed to open image: {e}")
            return {"error": str(e)}

        lines, json_rows, n = self.reconstructor.ocr_page(img_np)
        
        if not lines:
            return {"pages": 1, "blocks": 0, "time": time.time() - start_time, "warn": "No text detected"}

        json_data = {
            "meta": self._generate_meta(image_path, 1, n),
            "pages": [{
                "page": 1,
                "source": image_path,
                "block_count": n,
                "rows": json_rows
            }]
        }
        
        txt_path, json_path = self._save_results(stem, lines, json_data, 1, n)
        
        return {
            "pages": 1,
            "blocks": n,
            "time": time.time() - start_time,
            "txt_path": txt_path,
            "json_path": json_path
        }

    def process_pdf(self, pdf_path: str) -> Dict[str, Any]:
        """Processes a multi-page PDF file using PyMuPDF and returns metrics."""
        start_time = time.time()
        stem = os.path.splitext(os.path.basename(pdf_path))[0]

        target_pages = self.identify_target_pages(pdf_path)
        if not target_pages:
            return {"error": "No target pages identified or file is invalid"}

        all_txt = []
        json_pages = []
        total_blk = 0

        try:
            doc = fitz.open(pdf_path)
            
            # Calculate zoom factor from DPI (fitz default is 72 DPI)
            zoom = self.config.pdf_dpi / 72
            matrix = fitz.Matrix(zoom, zoom)

            for page_num in target_pages:
                logger.info(f"    [PAGE {page_num}] Extracting text...")
                
                # fitz uses 0-based indexing for pages
                page = doc.load_page(page_num - 1)
                pix = page.get_pixmap(matrix=matrix, colorspace=fitz.csRGB)
                
                # Convert pixmap to numpy array (RGB)
                img_np = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
                
                lines, json_rows, n = self.reconstructor.ocr_page(img_np)
                total_blk += n

                sep = "=" * self.config.output_width
                all_txt += ["", sep, f"  PAGE {page_num}  |  {n} blocks detected", sep, ""]
                all_txt.extend(lines if lines else ["  [no text detected on this page]"])

                json_pages.append({
                    "page": page_num,
                    "source": pdf_path,
                    "block_count": n,
                    "rows": json_rows
                })
                logger.info(f"    [PAGE {page_num}] OK: {n} blocks")
                
            doc.close()

        except Exception as e:
            logger.error(f"  [ERROR] PDF processing failed: {e}")
            return {"error": str(e)}

        if not json_pages:
            return {"pages": len(target_pages), "blocks": 0, "time": time.time() - start_time, "warn": "No pages processed"}

        json_data = {
            "meta": self._generate_meta(pdf_path, len(target_pages), total_blk),
            "pages": json_pages
        }
        
        txt_path, json_path = self._save_results(stem, all_txt, json_data, len(target_pages), total_blk)
        
        return {
            "pages": len(target_pages),
            "blocks": total_blk,
            "time": time.time() - start_time,
            "txt_path": txt_path,
            "json_path": json_path
        }

    def _generate_meta(self, src: str, pages: int, blocks: int) -> Dict[str, Any]:
        """Creates metadata for the extraction run."""
        meta = asdict(self.config)
        meta.update({
            "source": src,
            "parsed_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "page_count": pages,
            "total_blocks": blocks
        })
        return meta

    def _save_results(self, stem: str, txt_lines: List[str], json_data: Dict, page_count: int, n_blocks: int) -> Tuple[str, str]:
        """Saves text and JSON outputs and returns their paths."""
        os.makedirs(self.output_dir, exist_ok=True)
        
        txt_path = os.path.join(self.output_dir, f"{stem}.txt")
        json_path = os.path.join(self.output_dir, f"{stem}.json")
        
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write("\n".join(txt_lines))
            
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(json_data, f, indent=2, ensure_ascii=False)
            
        return txt_path, json_path

def collect_inputs(input_path: Optional[str]) -> List[Tuple[str, str]]:
    """Gathers image and PDF files from the specified path."""
    if not input_path or not os.path.exists(input_path):
        return []
        
    inputs = []
    if os.path.isfile(input_path):
        ftype = "pdf" if input_path.lower().endswith(".pdf") else "image"
        inputs.append((ftype, input_path))
    elif os.path.isdir(input_path):
        # Images
        for ext in ("*.png", "*.jpg", "*.jpeg", "*.bmp", "*.tiff", "*.tif"):
            for f in sorted(glob.glob(os.path.join(input_path, ext))):
                inputs.append(("image", f))
        # PDFs
        for f in sorted(glob.glob(os.path.join(input_path, "*.pdf"))):
            inputs.append(("pdf", f))
            
    return inputs
