import logging
import os
import time
import json
import torch
import numpy as np
from typing import List, Dict, Tuple, Any
from PIL import Image
from transformers import AutoModelForCausalLM, AutoTokenizer, TextIteratorStreamer
from threading import Thread
from paddleocr import PaddleOCR
from utils.layout_config import LayoutConfig
from utils.spatial_reconstructor import SpatialLayoutReconstructor
import fitz  # PyMuPDF
import psutil

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(message)s'
)
logger = logging.getLogger(__name__)

# Helper Functions for Resource Monitoring
def get_ram_usage():
    """Returns the current RAM usage of the process in MB."""
    return psutil.Process(os.getpid()).memory_info().rss / (1024 * 1024)

def log_metric(agent: str, action: str, start_time: float, start_ram: float):
    """Logs the time and RAM metrics for a specific step."""
    end_time = time.time()
    end_ram = get_ram_usage()
    duration = end_time - start_time
    ram_delta = end_ram - start_ram
    logger.info(f"  [METRIC] {agent} | {action} | Time: {duration:.2f}s | RAM: {end_ram:.2f}MB (Delta: {ram_delta:+.2f}MB)")

# Intel CPU Optimization
torch.set_num_threads(6) # Optimized for i5-1334U (mix of P and E cores)

# =============================================================================
# AGENT 1: DOCUMENT SCANNER AGENT
# =============================================================================
class ScannerAgent:
    """Analyzes document structure and prepares page images for processing."""
    
    def __init__(self, dpi: int):
        self.dpi = dpi

    def scan(self, fpath: str, ftype: str):
        """Identifies pages and yields them one by one (Memory Efficient)."""
        logger.info(f"  [AGENT 1: SCANNER] Scanning document: {os.path.basename(fpath)}")
        t_start = time.time()
        r_start = get_ram_usage()
        
        if ftype == "image":
            try:
                with Image.open(fpath) as img:
                    img_np = np.array(img.convert("RGB"))
                    yield (1, img_np)
                logger.info(f"  [AGENT 1: SCANNER] OK - Single image detected")
            except Exception as e:
                logger.error(f"  [AGENT 1: SCANNER] Error: {e}")
        
        elif ftype == "pdf":
            try:
                doc = fitz.open(fpath)
                total_pages = len(doc)
                logger.info(f"  [AGENT 1: SCANNER] OK - PDF detected with {total_pages} pages")
                
                zoom = self.dpi / 72
                matrix = fitz.Matrix(zoom, zoom)
                
                for i in range(total_pages):
                    page = doc.load_page(i)
                    pix = page.get_pixmap(matrix=matrix, colorspace=fitz.csRGB)
                    img_np = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
                    yield (i + 1, img_np)
                doc.close()
            except Exception as e:
                logger.error(f"  [AGENT 1: SCANNER] Error: {e}")
        
        log_metric("AGENT 1", "Scanning", t_start, r_start)

# =============================================================================
# AGENT 2: OCR EXTRACTION AGENT
# =============================================================================
class OCRAgent:
    """Extracts raw text and bounding boxes using PaddleOCR."""
    
    def __init__(self, model: PaddleOCR):
        self.ocr = model

    def extract(self, page_num: int, img_np: np.ndarray) -> Any:
        """Runs OCR and logs the total character count."""
        logger.info(f"  [AGENT 2: OCR] Extracting text from Page {page_num}...")
        t_start = time.time()
        r_start = get_ram_usage()
        
        # PaddleOCR expects BGR
        img_bgr = img_np[:, :, ::-1].copy()
        result = self.ocr.ocr(img_bgr)
        
        if not result or not result[0]:
            logger.info(f"  [AGENT 2: OCR] Page {page_num}: 0 characters extracted (No text found)")
            log_metric("AGENT 2", f"OCR Page {page_num}", t_start, r_start)
            return None
            
        page_res = result[0]
        
        # Calculate character count
        total_chars = 0
        if isinstance(page_res, list):
            for _, (text, _) in page_res:
                total_chars += len(text.strip())
        elif isinstance(page_res, dict):
            texts = page_res.get('rec_texts', [])
            total_chars = sum(len(t.strip()) for t in texts)
            
        logger.info(f"  [AGENT 2: OCR] Page {page_num}: {total_chars} characters extracted")
        log_metric("AGENT 2", f"OCR Page {page_num}", t_start, r_start)
        return page_res

# =============================================================================
# AGENT 3: LAYOUT STRUCTURER AGENT
# =============================================================================
class StructurerAgent:
    """Organizes raw OCR data into a spatial JSON format."""
    
    def __init__(self, reconstructor: SpatialLayoutReconstructor):
        self.reconstructor = reconstructor

    def structure(self, page_num: int, ocr_raw_res: Any, fpath: str) -> Dict[str, Any]:
        """Converts raw OCR results into structured spatial rows."""
        logger.info(f"  [AGENT 3: STRUCTURER] Mapping spatial layout for Page {page_num}...")
        t_start = time.time()
        r_start = get_ram_usage()
        
        blocks, ix_min, ix_max = self.reconstructor._extract_valid_blocks(ocr_raw_res)
        
        if not blocks:
            log_metric("AGENT 3", f"Structuring Page {page_num}", t_start, r_start)
            return {"page": page_num, "source": fpath, "block_count": 0, "rows": []}

        iw = max(ix_max - ix_min, 1.0)
        rows = self.reconstructor._cluster_into_rows(blocks)
        output_lines = self.reconstructor._render_lines(rows, ix_min, iw)
        
        json_rows = [
            {"row": idx + 1, "rendered_line": rendered}
            for idx, rendered in enumerate(output_lines)
        ]

        logger.info(f"  [AGENT 3: STRUCTURER] OK - Structured into {len(json_rows)} rows")
        log_metric("AGENT 3", f"Structuring Page {page_num}", t_start, r_start)
        return {
            "page": page_num,
            "source": fpath,
            "block_count": len(blocks),
            "rows": json_rows
        }

# =============================================================================
# AGENT 4: LLM INFERENCE AGENT
# =============================================================================
class LLMAgent:
    """Uses LLM to reason and extract final fields from structured data."""
    
    def __init__(self, model_id="Qwen/Qwen3-1.7B"):
        logger.info(f"  [AGENT 4: LLM] Loading model: {model_id} (CPU Mode)...")
        t_start = time.time()
        r_start = get_ram_usage()
        
        self.tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
        
        # Use bfloat16 for faster CPU inference on Intel 13th Gen
        dtype = torch.bfloat16

        self.model = AutoModelForCausalLM.from_pretrained(
            model_id,
            device_map="cpu",
            torch_dtype=dtype,
            trust_remote_code=True,
            low_cpu_mem_usage=True
        )
        log_metric("AGENT 4", "Model Load", t_start, r_start)
        logger.info(f"  [AGENT 4: LLM] OK - Model ready ({dtype})")

    def infer(self, full_ocr_json: Dict[str, Any]) -> Dict[str, Any]:
        """Runs LLM reasoning and returns the final output as JSON."""
        logger.info(f"  [AGENT 4: LLM] Reasoning over document structure...")
        t_start = time.time()
        r_start = get_ram_usage()
        
        # Build text prompt from all structured pages
        full_text = ""
        for page in full_ocr_json.get("pages", []):
            full_text += f"\n--- Page {page.get('page')} ---\n"
            for row in page.get("rows", []):
                full_text += row.get("rendered_line", "") + "\n"

        system_instruction = "Extract OCR to JSON. No reasoning or thinking fields. Output ONLY JSON."

        user_prompt = f"Convert OCR to JSON. No 'thought' fields.\n\nOCR:\n{full_text}\n\nFORMAT:\n{{'extracted_fields': {{...}}}}"

        messages = [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_prompt}
        ]
        
        text = self.tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        model_inputs = self.tokenizer([text], return_tensors="pt").to("cpu")
        input_token_count = model_inputs.input_ids.shape[1]

        # Set up streamer for real-time feedback
        streamer = TextIteratorStreamer(self.tokenizer, skip_prompt=True, skip_special_tokens=True)
        
        generate_kwargs = dict(
            **model_inputs,
            streamer=streamer,
            max_new_tokens=1024,
            do_sample=True,
            temperature=0.5,
            top_p=0.9
        )

        # Start generation in a separate thread
        thread = Thread(target=self.model.generate, kwargs=generate_kwargs)
        thread.start()

        response_text = ""
        for new_text in streamer:
            response_text += new_text
        
        # Wait for thread to finish
        thread.join()
        
        # Parse result
        try:
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            final_data = json.loads(response_text[json_start:json_end])
        except:
            final_data = {"raw_output": response_text}
        
        log_metric("AGENT 4", "Inference", t_start, r_start)
        return final_data

# =============================================================================
# PIPELINE MANAGER (SINGLETON)
# =============================================================================
class PipelineManager:
    def __init__(self, dpi: int = 100):
        self.dpi = dpi
        self.config = LayoutConfig(pdf_dpi=self.dpi)
        
        logger.info(f"\n[SYSTEM] Initializing Backend Pipeline Tools...")
        # Disabling MKLDNN to fix NotImplementedError with PIR executor on Windows
        self.ocr_engine = PaddleOCR(lang="en", enable_mkldnn=False)
        self.reconstructor = SpatialLayoutReconstructor(self.config, self.ocr_engine)
        
        # Initialize Agents
        self.scanner = ScannerAgent(dpi=self.dpi)
        self.ocr_agent = OCRAgent(model=self.ocr_engine)
        self.structurer = StructurerAgent(reconstructor=self.reconstructor)
        self.llm_agent = LLMAgent()
        
        logger.info(f"[SYSTEM] Pipeline ready. RAM Usage: {get_ram_usage():.2f}MB")

    def process_file(self, fpath: str) -> Dict[str, Any]:
        """Orchestrates the full extraction pipeline for a single file."""
        fname = os.path.basename(fpath)
        ext = os.path.splitext(fname)[1].lower()
        ftype = "pdf" if ext == ".pdf" else "image"
        
        logger.info(f"\n[WORKFLOW] Starting extraction for: {fname}")
        file_start = time.time()
        
        # 1. Scan
        page_images = list(self.scanner.scan(fpath, ftype))
        
        document_pages_data = []
        total_blocks = 0
        
        # 2 & 3. OCR and Structuring
        for page_num, img_np in page_images:
            raw_ocr = self.ocr_agent.extract(page_num, img_np)
            if raw_ocr:
                page_data = self.structurer.structure(page_num, raw_ocr, fpath)
                document_pages_data.append(page_data)
                total_blocks += page_data["block_count"]

        full_doc_json = {
            "meta": {
                "source": fname,
                "parsed_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                "page_count": len(page_images),
                "total_blocks": total_blocks
            },
            "pages": document_pages_data
        }

        # 4. LLM Inference
        final_result = self.llm_agent.infer(full_doc_json)
        
        file_duration = time.time() - file_start
        logger.info(f"[OK] {fname} processed in {file_duration:.2f}s")
        
        return {
            "metadata": full_doc_json["meta"],
            "extraction": final_result
        }
