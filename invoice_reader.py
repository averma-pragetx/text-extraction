from paddleocr import PaddleOCR
import os, json, glob
import numpy as np
from datetime import datetime
from PIL import Image
from pdf2image import convert_from_path
from pdf2image.exceptions import PDFInfoNotInstalledError, PDFPageCountError

# CONFIG

IMAGE_PATH   = r""
PDF_PATH     = r"D:\code\text_detection\PURCHASE ORDER.pdf"
INPUT_FOLDER = r""
OUTPUT_DIR   = r"D:\code\text_detection\ocr_output"
POPPLER_PATH = r"C:\Users\ASUS\Downloads\Release-26.02.0-0\poppler-26.02.0\Library\bin"

OUTPUT_WIDTH   = 120
ROW_TOLERANCE  = 10
MIN_CONFIDENCE = 0.5
PDF_DPI        = 250

# CORE: OCR ONE PAGE

def ocr_page(ocr, img_np):
    img_bgr = img_np[:, :, ::-1].copy()
    result  = ocr.ocr(img_bgr, cls=True)

    if not result or result[0] is None or len(result[0]) == 0:
        return [], [], 0

    blocks    = []
    ix_min    = float("inf")
    ix_max    = 0.0

    for det in result[0]:
        box, (text, score) = det[0], det[1]
        text = text.strip()
        if score < MIN_CONFIDENCE or not text:
            continue
        xs    = [p[0] for p in box]; ys = [p[1] for p in box]
        x_min = min(xs); x_max = max(xs)
        y_mid = (min(ys) + max(ys)) / 2.0
        ix_min = min(ix_min, x_min); ix_max = max(ix_max, x_max)
        blocks.append({"x": x_min, "x_max": x_max, "y": y_mid,
                        "text": text, "score": score})

    if not blocks:
        return [], [], 0

    iw = max(ix_max - ix_min, 1.0)
    def to_col(px):
        return int(((px - ix_min) / iw) * (OUTPUT_WIDTH - 1))

    blocks.sort(key=lambda b: b["y"])
    rows, cur = [], [blocks[0]]
    for b in blocks[1:]:
        if abs(b["y"] - cur[0]["y"]) <= ROW_TOLERANCE:
            cur.append(b)
        else:
            rows.append(cur); cur = [b]
    rows.append(cur)
    for row in rows:
        row.sort(key=lambda b: b["x"])

    output_lines = []
    for row in rows:
        canvas = [" "] * OUTPUT_WIDTH
        for b in row:
            col = to_col(b["x"]); text = b["text"]
            end = min(col + len(text), OUTPUT_WIDTH)
            for i, ch in enumerate(text[:end - col]):
                canvas[col + i] = ch
        output_lines.append("".join(canvas).rstrip())

    json_rows = []
    for idx, (row, rendered) in enumerate(zip(rows, output_lines)):
        json_rows.append({
            "row": idx + 1,
            "rendered_line": rendered
            
        })

    return output_lines, json_rows, len(blocks)


# PROCESS: single image

def process_image(ocr, image_path, output_dir):
    stem = os.path.splitext(os.path.basename(image_path))[0]
    print(f"\n  [IMG] {os.path.basename(image_path)}")
    try:
        img_np = np.array(Image.open(image_path).convert("RGB"))
    except Exception as e:
        print(f"  [ERROR] {e}"); return

    lines, json_rows, n = ocr_page(ocr, img_np)
    if not lines:
        print("  [WARN] No text detected."); return

    _save(output_dir, stem,
          txt_lines=lines,
          json_data={"meta": _meta(image_path, 1, n),
                     "pages": [{"page": 1, "source": image_path,
                                 "block_count": n, "rows": json_rows}]},
          page_count=1, n_blocks=n)


# PROCESS: PDF  — every page, one by one

def process_pdf(ocr, pdf_path, output_dir):
    stem = os.path.splitext(os.path.basename(pdf_path))[0]
    print(f"\n  [PDF] {os.path.basename(pdf_path)}")

    # --- get total page count ---
    try:
        from pdf2image import pdfinfo_from_path
        total_pages = pdfinfo_from_path(
            pdf_path, poppler_path=POPPLER_PATH)["Pages"]
        print(f"  [INFO] {total_pages} page(s) detected")
    except Exception:
        total_pages = None
        print("  [INFO] Page count unknown — will convert all at once")

    pop_kw = {"poppler_path": POPPLER_PATH} if POPPLER_PATH else {}

    # --- convert pages ---
    try:
        if total_pages:
            # Convert page by page: safe for large PDFs
            pil_pages = []
            for p in range(1, total_pages + 1):
                imgs = convert_from_path(
                    pdf_path, dpi=PDF_DPI,
                    first_page=p, last_page=p, **pop_kw)
                if imgs:
                    pil_pages.append((p, imgs[0]))
                else:
                    print(f"  [WARN] Page {p} returned no image — skipped")
        else:
            # fallback: all at once
            all_imgs  = convert_from_path(pdf_path, dpi=PDF_DPI, **pop_kw)
            pil_pages = [(i + 1, img) for i, img in enumerate(all_imgs)]

    except (PDFInfoNotInstalledError, PDFPageCountError) as e:
        print(f"  [ERROR] Poppler error: {e}")
        print("  [HINT]  Set POPPLER_PATH in CONFIG."); return
    except Exception as e:
        print(f"  [ERROR] PDF conversion failed: {e}"); return

    if not pil_pages:
        print("  [WARN] No pages to process."); return

    all_txt   = []
    json_pages= []
    total_blk = 0

    for page_num, pil_img in pil_pages:
        print(f"  [INFO] OCR page {page_num}/{len(pil_pages)} ...", end=" ", flush=True)
        img_np = np.array(pil_img.convert("RGB"))
        lines, json_rows, n = ocr_page(ocr, img_np)
        total_blk += n

        # page header in TXT
        sep = "=" * OUTPUT_WIDTH
        all_txt += ["", sep,
                    f"  PAGE {page_num}  |  {n} blocks detected",
                    sep, ""]
        all_txt.extend(lines if lines else ["  [no text detected on this page]"])

        json_pages.append({"page": page_num, "source": pdf_path,
                            "block_count": n, "rows": json_rows})
        print(f"{n} blocks")

    _save(output_dir, stem,
          txt_lines  = all_txt,
          json_data  = {"meta": _meta(pdf_path, len(pil_pages), total_blk),
                        "pages": json_pages},
          page_count = len(pil_pages),
          n_blocks   = total_blk)


# HELPERS


def _meta(src, pages, blocks):
    return {"source": src,
            "parsed_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "page_count": pages, "total_blocks": blocks,
            "output_width": OUTPUT_WIDTH, "row_tolerance": ROW_TOLERANCE,
            "min_confidence": MIN_CONFIDENCE, "pdf_dpi": PDF_DPI}

def _save(output_dir, stem, txt_lines, json_data, page_count, n_blocks):
    os.makedirs(output_dir, exist_ok=True)
    tp = os.path.join(output_dir, f"{stem}.txt")
    jp = os.path.join(output_dir, f"{stem}.json")
    with open(tp, "w", encoding="utf-8") as f:
        f.write("\n".join(txt_lines))
    with open(jp, "w", encoding="utf-8") as f:
        json.dump(json_data, f, indent=2, ensure_ascii=False)
    print(f"  [OK]  Pages  : {page_count}")
    print(f"  [OK]  Blocks : {n_blocks}")
    print(f"  [OK]  TXT    : {tp}")
    print(f"  [OK]  JSON   : {jp}")

def collect_inputs():
    inputs = []
    if IMAGE_PATH and os.path.isfile(IMAGE_PATH):
        t = "pdf" if IMAGE_PATH.lower().endswith(".pdf") else "image"
        inputs.append((t, IMAGE_PATH))
    if PDF_PATH and os.path.isfile(PDF_PATH):
        inputs.append(("pdf", PDF_PATH))
    if INPUT_FOLDER and os.path.isdir(INPUT_FOLDER):
        for ext in ("*.png","*.jpg","*.jpeg","*.bmp","*.tiff","*.tif"):
            for f in sorted(glob.glob(os.path.join(INPUT_FOLDER, ext))):
                inputs.append(("image", f))
        for f in sorted(glob.glob(os.path.join(INPUT_FOLDER, "*.pdf"))):
            inputs.append(("pdf", f))
    return inputs


# MAIN

if __name__ == "__main__":
    print("  PaddleOCR — Spatial Layout Reconstructor")
    print("  Images | Multi-page PDFs | Batch Folders")

    inputs = collect_inputs()
    if not inputs:
        print("[ERROR] No valid input. Set IMAGE_PATH, PDF_PATH or INPUT_FOLDER.")
        exit(1)

    print(f"[INFO] {len(inputs)} file(s) queued")
    ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
    print("[OK]  Model loaded\n")

    for idx, (ftype, fpath) in enumerate(inputs, 1):
        print(f"[{idx}/{len(inputs)}]", end="")
        if ftype == "image":
            process_image(ocr, fpath, OUTPUT_DIR)
        else:
            process_pdf(ocr, fpath, OUTPUT_DIR)

    print()
    print(f"  Outputs saved to: {OUTPUT_DIR}")
    print("Done")