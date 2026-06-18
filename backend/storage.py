import os
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from dotenv import load_dotenv

try:
    import boto3
    from botocore.exceptions import BotoCoreError, ClientError
    from botocore.config import Config
except ImportError:  # pragma: no cover - handled at runtime with a clear error
    boto3 = None
    BotoCoreError = ClientError = Exception
    Config = None


current_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(current_dir, ".env")
parent_env_path = os.path.join(os.path.dirname(current_dir), ".env")

if os.path.exists(env_path):
    load_dotenv(env_path)
elif os.path.exists(parent_env_path):
    load_dotenv(parent_env_path)


AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")
S3_BUCKET = os.getenv("AWS_S3_BUCKET")
S3_PREFIX = os.getenv("AWS_S3_PREFIX", "documents").strip("/")


def _require_s3_config() -> None:
    if boto3 is None:
        raise RuntimeError("boto3 is not installed. Add boto3 to backend requirements and install dependencies.")
    if not S3_BUCKET:
        raise RuntimeError("AWS_S3_BUCKET or S3_BUCKET_NAME is not configured in the backend environment.")


def get_s3_client():
    _require_s3_config()
    # Explicitly force SigV4 and ensure virtual-host addressing for newer regions
    config = Config(
        region_name=AWS_REGION,
        signature_version='s3v4',
        s3={'addressing_style': 'virtual'}
    )
    return boto3.client("s3", region_name=AWS_REGION, config=config)


def build_s3_key(filename: str) -> str:
    # Replace spaces and other problematic characters with underscores
    # This prevents encoding mismatches in pre-signed URLs
    safe_filename = os.path.basename(filename).replace(" ", "_").replace("\\", "_").replace("/", "_")
    date_path = datetime.utcnow().strftime("%Y/%m/%d")
    unique_name = f"{uuid.uuid4()}_{safe_filename}"
    return f"{S3_PREFIX}/{date_path}/{unique_name}" if S3_PREFIX else f"{date_path}/{unique_name}"


def upload_document_to_s3(
    content: bytes,
    filename: str,
    content_type: Optional[str] = None,
) -> Dict[str, Any]:
    """Uploads the original document to S3 and returns reference metadata."""
    s3 = get_s3_client()
    key = build_s3_key(filename)

    extra_args = {}
    if content_type:
        extra_args["ContentType"] = content_type

    try:
        s3.put_object(
            Bucket=S3_BUCKET,
            Key=key,
            Body=content,
            **extra_args,
        )
    except (BotoCoreError, ClientError) as exc:
        raise RuntimeError(f"Failed to upload document to S3: {exc}") from exc

    return {
        "bucket": S3_BUCKET,
        "key": key,
        "region": AWS_REGION,
        "content_type": content_type,
        "size_bytes": len(content),
        "original_filename": filename,
        "uploaded_at": datetime.utcnow().isoformat(),
        "uri": f"s3://{S3_BUCKET}/{key}",
    }


def delete_document_from_s3(s3_metadata: Optional[Dict[str, Any]]) -> bool:
    """Deletes a stored S3 document when metadata is available."""
    if not s3_metadata:
        return False

    bucket = s3_metadata.get("bucket")
    key = s3_metadata.get("key")
    if not bucket or not key:
        return False

    s3 = get_s3_client()
    try:
        s3.delete_object(Bucket=bucket, Key=key)
        return True
    except (BotoCoreError, ClientError):
        return False


def generate_s3_presigned_url(s3_metadata: Optional[Dict[str, Any]], expires_in: int = 3600) -> Optional[str]:
    """Generates a pre-signed URL for viewing the S3 document."""
    if not s3_metadata:
        return None

    bucket = s3_metadata.get("bucket")
    key = s3_metadata.get("key")
    if not bucket or not key:
        return None

    s3 = get_s3_client()
    try:
        url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=expires_in,
        )
        return url
    except (BotoCoreError, ClientError):
        return None
