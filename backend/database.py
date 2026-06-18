import os
import logging
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure
from bson import ObjectId
from typing import List, Dict, Any, Optional
from datetime import datetime
from dotenv import load_dotenv

from models import InvoiceCreate

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Find the `.env` file in the current directory or parent directory
current_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(current_dir, '.env')
parent_env_path = os.path.join(os.path.dirname(current_dir), '.env')

# Load env file
if os.path.exists(env_path):
    load_dotenv(env_path)
    logger.info(f"Loaded environment variables from: {env_path}")
elif os.path.exists(parent_env_path):
    load_dotenv(parent_env_path)
    logger.info(f"Loaded environment variables from: {parent_env_path}")
else:
    logger.warning("Could not locate any .env file, using system env variables")

MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("MONGODB_DB_NAME", "text_extraction")

class MongoDBConnection:
    _client: Optional[MongoClient] = None

    @classmethod
    def get_client(cls) -> MongoClient:
        """Initializes and returns a singleton MongoClient instance."""
        if cls._client is None:
            if not MONGODB_URI:
                raise ValueError("MONGODB_URI environment variable is not set in the environment or .env file.")
            try:
                # Initialize pymongo Client with timeout
                cls._client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
                # Ping database to confirm the connection works
                cls._client.admin.command('ping')
                logger.info(f"Successfully connected to MongoDB Database: {DB_NAME}")
            except ConnectionFailure as e:
                logger.error(f"Failed to connect to MongoDB instance: {e}")
                cls._client = None
                raise e
        return cls._client

    @classmethod
    def get_db(cls):
        """Returns the target MongoDB database object."""
        client = cls.get_client()
        return client[DB_NAME]

def get_invoices_collection():
    """Gets the invoices collection reference."""
    db = MongoDBConnection.get_db()
    return db["invoices"]

def get_extractions_collection():
    """Gets the raw document extractions collection reference."""
    db = MongoDBConnection.get_db()
    return db["extractions"]

def serialize_mongo_document(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Converts MongoDB-only values into JSON-safe API values."""
    if not doc:
        return doc

    serialized = dict(doc)
    if "_id" in serialized:
        serialized["id"] = str(serialized.pop("_id"))

    for key, value in list(serialized.items()):
        if isinstance(value, datetime):
            serialized[key] = value.isoformat()
        elif isinstance(value, dict):
            serialized[key] = serialize_mongo_document(value)
        elif isinstance(value, list):
            serialized[key] = [
                serialize_mongo_document(item) if isinstance(item, dict) else item
                for item in value
            ]

    return serialized

def save_extraction_record(
    filename: str,
    raw_json: Dict[str, Any],
    original_name: Optional[str] = None,
    s3_metadata: Optional[Dict[str, Any]] = None,
    remarks: Optional[List[str]] = None,
) -> str:
    """Stores an extracted document JSON payload in MongoDB."""
    collection = get_extractions_collection()
    metadata = raw_json.get("metadata", {}) if isinstance(raw_json, dict) else {}
    extraction = raw_json.get("extraction", {}) if isinstance(raw_json, dict) else {}

    record = {
        "filename": filename,
        "original_name": original_name or filename,
        "raw_json": raw_json,
        "type": "Invoice",
        "status": "Saved",
        "processed_at": metadata.get("parsed_at", ""),
        "metadata": metadata,
        "extraction": extraction,
        "s3": s3_metadata or {},
        "remarks": remarks or [],
        "created_at": datetime.utcnow(),
    }

    result = collection.insert_one(record)
    inserted_id = str(result.inserted_id)
    logger.info(f"Extraction JSON saved successfully with Database ID: {inserted_id}")
    return inserted_id

def get_extraction_record(record_id: str) -> Optional[Dict[str, Any]]:
    """Fetches a single extraction record by MongoDB ObjectId or string ID."""
    collection = get_extractions_collection()
    logger.info(f"Fetching extraction record with ID: {record_id}")
    try:
        # Try finding by ObjectId first
        if len(record_id) == 24:
            try:
                doc = collection.find_one({"_id": ObjectId(record_id)})
                if doc:
                    logger.info(f"Found record by ObjectId: {record_id}")
                    return serialize_mongo_document(doc)
            except Exception:
                pass
        
        # Fallback to string ID search
        doc = collection.find_one({"_id": record_id})
        if doc:
            logger.info(f"Found record by string ID: {record_id}")
            return serialize_mongo_document(doc)
            
        logger.warning(f"Record not found in extractions collection: {record_id}")
        return None
    except Exception as e:
        logger.error(f"Error retrieving extraction record {record_id}: {e}")
        return None

def list_extraction_records(limit: int = 100, skip: int = 0) -> List[Dict[str, Any]]:
    """Lists saved extraction records from MongoDB."""
    collection = get_extractions_collection()
    cursor = collection.find().skip(skip).limit(limit).sort("created_at", -1)
    return [serialize_mongo_document(doc) for doc in cursor]

def delete_extraction_record(record_id: str) -> bool:
    """Deletes a saved extraction record by MongoDB ObjectId."""
    collection = get_extractions_collection()
    try:
        result = collection.delete_one({"_id": ObjectId(record_id)})
        return result.deleted_count > 0
    except Exception as e:
        logger.error(f"Error deleting extraction record {record_id}: {e}")
        return False

def update_extraction_status(record_id: str, status: str) -> bool:
    """Updates the status of a saved extraction record."""
    collection = get_extractions_collection()
    if status not in ["Saved", "Approved", "Rejected"]:
        logger.error(f"Invalid status value: {status}")
        return False
    try:
        # Try finding by ObjectId first
        query = {"_id": ObjectId(record_id)} if len(record_id) == 24 else {"_id": record_id}
        result = collection.update_one(query, {"$set": {"status": status}})
        return result.modified_count > 0
    except Exception as e:
        logger.error(f"Error updating extraction status {record_id}: {e}")
        return False

def update_extraction_remarks(record_id: str, remarks: List[str]) -> bool:
    """Updates the remarks of a saved extraction record."""
    collection = get_extractions_collection()
    try:
        query = {"_id": ObjectId(record_id)} if len(record_id) == 24 else {"_id": record_id}
        result = collection.update_one(query, {"$set": {"remarks": remarks}})
        return result.modified_count > 0
    except Exception as e:
        logger.error(f"Error updating extraction remarks {record_id}: {e}")
        return False

def get_dashboard_stats() -> Dict[str, Any]:
    """Calculates high-level metrics for the dashboard."""
    collection = get_extractions_collection()
    try:
        total_docs = collection.count_documents({})
        pending_approvals = collection.count_documents({"status": "Saved"})
        approved_docs = collection.count_documents({"status": "Approved"})
        
        # Calculate total value from approved invoices
        pipeline = [
            {"$match": {"status": "Approved"}},
            {"$group": {
                "_id": None,
                "total_value": {"$sum": "$extraction.extracted_fields.total_amount"}
            }}
        ]
        val_result = list(collection.aggregate(pipeline))
        total_value = val_result[0]["total_value"] if val_result else 0
        
        return {
            "total_documents": total_docs,
            "pending_approvals": pending_approvals,
            "approved_documents": approved_docs,
            "total_value_cr": round(total_value / 10000000, 2)  # Convert to Crores
        }
    except Exception as e:
        logger.error(f"Error fetching dashboard stats: {e}")
        return {"total_documents": 0, "pending_approvals": 0, "approved_documents": 0, "total_value_cr": 0}

def get_monthly_invoice_volume() -> List[Dict[str, Any]]:
    """Aggregates invoice volume by month for the chart."""
    collection = get_extractions_collection()
    try:
        pipeline = [
            {
                "$group": {
                    "_id": {"$dateToString": {"format": "%b", "date": "$created_at"}},
                    "v": {"$sum": 1},
                    "sort_key": {"$min": "$created_at"}
                }
            },
            {"$sort": {"sort_key": 1}},
            {"$project": {"_id": 0, "m": "$_id", "v": 1}}
        ]
        return list(collection.aggregate(pipeline))
    except Exception as e:
        logger.error(f"Error fetching monthly volume: {e}")
        return []

def get_latest_updates(limit: int = 5) -> List[Dict[str, Any]]:
    """Fetches the latest extraction activity for the feed."""
    collection = get_extractions_collection()
    try:
        records = collection.find().sort("created_at", -1).limit(limit)
        updates = []
        for r in records:
            updates.append({
                "id": str(r["_id"]),
                "filename": r["filename"],
                "status": r.get("status", "Saved"),
                "vendor": r.get("extraction", {}).get("extracted_fields", {}).get("company_name", "Unknown"),
                "amount": r.get("extraction", {}).get("extracted_fields", {}).get("total_amount", 0),
                "timestamp": r["created_at"].isoformat()
            })
        return updates
    except Exception as e:
        logger.error(f"Error fetching latest updates: {e}")
        return []

def get_review_queue() -> List[Dict[str, Any]]:
    """Fetches documents that require manual review (low confidence or flagged)."""
    collection = get_extractions_collection()
    try:
        # For now, we'll consider all 'Saved' status documents as needing review
        # In a real scenario, we might filter by a 'confidence' field if available
        records = collection.find({"status": "Saved"}).sort("created_at", -1)
        queue = []
        for r in records:
            # Calculate a mock confidence for the UI if not present
            # In production, this should come from the LLM/Extraction metadata
            confidence = r.get("extraction", {}).get("metadata", {}).get("confidence", 75)
            
            queue.append({
                "id": str(r["_id"]),
                "filename": r["filename"],
                "original_name": r.get("original_name"),
                "processed_at": r.get("created_at").isoformat(),
                "confidence": confidence,
                "type": r.get("type", "Invoice"),
                "extraction": r.get("extraction", {}),
                "remarks": r.get("remarks", []),
                "s3": r.get("s3")
            })
        return queue
    except Exception as e:
        logger.error(f"Error fetching review queue: {e}")
        return []

def save_invoice(invoice_data: InvoiceCreate) -> str:
    """
    Saves a new invoice record to MongoDB.
    Args:
        invoice_data (InvoiceCreate): The invoice validated Pydantic object.
        
    Returns:
        str: The string representation of the inserted document's ObjectId.
    """
    collection = get_invoices_collection()
    
    # Dump the Pydantic model to a dict, preserving field aliases (like _id)
    data = invoice_data.model_dump(by_alias=True)
    
    # Add record metadata timestamps
    data["created_at"] = datetime.utcnow()
    
    result = collection.insert_one(data)
    inserted_id = str(result.inserted_id)
    logger.info(f"Invoice saved successfully with Database ID: {inserted_id}")
    return inserted_id

def get_invoice_by_id(invoice_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetches a single invoice document by its string ID.
    
    Args:
        invoice_id (str): The ObjectId string.
        
    Returns:
        Optional[Dict[str, Any]]: The database document, or None if not found/error.
    """
    collection = get_invoices_collection()
    try:
        doc = collection.find_one({"_id": ObjectId(invoice_id)})
        return doc
    except Exception as e:
        logger.error(f"Error retrieving invoice by ID {invoice_id}: {e}")
        return None

def list_invoices(limit: int = 100, skip: int = 0) -> List[Dict[str, Any]]:
    """
    Lists invoice records from MongoDB with pagination.
    
    Args:
        limit (int): Maximum records to return.
        skip (int): Records to skip for paging.
        
    Returns:
        List[Dict[str, Any]]: List of matching invoice documents sorted by creation date descending.
    """
    collection = get_invoices_collection()
    cursor = collection.find().skip(skip).limit(limit).sort("created_at", -1)
    return list(cursor)

def delete_invoice(invoice_id: str) -> bool:
    """
    Deletes an invoice record by its ID.
    
    Args:
        invoice_id (str): The ObjectId string.
        
    Returns:
        bool: True if a record was deleted, False otherwise.
    """
    collection = get_invoices_collection()
    try:
        result = collection.delete_one({"_id": ObjectId(invoice_id)})
        return result.deleted_count > 0
    except Exception as e:
        logger.error(f"Error deleting invoice by ID {invoice_id}: {e}")
        return False
