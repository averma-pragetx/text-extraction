from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import documents, dashboard, review, invoice_generator
import uvicorn
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Eagerly initialize models
    documents.init_models()
    
    # Diagnostic: Print all registered routes safely
    print("\n--- Active API Routes ---")
    for route in app.routes:
        if hasattr(route, "path"):
            path = route.path
            methods = getattr(route, "methods", "WS")
            print(f"  {path} | {methods}")
        else:
            # For routers included as mounts or other types
            name = getattr(route, "name", "Unnamed")
            print(f"  [Complex Route] {name} | {type(route).__name__}")
    print("-------------------------\n")
    yield

app = FastAPI(
    title="EPCFlow Realtime API",
    description="Backend API for Document Ingestion, AI-driven Extraction, and Approval Workflow Management.",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(documents.router)
app.include_router(dashboard.router)
app.include_router(review.router)
app.include_router(invoice_generator.router)

@app.get("/")
async def root():
    return {"message": "EPCFlow Realtime API is active"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
