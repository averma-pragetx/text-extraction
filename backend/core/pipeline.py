import logging
import os
import time
import json
import re
import ast
import requests
from threading import Thread
from paddleocr import PaddleOCR
from utils.layout_config import LayoutConfig
from utils.spatial_reconstructor import SpatialLayoutReconstructor
import fitz  # PyMuPDF
import psutil
from typing import Optional, Any, Dict, List, Tuple, Callable
from PIL import Image
import numpy as np
import io 

# Configure Logging
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger("epcflow")

def get_ram_usage():
    return psutil.Process(os.getpid()).memory_info().rss / (1024 * 1024)

class ScannerAgent:
    def __init__(self, dpi: int):
        self.dpi = dpi

    def scan(self, fpath: Optional[str], ftype: str, content: Optional[bytes] = None):
        start_time = time.time()
        source_name = os.path.basename(fpath) if fpath else "In-Memory Stream"
        logger.info(f"\n[SCANNER] Initializing scan for: {source_name}")
        logger.info(f"[SCANNER] Type: {ftype.upper()} | DPI: {self.dpi} | Source: {'Disk' if fpath else 'Memory'}")
        
        if ftype == "image":
            # Support both path and bytes
            img_source = fpath if fpath else io.BytesIO(content)
            with Image.open(img_source) as img:
                img_np = np.array(img.convert("RGB"))
                logger.info(f"[SCANNER] Image loaded. Resolution: {img_np.shape[1]}x{img_np.shape[0]}")
                yield (1, img_np)
        elif ftype == "pdf":
            # Support both path and bytes (stream parameter)
            if fpath:
                doc = fitz.open(fpath)
            else:
                doc = fitz.open(stream=content, filetype="pdf")
                
            total_pages = len(doc)
            logger.info(f"[SCANNER] PDF opened. Total pages: {total_pages}")
            
            zoom = self.dpi / 72
            matrix = fitz.Matrix(zoom, zoom)
            for i in range(total_pages):
                page_start = time.time()
                page = doc.load_page(i)
                pix = page.get_pixmap(matrix=matrix, colorspace=fitz.csRGB)
                img_np = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
                logger.info(f"[SCANNER]   → Rasterized Page {i+1}/{total_pages} ({time.time()-page_start:.2f}s)")
                yield (i + 1, img_np)
            doc.close()
        
        logger.info(f"[SCANNER] Scan complete in {time.time()-start_time:.2f}s")

class OCRAgent:
    def __init__(self, model: PaddleOCR):
        self.ocr = model

    def _get_detections(self, page_res: Any) -> List[Tuple[List, Tuple[str, float]]]:
        """Robustly extracts detections from various OCR result formats."""
        if isinstance(page_res, list):
            return page_res
        if isinstance(page_res, dict):
            polys = page_res.get('dt_polys', [])
            texts = page_res.get('rec_texts', [])
            scores = page_res.get('rec_scores', [])
            return list(zip(polys, zip(texts, scores)))
        return []

    def extract(self, page_num: int, img_np: np.ndarray) -> Any:
        start_time = time.time()
        logger.info(f"[OCR] Detecting text on Page {page_num}...")
        
        img_bgr = img_np[:, :, ::-1].copy()
        result = self.ocr.ocr(img_bgr)
        
        page_res = result[0] if result else None
        detections = self._get_detections(page_res)
        
        if detections:
            word_count = len(detections)
            # Safely calculate confidence
            confs = []
            for det in detections:
                try:
                    # det[1] is (text, score)
                    confs.append(det[1][1])
                except (IndexError, TypeError):
                    continue
            
            avg_conf = sum(confs) / len(confs) if confs else 0
            logger.info(f"[OCR] Extracted {word_count} text blocks (Conf: {avg_conf*100:.1f}%) in {time.time()-start_time:.2f}s")
        else:
            logger.warning(f"[OCR] No text detected on Page {page_num}")
            
        return page_res

class StructurerAgent:
    def __init__(self, reconstructor: SpatialLayoutReconstructor):
        self.reconstructor = reconstructor

    def structure(self, page_num: int, ocr_raw_res: Any, fpath: str) -> Dict[str, Any]:
        start_time = time.time()
        logger.info(f"[STRUCTURER] Reconstructing layout for Page {page_num}...")
        
        blocks, ix_min, ix_max = self.reconstructor._extract_valid_blocks(ocr_raw_res)
        if not blocks:
            logger.warning("[STRUCTURER] No valid blocks found for reconstruction")
            return {"page": page_num, "source": fpath, "block_count": 0, "rows": []}
            
        iw = max(ix_max - ix_min, 1.0)
        rows = self.reconstructor._cluster_into_rows(blocks)
        output_lines = self.reconstructor._render_lines(rows, ix_min, iw)
        
        logger.info(f"[STRUCTURER] Mapped {len(blocks)} blocks into {len(output_lines)} logical rows ({time.time()-start_time:.2f}s)")
        
        return {
            "page": page_num,
            "source": fpath,
            "block_count": len(blocks),
            "rows": [{"row": idx + 1, "rendered_line": rendered} for idx, rendered in enumerate(output_lines)]
        }

class LLMAgent:
    def __init__(self, service_url=None):
        self.service_url = service_url or os.getenv("LLM_SERVICE_URL")
        logger.info(f"[LLM] Using remote service: {self.service_url}")

    def _extract_full_text(self, full_ocr_json: Dict[str, Any]) -> str:
        full_text = ""
        for page in full_ocr_json.get("pages", []):
            full_text += f"\n--- Page {page.get('page')} ---\n"
            for row in page.get("rows", []):
                full_text += row.get("rendered_line", "") + "\n"
        return full_text

    def _fallback_extract_fields(self, full_text: str) -> Dict[str, Any]:
        """Creates a usable extraction from OCR rows when the LLM fails."""
        lines = [
            re.sub(r"\s+", " ", line).strip()
            for line in full_text.splitlines()
            if line.strip() and not line.strip().startswith("--- Page")
        ]
        fields: Dict[str, Any] = {}
        items = []

        label_patterns = {
            "invoice_number": r"\b(?:invoice|inv|bill|receipt)\s*(?:no|number|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9#/-]+)",
            "receipt_number": r"\b(NV#\s*[A-Z0-9/-]+|#[A-Z0-9/-]{5,})\b",
            "invoice_date": r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b",
            "time_stamp": r"\b(\d{1,2}:\d{2}(?::\d{2})?)\b",
            "gst_id": r"\bGST\s*(?:ID|NO|REG)?\s*[:#-]?\s*([0-9]{6,})\b",
            "contact_number": r"\b(\+?\d[\d\s-]{7,}\d)\b",
            "feedback_link": r"\b((?:www\.)?[a-z0-9-]+\.[a-z]{2,}(?:\.[a-z]{2,})?)\b",
        }

        for line in lines:
            lower = line.lower()
            for key, pattern in label_patterns.items():
                if key not in fields:
                    match = re.search(pattern, line, flags=re.IGNORECASE)
                    if match:
                        fields[key] = match.group(1).strip()
                        if key == "receipt_number":
                            fields.setdefault("invoice_number", fields[key])

            money_match = re.search(r"(?<!\d)(\d+(?:\.\d{2}))(?!\d)\s*$", line)
            qty_item_match = re.match(r"^(\d+)\s+(.+?)\s+(\d+(?:\.\d{2}))$", line)
            if qty_item_match:
                items.append({
                    "quantity": int(qty_item_match.group(1)),
                    "item_name": qty_item_match.group(2).strip(),
                    "price": float(qty_item_match.group(3)),
                })
                continue

            if money_match:
                amount = float(money_match.group(1))
                if any(token in lower for token in ("total", "amount due", "balance")):
                    fields.setdefault("total_amount", amount)
                elif "cash" in lower or "tender" in lower:
                    fields.setdefault("cash_tendered", amount)
                elif "change" in lower:
                    fields.setdefault("change", amount)
                elif "gst" in lower or "tax" in lower:
                    fields.setdefault("total_includes_gst", amount)

            if "hotline" in lower or "customer service" in lower:
                phone = re.search(label_patterns["contact_number"], line, flags=re.IGNORECASE)
                if phone:
                    fields.setdefault("customer_service_hotline", phone.group(1).strip())

            if ":" in line:
                key, value = line.split(":", 1)
                key = re.sub(r"[^a-z0-9]+", "_", key.lower()).strip("_")
                value = value.strip()
                if key and value:
                    fields.setdefault(key, value)

        if lines:
            fields.setdefault("company_name", lines[0])
        if len(lines) > 1 and "company_name" in fields:
            fields.setdefault("address", " ".join(lines[1:4]))
        if items:
            fields["items"] = items

        return {"extracted_fields": fields}

    def infer(self, full_ocr_json: Dict[str, Any], callback: Optional[Callable] = None) -> Dict[str, Any]:
        start_time = time.time()
        logger.info(f"\n[LLM] Calling remote reasoning engine...")
        
        try:
            response = requests.post(self.service_url, json={"ocr_json": full_ocr_json}, timeout=120)
            response.raise_for_status()
            logger.info(f"[LLM] Inference complete in {time.time()-start_time:.2f}s")
            return response.json()
        except Exception as e:
            logger.error(f"[LLM] Remote inference failed: {e}")
            logger.warning("[LLM] Falling back to deterministic OCR field extraction")
            full_text = self._extract_full_text(full_ocr_json)
            return self._fallback_extract_fields(full_text)

    def normalize_extraction(self, extraction: Dict[str, Any]) -> Dict[str, Any]:
        """Keep the final extraction payload focused on document fields only."""
        if not isinstance(extraction, dict):
            return {"extracted_fields": {}}

        extracted_fields = extraction.get("extracted_fields")
        if not isinstance(extracted_fields, dict):
            wrapper_keys = {"metadata", "meta", "headers", "line_items", "status"}
            extracted_fields = {
                key: value
                for key, value in extraction.items()
                if key not in wrapper_keys
            }

        if "line_items" in extraction and "line_items" not in extracted_fields:
            extracted_fields["line_items"] = extraction["line_items"]

        return {"extracted_fields": extracted_fields}

class PipelineManager:
    def __init__(self, dpi: int = 100):
        logger.info("\n[PIPELINE] Initializing Multi-Agent System...")
        self.ocr_engine = PaddleOCR(lang="en", enable_mkldnn=False)
        self.config = LayoutConfig(pdf_dpi=dpi)
        self.reconstructor = SpatialLayoutReconstructor(self.config, self.ocr_engine)
        self.scanner = ScannerAgent(dpi=dpi)
        self.ocr_agent = OCRAgent(model=self.ocr_engine)
        self.structurer = StructurerAgent(reconstructor=self.reconstructor)
        self.use_llm = os.getenv("USE_LLM_EXTRACTION", "true").lower() in {"1", "true", "yes"}
        self.llm_agent = LLMAgent() if self.use_llm else LLMAgent.__new__(LLMAgent)
        if self.use_llm:
            logger.info("[PIPELINE] LLM extraction enabled")
        else:
            logger.info("[PIPELINE] LLM extraction disabled by USE_LLM_EXTRACTION; using deterministic OCR field extraction")
        logger.info(f"[PIPELINE] Ready. RAM Usage: {get_ram_usage():.2f} MB\n")

    def process_file(self, fpath: Optional[str] = None, status_callback: Optional[Callable[[str, int, str], None]] = None, content: Optional[bytes] = None, filename: Optional[str] = None) -> Dict[str, Any]:
        pipeline_start = time.time()
        fname = filename or (os.path.basename(fpath) if fpath else "unknown_document")
        ext = os.path.splitext(fname)[1].lower()
        ftype = "pdf" if ext == ".pdf" else "image"
        
        logger.info("="*60)
        logger.info(f"PROCESSING JOB: {fname}")
        logger.info("="*60)

        if status_callback: status_callback("scanning", 10, "Scanning document structure...")
        page_images = list(self.scanner.scan(fpath, ftype, content=content))
        total_pages = len(page_images)
        
        document_pages_data = []
        total_blocks = 0
        
        for i, (page_num, img_np) in enumerate(page_images):
            progress = 10 + int((i / total_pages) * 40)
            if status_callback: status_callback("ocr", progress, f"OCR processing page {page_num}/{total_pages}...")
            
            raw_ocr = self.ocr_agent.extract(page_num, img_np)
            if raw_ocr:
                page_data = self.structurer.structure(page_num, raw_ocr, fname)
                document_pages_data.append(page_data)
                total_blocks += page_data["block_count"]

        full_doc_json = {
            "meta": {
                "source": fname, 
                "page_count": total_pages, 
                "total_blocks": total_blocks,
                "parsed_at": time.strftime("%Y-%m-%d %H:%M:%S")
            },
            "pages": document_pages_data
        }

        if self.use_llm:
            if status_callback: status_callback("inferring", 70, "Reasoning with LLM...")
            final_result = self.llm_agent.normalize_extraction(self.llm_agent.infer(full_doc_json))
        else:
            if status_callback: status_callback("inferring", 70, "Extracting structured fields...")
            full_text = self.llm_agent._extract_full_text(full_doc_json)
            final_result = self.llm_agent.normalize_extraction(self.llm_agent._fallback_extract_fields(full_text))
        
        logger.info("\n" + "="*60)
        logger.info(f"JOB COMPLETE: {fname}")
        logger.info(f"Total Duration: {time.time()-pipeline_start:.2f}s")
        logger.info(f"Total Blocks: {total_blocks} | Pages: {total_pages}")
        logger.info(f"RAM Usage: {get_ram_usage():.2f} MB")
        logger.info("="*60 + "\n")
        
        return {
            "metadata": full_doc_json["meta"], 
            "extraction": final_result
        }
