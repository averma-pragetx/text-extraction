import os
import shutil
import uuid
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pipeline import PipelineManager

app = FastAPI(title="Document Extraction API")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Pipeline Manager (will load models on startup)
# Note: This might take a few minutes as it loads LLM & OCR models
pipeline = PipelineManager()

UPLOAD_DIR = "temp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/")
async def root():
    return {"message": "Document Extraction API is running"}

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/extract")
async def extract_document(file: UploadFile = File(...)):
    # Validate file type
    if not is_allowed_file(file.filename):
        raise HTTPException(status_code=400, detail="Invalid file type. Supported: PDF, PNG, JPG")

    # Save file temporarily
    ext = os.path.splitext(file.filename)[1].lower()
    file_id = str(uuid.uuid4())
    temp_file_path = os.path.join(UPLOAD_DIR, f"{file_id}{ext}")
    
    try:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Run pipeline
        result = pipeline.process_file(temp_file_path)
        
        return result
    
    except Exception as e:
        print(f"Error during extraction: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        # Cleanup temp file
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
