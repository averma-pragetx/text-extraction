# PaddleOCR Spatial Layout Reconstructor & Extraction Pipeline

A high-performance system designed to extract text from semi-structured documents (invoices, receipts, purchase orders) while preserving their original spatial layout. The project combines advanced OCR techniques with an agentic LLM pipeline to perform semantic reasoning and financial metrics extraction.

---

## 🚀 Key Features

- **Dual-Pipeline Architecture**:
  - **Local CLI Tool**: Batch process files into plain text layouts (`.txt`) and structured JSON.
  - **Full-Stack Web App**: Interactive React dashboard with a FastAPI backend for real-time document analysis.
- **Spatial Layout Reconstruction**: Maps irregular OCR bounding boxes onto a consistent character canvas grid to maintain visual alignments (columns, tables, etc.).
- **Agentic LLM Extraction**: Utilizes a 4-agent pipeline (Scanner, OCR, Structurer, LLM) to extract key financial fields like **Budget at Completion (BAC)**, **Actual Cost (AC)**, and **Variance**.
- **Multi-Format Support**: Processes images (`.png`, `.jpg`, `.jpeg`, `.bmp`, `.tiff`) and multi-page `.pdf` files.
- **Dynamic PDF Rasterization**: Uses PyMuPDF for high-fidelity rendering at configurable DPI.
- **Real-time Processing**: WebSocket-based progress tracking for document extraction.

---

## 🛠️ Tech Stack

### Backend & LLM
- **Framework**: FastAPI
- **OCR Engine**: PaddleOCR
- **PDF Processing**: PyMuPDF (fitz)
- **LLM Service**: Standalone FastAPI service running Qwen3-1.7B
- **Machine Learning**: PyTorch, Transformers
- **Database**: MongoDB (via PyMongo)
- **Environment**: Python 3.10+

### Frontend
- **Framework**: React (Vite)
- **Icons**: Lucide React
- **Charts**: Recharts
- **Styling**: Custom CSS Design System

---

## 📦 Installation

### Prerequisites
- **Python 3.10 or higher**
- **Node.js 18 or higher** (with npm or yarn)
- **MongoDB** (Local or Atlas instance)

### 1. LLM Service Setup
1. Navigate to the llm directory:
   ```bash
   cd llm
   ```
2. Create and activate a virtual environment, then install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### 2. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file in the `backend/` directory:
   ```env
   MONGODB_URI=mongodb://localhost:27017
   LLM_SERVICE_URL=http://localhost:5000/infer
   ```

### 3. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

---

## 🖥️ Usage

### Running the Web Application
1. **Start the LLM Service**:
   ```bash
   cd llm
   python main.py
   ```
   The LLM service will be available at `http://localhost:5000`.

2. **Start the Backend**:
   ```bash
   cd backend
   python main.py
   ```
   The API will be available at `http://localhost:8000`.

3. **Start the Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```
   Open your browser to `http://localhost:5173`.

### Running the Local CLI Tool
To batch process documents locally without the web interface:
```bash
cd backend
python invoice_extraction.py --width 120 --tolerance 10 --confidence 0.5 --dpi 250
```
*Note: You can modify the `HARDCODED_INPUT` and `HARDCODED_OUTPUT` paths within `invoice_extraction.py` to point to your local directories.*

---

## 🏗️ Architecture

The system follows a modular agentic design:
1. **ScannerAgent**: Handles document loading and PDF-to-image conversion.
2. **OCRAgent**: Executes PaddleOCR to retrieve text and coordinates.
3. **StructurerAgent**: Employs the `SpatialLayoutReconstructor` to map tokens to a 2D grid.
4. **LLMAgent**: Uses the Qwen3 model to parse the reconstructed layout and extract semantic fields in JSON format.

For more technical details, refer to the [ARCHITECTURE.md](./ARCHITECTURE.md) file.

---

## 📊 Financial Metrics
The system is specifically tuned to identify:
- **Budget at Completion (BAC)**
- **Actual Cost (AC)**
- **Variance (BAC - AC)**
- **Line Items**: Description, Quantity, Unit Price, and Amount.

---

## 🛡️ License
[Insert License Information Here]
