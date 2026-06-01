import logging
import argparse
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
from utils.document_processor import collect_inputs
import fitz  # PyMuPDF

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(message)s'
)
logger = logging.getLogger(__name__)

# =============================================================================
# AGENT 1: DOCUMENT SCANNER AGENT
# =============================================================================
class ScannerAgent:
    """Analyzes document structure and prepares page images for processing."""
    
    def __init__(self, dpi: int):
        self.dpi = dpi

    def scan(self, fpath: str, ftype: str) -> List[Tuple[int, np.ndarray]]:
        """Identifies pages and returns them as a list of (page_num, image_np)."""
        logger.info(f"  [AGENT 1: SCANNER] Scanning document: {os.path.basename(fpath)}")
        pages = []
        
        if ftype == "image":
            try:
                with Image.open(fpath) as img:
                    img_np = np.array(img.convert("RGB"))
                    pages.append((1, img_np))
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
                    pages.append((i + 1, img_np))
                doc.close()
            except Exception as e:
                logger.error(f"  [AGENT 1: SCANNER] Error: {e}")
                
        return pages

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
        
        # PaddleOCR expects BGR
        img_bgr = img_np[:, :, ::-1].copy()
        result = self.ocr.ocr(img_bgr)
        
        if not result or not result[0]:
            logger.info(f"  [AGENT 2: OCR] Page {page_num}: 0 characters extracted (No text found)")
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
        
        blocks, ix_min, ix_max = self.reconstructor._extract_valid_blocks(ocr_raw_res)
        
        if not blocks:
            return {"page": page_num, "source": fpath, "block_count": 0, "rows": []}

        iw = max(ix_max - ix_min, 1.0)
        rows = self.reconstructor._cluster_into_rows(blocks)
        output_lines = self.reconstructor._render_lines(rows, ix_min, iw)
        
        json_rows = [
            {"row": idx + 1, "rendered_line": rendered}
            for idx, rendered in enumerate(output_lines)
        ]

        logger.info(f"  [AGENT 3: STRUCTURER] OK - Structured into {len(json_rows)} rows")
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
        self.tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
        
        # CPU Optimization: Try bfloat16 for speed, fallback to float32
        # Note: bfloat16 is often faster on modern CPUs with AVX-512
        dtype = torch.float32
        try:
            # Check if bfloat16 is likely to work/be faster
            if torch.cuda.is_available():
                dtype = torch.bfloat16
        except:
            pass

        self.model = AutoModelForCausalLM.from_pretrained(
            model_id,
            device_map="cpu",
            torch_dtype=dtype,
            trust_remote_code=True
        )
        logger.info(f"  [AGENT 4: LLM] OK - Model ready ({dtype})")

    def infer_and_save(self, full_ocr_json: Dict[str, Any], output_path: str):
        """Runs LLM reasoning and saves the final output."""
        logger.info(f"  [AGENT 4: LLM] Reasoning over document structure...")
        
        # Build text prompt from all structured pages
        full_text = ""
        for page in full_ocr_json.get("pages", []):
            full_text += f"\n--- Page {page.get('page')} ---\n"
            for row in page.get("rows", []):
                full_text += row.get("rendered_line", "") + "\n"

        system_instruction = (
            "You are an expert document analyzer. Your task is to extract all meaningful fields "
            "from the provided OCR text and return them in a structured JSON format. "
            "Use your thinking mode to reason about the spatial layout and field-value relationships."
        )

        user_prompt = (
            f"Analyze the following OCR text and extract all fields into a valid JSON object. "
            f"Include a 'thinking' field in your response for your reasoning process.\n\n"
            f"OCR TEXT:\n{full_text}\n\n"
            f"OUTPUT FORMAT:\n{{\"thinking\": \"...\", \"extracted_fields\": {{...}}}}"
        )

        messages = [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_prompt}
        ]
        
        text = self.tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        model_inputs = self.tokenizer([text], return_tensors="pt").to("cpu")

        # Set up streamer for real-time feedback
        streamer = TextIteratorStreamer(self.tokenizer, skip_prompt=True, skip_special_tokens=True)
        
        generate_kwargs = dict(
            **model_inputs,
            streamer=streamer,
            max_new_tokens=1024, # Optimized token limit for faster extraction
            do_sample=True,
            temperature=0.7,
            top_p=0.9
        )

        # Start generation in a separate thread
        thread = Thread(target=self.model.generate, kwargs=generate_kwargs)
        thread.start()

        print("\n--- LLM Reasoning & Extraction (Live Feed) ---")
        response_text = ""
        for new_text in streamer:
            print(new_text, end="", flush=True)
            response_text += new_text
        print("\n----------------------------------------------\n")
        
        # Wait for thread to finish
        thread.join()

        # Parse and Save
        try:
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            final_data = json.loads(response_text[json_start:json_end])
        except:
            final_data = {"raw_output": response_text}

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(final_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"  [AGENT 4: LLM] OK - Final extraction saved to: {os.path.basename(output_path)}")

# =============================================================================
# ORCHESTRATOR
# =============================================================================
def main():
    parser = argparse.ArgumentParser(description="Agentic Document Extraction Workflow")
    parser.add_argument("--input", "-i", default="./input", help="Path to input files")
    parser.add_argument("--output", "-o", default="./output", help="Directory for output")
    parser.add_argument("--dpi", type=int, default=250, help="DPI for PDF scan")
    parser.add_argument("--skip-llm", action="store_true", help="Skip LLM agent")
    args = parser.parse_args()

    # Configuration
    config = LayoutConfig(pdf_dpi=args.dpi)
    os.makedirs(args.output, exist_ok=True)

    # Initialize Backend Tools
    ocr_engine = PaddleOCR(lang="en", enable_mkldnn=False)
    reconstructor = SpatialLayoutReconstructor(config, ocr_engine)

    # Initialize Agents
    scanner = ScannerAgent(dpi=args.dpi)
    ocr_agent = OCRAgent(model=ocr_engine)
    structurer = StructurerAgent(reconstructor=reconstructor)
    llm_agent = None if args.skip_llm else LLMAgent()

    inputs = collect_inputs(args.input)
    logger.info(f"\n[WORKFLOW] Starting Agentic Pipeline for {len(inputs)} files\n")

    workflow_start = time.time()

    for idx, (ftype, fpath) in enumerate(inputs, 1):
        file_start = time.time()
        fname = os.path.basename(fpath)
        logger.info(f"{'='*60}\nFILE {idx}/{len(inputs)}: {fname}\n{'='*60}")
        
        # Agent 1: Scan
        t1_start = time.time()
        page_images = scanner.scan(fpath, ftype)
        t1_end = time.time()
        logger.info(f"  [METRIC] Agent 1 (Scanner) took: {t1_end - t1_start:.2f}s")
        
        document_pages_data = []
        total_blocks = 0
        
        t2_total = 0.0
        t3_total = 0.0

        # Process each page through Agent 2 & 3
        for page_num, img_np in page_images:
            # Agent 2: OCR
            t2_start = time.time()
            raw_ocr = ocr_agent.extract(page_num, img_np)
            t2_total += (time.time() - t2_start)
            
            # Agent 3: Structure
            if raw_ocr:
                t3_start = time.time()
                page_data = structurer.structure(page_num, raw_ocr, fpath)
                t3_total += (time.time() - t3_start)
                
                document_pages_data.append(page_data)
                total_blocks += page_data["block_count"]

        logger.info(f"  [METRIC] Agent 2 (OCR) took: {t2_total:.2f}s (Total for {len(page_images)} pages)")
        logger.info(f"  [METRIC] Agent 3 (Structurer) took: {t3_total:.2f}s (Total for {len(page_images)} pages)")

        # Final Document Metadata
        full_doc_json = {
            "meta": {
                "source": fpath,
                "parsed_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                "page_count": len(page_images),
                "total_blocks": total_blocks
            },
            "pages": document_pages_data
        }

        # Save Intermediate OCR Result
        ocr_out_path = os.path.join(args.output, f"{os.path.splitext(fname)[0]}.json")
        with open(ocr_out_path, 'w', encoding='utf-8') as f:
            json.dump(full_doc_json, f, indent=2, ensure_ascii=False)
        logger.info(f"  [WORKFLOW] Intermediate layout JSON saved.")

        # Agent 4: LLM Inference
        if llm_agent:
            t4_start = time.time()
            final_out_path = os.path.join(args.output, f"{os.path.splitext(fname)[0]}_final.json")
            llm_agent.infer_and_save(full_doc_json, final_out_path)
            t4_end = time.time()
            logger.info(f"  [METRIC] Agent 4 (LLM) took: {t4_end - t4_start:.2f}s")

        file_duration = time.time() - file_start
        logger.info(f"\n[OK] File {idx} complete in {file_duration:.2f}s\n")

    workflow_duration = time.time() - workflow_start
    logger.info(f"{'='*60}\n[WORKFLOW COMPLETE] Total Pipeline Time: {workflow_duration:.2f}s\n{'='*60}")

if __name__ == "__main__":
    main()
