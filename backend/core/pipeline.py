import logging
import os
import time
import json
import torch
import io
import numpy as np
from typing import List, Dict, Tuple, Any, Callable, Optional
from PIL import Image
from transformers import AutoModelForCausalLM, AutoTokenizer, TextIteratorStreamer
from threading import Thread
from paddleocr import PaddleOCR
from utils.layout_config import LayoutConfig
from utils.spatial_reconstructor import SpatialLayoutReconstructor
import fitz  # PyMuPDF
import psutil

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
    def __init__(self, model_id="Qwen/Qwen3-1.7B"):
        self.tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
        self.model = AutoModelForCausalLM.from_pretrained(
            model_id, device_map="cpu", torch_dtype=torch.bfloat16,
            trust_remote_code=True, low_cpu_mem_usage=True
        )

    def infer(self, full_ocr_json: Dict[str, Any], callback: Optional[Callable] = None) -> Dict[str, Any]:
        start_time = time.time()
        logger.info(f"\n[LLM] Reasoning engine activated (Qwen-3)")
        
        full_text = ""
        for page in full_ocr_json.get("pages", []):
            full_text += f"\n--- Page {page.get('page')} ---\n"
            for row in page.get("rows", []):
                full_text += row.get("rendered_line", "") + "\n"

        logger.info(f"[LLM] Context size: {len(full_text)} characters")
        
        system_instruction = (
            "You are a specialized document extraction agent. "
            "Convert the provided OCR layout into a valid, strict JSON object. "
            "Output ONLY the JSON object, no preamble, no markdown blocks, and no explanation. "
            "Ensure all strings are properly escaped and commas are present. "
            "If a value is missing, use null or an empty string. "
            "Return exactly this shape: { \"extracted_fields\": { ... } }. "
            "Put only fields that are actually extracted from the document inside extracted_fields. "
            "Do not add processing metrics, completion costs, budgets, confidence values, or metadata inside extracted_fields."
        )
        user_prompt = f"Extract every visible key-value field and table/list item from this document into extracted_fields:\n\n{full_text}"

        messages = [{"role": "system", "content": system_instruction}, {"role": "user", "content": user_prompt}]
        text = self.tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        model_inputs = self.tokenizer([text], return_tensors="pt").to("cpu")
        
        logger.info(f"[LLM] Generating tokens (streaming)...")
        streamer = TextIteratorStreamer(self.tokenizer, skip_prompt=True, skip_special_tokens=True)
        # Lower temperature for higher determinism
        generate_kwargs = dict(**model_inputs, streamer=streamer, max_new_tokens=2048, do_sample=True, temperature=0.1, top_p=0.9)
        
        thread = Thread(target=self.model.generate, kwargs=generate_kwargs)
        thread.start()

        response_text = ""
        for new_text in streamer:
            response_text += new_text
        thread.join()
        
        logger.info(f"[LLM] Generation complete in {time.time()-start_time:.2f}s")
        
        # Robust JSON extraction using raw_decode to ignore trailing garbage
        try:
            # First, clean markdown blocks if they exist
            json_text = response_text.replace("```json", "").replace("```", "").strip()
            
            # Find the first '{'
            start_idx = json_text.find('{')
            if start_idx == -1:
                raise ValueError("No '{' found in response")
            
            # Use raw_decode to find the first complete JSON object starting from start_idx
            decoder = json.JSONDecoder()
            extracted_json, end_idx = decoder.raw_decode(json_text[start_idx:])
            
            logger.info("[LLM] Successfully parsed JSON object using raw_decode")
            return extracted_json
        except Exception as e:
            logger.error(f"[LLM] JSON parsing failed: {e}")
            # Log a snippet of the raw response for debugging
            logger.debug(f"[LLM] Raw Snippet: {response_text[:500]}")
            # Fallback: Return raw output wrapped in a structured object
            return {
                "extracted_fields": {
                    "raw_output_snippet": response_text[:500].strip(),
                    "error": f"JSON Parsing Error: {str(e)}"
                },
                "line_items": [],
                "status": "parsing_error"
            }

    def normalize_extraction(self, extraction: Dict[str, Any]) -> Dict[str, Any]:
        """Keep the final extraction payload focused on document fields only."""
        if not isinstance(extraction, dict):
            return {"extracted_fields": {}}

        extracted_fields = extraction.get("extracted_fields")
        if not isinstance(extracted_fields, dict):
            extracted_fields = {
                key: value
                for key, value in extraction.items()
                if key not in {"metadata", "meta", "headers", "line_items", "status"}
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
        self.llm_agent = LLMAgent()
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

        if status_callback: status_callback("inferring", 70, "Reasoning with LLM...")
        final_result = self.llm_agent.normalize_extraction(self.llm_agent.infer(full_doc_json))
        
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
