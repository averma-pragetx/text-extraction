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

def update_review_decision(record_id: str, status: str, extra_remarks: Optional[List[str]] = None) -> bool:
    """Records an approve/reject decision on a document and, if provided, appends new remarks
    (e.g. the reviewer's reason for rejecting) onto the existing remarks array."""
    if status not in ["Saved", "Approved", "Rejected"]:
        logger.error(f"Invalid status value: {status}")
        return False

    collection = get_extractions_collection()
    try:
        query = {"_id": ObjectId(record_id)} if len(record_id) == 24 else {"_id": record_id}
        update: Dict[str, Any] = {"$set": {"status": status}}

        clean_remarks = [r.strip() for r in (extra_remarks or []) if r and r.strip()]
        if clean_remarks:
            update["$addToSet"] = {"remarks": {"$each": clean_remarks}}

        result = collection.update_one(query, update)
        if result.matched_count == 0:
            logger.warning(f"No extraction record found for review decision: {record_id}")
            return False

        logger.info(f"Review decision recorded for {record_id}: status={status}, added_remarks={clean_remarks}")
        return True
    except Exception as e:
        logger.error(f"Error recording review decision for {record_id}: {e}")
        return False

VENDOR_FIELD = "extraction.extracted_fields.company_name"
AMOUNT_FIELD = "extraction.extracted_fields.total_amount"

def build_dashboard_filter(
    status: Optional[str] = None,
    vendor: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> Dict[str, Any]:
    """Builds a MongoDB query filter for the extractions collection from dashboard query params."""
    query: Dict[str, Any] = {}

    if status:
        query["status"] = status

    if vendor:
        query[VENDOR_FIELD] = vendor

    created_at: Dict[str, datetime] = {}
    if date_from:
        try:
            created_at["$gte"] = datetime.strptime(date_from, "%Y-%m-%d")
        except ValueError:
            logger.warning(f"Ignoring invalid date_from value: {date_from}")
    if date_to:
        try:
            created_at["$lte"] = datetime.strptime(date_to, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        except ValueError:
            logger.warning(f"Ignoring invalid date_to value: {date_to}")
    if created_at:
        query["created_at"] = created_at

    return query

def get_dashboard_stats(filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Calculates high-level metrics for the dashboard, optionally scoped by filters."""
    collection = get_extractions_collection()
    base_filter = filters or {}
    try:
        total_docs = collection.count_documents(base_filter)
        pending_approvals = collection.count_documents({**base_filter, "status": "Saved"})
        approved_docs = collection.count_documents({**base_filter, "status": "Approved"})
        rejected_docs = collection.count_documents({**base_filter, "status": "Rejected"})

        # Calculate total value across matching invoices
        pipeline = [
            {"$match": base_filter},
            {"$group": {
                "_id": None,
                "total_value": {"$sum": f"${AMOUNT_FIELD}"}
            }}
        ]
        val_result = list(collection.aggregate(pipeline))
        total_value = val_result[0]["total_value"] if val_result else 0

        return {
            "total_documents": total_docs,
            "pending_approvals": pending_approvals,
            "approved_documents": approved_docs,
            "rejected_documents": rejected_docs,
            "total_value": round(total_value or 0, 2),
            "total_value_cr": round((total_value or 0) / 10000000, 2)  # Convert to Crores
        }
    except Exception as e:
        logger.error(f"Error fetching dashboard stats: {e}")
        return {
            "total_documents": 0,
            "pending_approvals": 0,
            "approved_documents": 0,
            "rejected_documents": 0,
            "total_value": 0,
            "total_value_cr": 0,
        }

def get_monthly_invoice_volume(filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """Aggregates invoice volume by month for the chart, optionally scoped by filters."""
    collection = get_extractions_collection()
    try:
        pipeline = [
            {"$match": filters or {}},
            {
                "$group": {
                    "_id": {"$dateToString": {"format": "%b %Y", "date": "$created_at"}},
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

def get_status_breakdown(filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """Aggregates document counts grouped by status, optionally scoped by filters."""
    collection = get_extractions_collection()
    try:
        pipeline = [
            {"$match": filters or {}},
            {"$group": {"_id": "$status", "count": {"$sum": 1}}},
            {"$project": {"_id": 0, "status": "$_id", "count": 1}},
        ]
        return list(collection.aggregate(pipeline))
    except Exception as e:
        logger.error(f"Error fetching status breakdown: {e}")
        return []

def get_top_vendors(filters: Optional[Dict[str, Any]] = None, limit: int = 6) -> List[Dict[str, Any]]:
    """Aggregates total invoice value and count grouped by vendor, optionally scoped by filters."""
    collection = get_extractions_collection()
    try:
        pipeline = [
            {"$match": filters or {}},
            {"$match": {VENDOR_FIELD: {"$nin": [None, ""]}}},
            {"$group": {
                "_id": f"${VENDOR_FIELD}",
                "value": {"$sum": f"${AMOUNT_FIELD}"},
                "count": {"$sum": 1},
            }},
            {"$sort": {"value": -1}},
            {"$limit": limit},
            {"$project": {"_id": 0, "vendor": "$_id", "value": 1, "count": 1}},
        ]
        return list(collection.aggregate(pipeline))
    except Exception as e:
        logger.error(f"Error fetching top vendors: {e}")
        return []

def get_dashboard_filter_options() -> Dict[str, List[str]]:
    """Returns the distinct vendor names and statuses available for dashboard filtering."""
    collection = get_extractions_collection()
    try:
        vendors = [v for v in collection.distinct(VENDOR_FIELD) if v]
        statuses = [s for s in collection.distinct("status") if s]
        return {"vendors": sorted(vendors), "statuses": sorted(statuses)}
    except Exception as e:
        logger.error(f"Error fetching dashboard filter options: {e}")
        return {"vendors": [], "statuses": []}

def get_latest_updates(limit: int = 5, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """Fetches the latest extraction activity for the feed, optionally scoped by filters."""
    collection = get_extractions_collection()
    try:
        records = collection.find(filters or {}).sort("created_at", -1).limit(limit)
        updates = []
        for r in records:
            fields = r.get("extraction", {}).get("extracted_fields", {}) or {}
            updates.append({
                "id": str(r["_id"]),
                "filename": r["filename"],
                "status": r.get("status", "Saved"),
                "vendor": fields.get("company_name") or "Unknown",
                "amount": fields.get("total_amount", 0),
                "timestamp": r["created_at"].isoformat()
            })
        return updates
    except Exception as e:
        logger.error(f"Error fetching latest updates: {e}")
        return []

def get_review_queue() -> List[Dict[str, Any]]:
    """Fetches all documents for the review workspace, most recent first.
    Every document is included regardless of its decision so that approved and
    rejected documents remain visible on the review page permanently, alongside
    the ones still awaiting a decision."""
    collection = get_extractions_collection()
    try:
        records = collection.find({}).sort("created_at", -1)
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
                "status": r.get("status", "Saved"),
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
