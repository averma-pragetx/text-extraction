import logging
import argparse
import os
import time
from paddleocr import PaddleOCR
from utils.layout_config import LayoutConfig
from utils.spatial_reconstructor import SpatialLayoutReconstructor
from utils.document_processor import DocumentProcessor, collect_inputs

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(message)s'
)
logger = logging.getLogger(__name__)

def main():
    parser = argparse.ArgumentParser(description="PaddleOCR — Spatial Layout Reconstructor")
    
    # Path Arguments
    # parser.add_argument("--input", "-i", default="./input", help="Path to image, PDF, or directory of files")
    # parser.add_argument("--output", "-o", default="./output", help="Directory for output files")
    
    # HARDCODED PATHS FOR TESTING
    HARDCODED_INPUT = "path/to/your/input"  # <--- ENTER INPUT PATH HERE
    HARDCODED_OUTPUT = "path/to/your/output" # <--- ENTER OUTPUT PATH HERE

    # Configuration Overrides
    parser.add_argument("--width", type=int, default=120, help="Output canvas width (characters)")
    parser.add_argument("--tolerance", type=int, default=10, help="Vertical row clustering tolerance (pixels)")
    parser.add_argument("--confidence", type=float, default=0.5, help="Minimum OCR confidence threshold")
    parser.add_argument("--dpi", type=int, default=250, help="DPI for PDF conversion")

    args = parser.parse_args()

    # Default paths (backward compatibility)
    # input_path = args.input or os.getcwd() # Default to current dir if no input
    # output_dir = args.output
    
    input_path = HARDCODED_INPUT
    output_dir = HARDCODED_OUTPUT
    
    config = LayoutConfig(
        output_width=args.width,
        row_tolerance=args.tolerance,
        min_confidence=args.confidence,
        pdf_dpi=args.dpi
    )

    inputs = collect_inputs(input_path)
    if not inputs:
        logger.error(f"[ERROR] No valid image or PDF files found at: {input_path}")
        return

    # logger.info("\n  PaddleOCR — Spatial Layout Reconstructor (PyMuPDF)")
    logger.info(f"  [INFO] {len(inputs)} file(s) queued from: {input_path}")
    
    # Initialize OCR
    ocr_model = PaddleOCR(lang="en", enable_mkldnn=False)
    logger.info("[OK]  Model loaded\n")

    reconstructor = SpatialLayoutReconstructor(config, ocr_model)
    processor = DocumentProcessor(reconstructor, output_dir)

    total_start = time.time()
    for idx, (ftype, fpath) in enumerate(inputs, 1):
        fname = os.path.basename(fpath)
        logger.info(f"[{idx}/{len(inputs)}] Processing: {fname}")
        
        if ftype == "image":
            metrics = processor.process_image(fpath)
        else:
            metrics = processor.process_pdf(fpath)

        if "error" in metrics:
            logger.error(f"  [ERROR] {metrics['error']}")
        else:
            p = metrics.get("pages", 1)
            b = metrics.get("blocks", 0)
            t = metrics.get("time", 0.0)
            w = metrics.get("warn", "")
            
            log_str = f"  [OK] Pages: {p} | Blocks (Tokens): {b} | Time: {t:.2f}s"
            if w:
                log_str += f" | {w}"
            logger.info(log_str)
            logger.info(f"  [OK] Saved: {metrics.get('txt_path')}")

    total_duration = time.time() - total_start
    logger.info(f"\n  Batch Complete | Total Time: {total_duration:.2f}s")
    logger.info(f"  Outputs saved to: {os.path.abspath(output_dir)}")
    logger.info("Done")

if __name__ == "__main__":
    main()
