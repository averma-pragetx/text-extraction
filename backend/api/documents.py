import os
import uuid
import shutil
import asyncio
import json
from fastapi import APIRouter, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from typing import Dict, List
from schemas.document import DocumentStatus, ExtractionResult, SavedExtractionCreate
from core.pipeline import PipelineManager
from database import (
    delete_extraction_record, 
    list_extraction_records, 
    save_extraction_record,
    get_extraction_record
)
import logging

router = APIRouter(prefix="/documents", tags=["documents"])
logger = logging.getLogger(__name__)

UPLOAD_DIR = "uploads"
RESULTS_DIR = "results"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(RESULTS_DIR, exist_ok=True)

# Hybrid Storage Configuration
MEMORY_THRESHOLD = 15 * 1024 * 1024  # 15MB
in_memory_files: Dict[str, bytes] = {}
in_memory_filenames: Dict[str, str] = {}

# Shared Pipeline Manager
pipeline = None

def get_pipeline():
    global pipeline
    if pipeline is None:
        pipeline = PipelineManager()
    return pipeline

def init_models():
    """Trigger eager loading of models."""
    logger.info("[SYSTEM] Pre-loading models...")
    get_pipeline()
    logger.info("[SYSTEM] Models loaded and ready.")

active_connections: Dict[str, List[WebSocket]] = {}

async def broadcast_status(file_id: str, status: str, progress: int, message: str, result: dict = None):
    if file_id in active_connections:
        data = {
            "file_id": file_id,
            "status": status,
            "progress": progress,
            "message": message,
            "result": result
        }
        disconnected = []
        # We make a copy of the list to iterate safely
        current_connections = list(active_connections[file_id])
        for ws in current_connections:
            try:
                await ws.send_json(data)
            except Exception:
                disconnected.append(ws)
        
        # Check again if file_id is still in active_connections before removing
        if file_id in active_connections:
            for ws in disconnected:
                if ws in active_connections[file_id]:
                    active_connections[file_id].remove(ws)
            
            # If now empty, clean up
            if not active_connections[file_id]:
                del active_connections[file_id]

@router.get("/")
async def list_documents():
    """Lists saved extraction records from MongoDB."""
    try:
        return list_extraction_records()
    except Exception as e:
        logger.error(f"Failed to list saved extraction records: {e}")
        raise HTTPException(status_code=503, detail=f"Could not read MongoDB records: {e}")

@router.get("/get/{record_id}")
async def get_document(record_id: str):
    """Fetches a single extraction record from MongoDB."""
    record = get_extraction_record(record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Saved extraction record not found")
    return record

@router.post("/save")
async def save_document(payload: SavedExtractionCreate):
    """Stores a processed document's raw JSON payload in MongoDB."""
    try:
        record_id = save_extraction_record(
            filename=payload.filename,
            original_name=payload.original_name,
            raw_json=payload.raw_json,
        )
        return {"id": record_id, "message": "Extraction JSON saved"}
    except Exception as e:
        logger.error(f"Failed to save extraction JSON: {e}")
        raise HTTPException(status_code=503, detail=f"Could not save to MongoDB: {e}")

@router.delete("/{record_id}")
async def delete_document(record_id: str):
    """Deletes a saved extraction record from MongoDB."""
    deleted = delete_extraction_record(record_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Saved extraction record not found")
    return {"id": record_id, "deleted": True}

@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    file_id = str(uuid.uuid4())
    content = await file.read()
    file_size = len(content)
    
    if file_size <= MEMORY_THRESHOLD:
        logger.info(f"[STORAGE] Storing {file.filename} ({file_size/1024/1024:.2f}MB) in MEMORY")
        in_memory_files[file_id] = content
        in_memory_filenames[file_id] = file.filename
    else:
        logger.info(f"[STORAGE] Storing {file.filename} ({file_size/1024/1024:.2f}MB) on DISK (exceeds threshold)")
        ext = os.path.splitext(file.filename)[1].lower()
        file_path = os.path.join(UPLOAD_DIR, f"{file_id}{ext}")
        with open(file_path, "wb") as buffer:
            buffer.write(content)
    
    return {"file_id": file_id, "filename": file.filename}

@router.websocket("/ws/{file_id}")
async def websocket_endpoint(websocket: WebSocket, file_id: str):
    await websocket.accept()
    if file_id not in active_connections:
        active_connections[file_id] = []
    active_connections[file_id].append(websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            if data == "start":
                asyncio.create_task(run_pipeline(file_id, asyncio.get_running_loop()))
    except WebSocketDisconnect:
        if file_id in active_connections and websocket in active_connections[file_id]:
            active_connections[file_id].remove(websocket)
            if not active_connections[file_id]:
                del active_connections[file_id]

async def run_pipeline(file_id: str, main_loop: asyncio.AbstractEventLoop):
    p = get_pipeline()
    content = in_memory_files.get(file_id)
    filename = in_memory_filenames.get(file_id)
    file_path = None
    
    if not content:
        # Check disk if not in memory
        files = [f for f in os.listdir(UPLOAD_DIR) if f.startswith(file_id)]
        if not files:
            await broadcast_status(file_id, "failed", 0, "File not found")
            return
        filename = files[0]
        file_path = os.path.join(UPLOAD_DIR, filename)

    def sync_callback(status, progress, message):
        # Schedule the async broadcast on the main event loop
        asyncio.run_coroutine_threadsafe(
            broadcast_status(file_id, status, progress, message),
            main_loop
        )

    try:
        result = await asyncio.to_thread(
            p.process_file, 
            fpath=file_path, 
            content=content, 
            filename=filename, 
            status_callback=sync_callback
        )
        
        # Save result for local final JSON output. MongoDB persistence is explicit from the UI.
        history_item = {
            "id": file_id,
            "filename": filename.split('_', 1)[-1] if '_' in filename and file_path else filename,
            "original_name": filename,
            "type": "Invoice",
            "status": "Ingested",
            "processed_at": result["metadata"].get("parsed_at", ""),
            "metadata": result["metadata"],
            "extraction": result["extraction"]
        }
        
        with open(os.path.join(RESULTS_DIR, f"{file_id}.json"), "w") as f:
            json.dump(history_item, f, indent=2)

        await broadcast_status(file_id, "completed", 100, "Processing finished", result=result)
    except Exception as e:
        logger.error(f"Pipeline error: {e}")
        await broadcast_status(file_id, "failed", 0, str(e))
    finally:
        # Cleanup Memory
        if file_id in in_memory_files:
            del in_memory_files[file_id]
            del in_memory_filenames[file_id]
            logger.info(f"[CLEANUP] Memory cleared for {file_id}")
        
        # Cleanup Disk
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
            logger.info(f"[CLEANUP] Disk file removed: {file_path}")
