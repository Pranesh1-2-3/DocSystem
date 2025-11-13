from fastapi import FastAPI, Header, HTTPException
from mangum import Mangum
import boto3, uuid, time, json, requests
from jose import jwt, jwk
from jose.utils import base64url_decode
from fastapi.middleware.cors import CORSMiddleware

# --- NEW IMPORTS ---
from pydantic import BaseModel
from typing import List, Optional
from boto3.dynamodb.conditions import Key
# --- END NEW IMPORTS ---

# --- NEW: Add bedrock-runtime client ---
# Use the same region as your stack. Update if needed.
bedrock_runtime = boto3.client("bedrock-runtime", region_name="ap-south-1") 
# --- END NEW ---


app = FastAPI()
lambda_handler = Mangum(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

s3 = boto3.client("s3")
ddb = boto3.resource("dynamodb")
table = ddb.Table("CloudDocsFiles")
BUCKET = "clouddocs-uploads-bucket"

COGNITO_REGION = "ap-south-1"
USER_POOL_ID = "ap-south-1_pdj11qvfs"
JWKS_URL = f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{USER_POOL_ID}/.well-known/jwks.json"
JWKS = requests.get(JWKS_URL).json()


# --- NEW PYDANTIC MODEL ---
class TagsUpdate(BaseModel):
    tags: List[str]
# --- END NEW MODEL ---


def verify_token(token: str):
    try:
        headers = jwt.get_unverified_header(token)
        kid = headers["kid"]
        key = next(k for k in JWKS["keys"] if k["kid"] == kid)
        public_key = jwk.construct(key)

        message, encoded_sig = token.rsplit(".", 1)
        decoded_sig = base64url_decode(encoded_sig.encode())

        if not public_key.verify(message.encode(), decoded_sig):
            raise HTTPException(status_code=401, detail="Signature verification failed")

        claims = jwt.get_unverified_claims(token)
        if time.time() > claims["exp"]:
            raise HTTPException(status_code=401, detail="Token expired")

        return claims
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


@app.get("/")
def home():
    return {"message": "CloudDocs backend running with Cognito!"}


# --- MODIFIED /upload ENDPOINT ---
@app.post("/upload")
def create_upload(filename: str, tags: str = '[]', Authorization: str = Header(None)):
    if not Authorization:
        raise HTTPException(status_code=401, detail="Missing token")

    token = Authorization.split(" ")[1]
    claims = verify_token(token)
    user_id = claims["sub"]

    file_id = str(uuid.uuid4())
    key = f"{user_id}/{file_id}/{filename}"

    url = s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": BUCKET, "Key": key},
        ExpiresIn=600
    )
    
    try:
        tag_list = json.loads(tags)
        if not isinstance(tag_list, list):
            tag_list = []
    except json.JSONDecodeError:
        tag_list = []

    table.put_item(Item={
        "userId": user_id,
        "fileId": file_id,
        "filename": filename,
        "createdAt": str(int(time.time())),
        "tags": tag_list  # Store the tags
    })

    return {"uploadUrl": url, "fileId": file_id}
# --- END MODIFIED /upload ---


# --- MODIFIED /files ENDPOINT ---
@app.get("/files")
def list_files(Authorization: str = Header(None)):
    if not Authorization:
        raise HTTPException(status_code=401, detail="Missing token")

    token = Authorization.split(" ")[1]
    claims = verify_token(token)
    user_id = claims["sub"]

    # Query DynamoDB instead of listing S3
    try:
        resp = table.query(
            KeyConditionExpression=Key('userId').eq(user_id)
        )
        items = resp.get("Items", [])
        
        # Handle pagination
        while 'LastEvaluatedKey' in resp:
            resp = table.query(
                KeyConditionExpression=Key('userId').eq(user_id),
                ExclusiveStartKey=resp['LastEvaluatedKey']
            )
            items.extend(resp.get('Items', []))

        # Format the files as expected by the frontend
        files = []
        for item in items:
            files.append({
                "fileId": item["fileId"],
                "filename": item.get("filename", "unknown"),
                "createdAt": item.get("createdAt", "0"),
                "tags": item.get("tags", []) # Return tags
            })
            
        # Sort by creation date, descending
        files.sort(key=lambda x: int(x['createdAt']), reverse=True)
        
        return files
        
    except Exception as e:
        print(f"Error querying DynamoDB: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch files from database")
# --- END MODIFIED /files ---


@app.delete("/delete")
def delete_file(fileId: str, Authorization: str = Header(None)):
    if not Authorization:
        raise HTTPException(status_code=401, detail="Missing token")

    token = Authorization.split(" ")[1]
    claims = verify_token(token)
    user_id = claims["sub"]

    # Fetch file info from DynamoDB
    resp = table.get_item(Key={"userId": user_id, "fileId": fileId})
    item = resp.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="File not found")

    key = f"{user_id}/{fileId}/{item['filename']}"

    # Delete from S3
    s3.delete_object(Bucket=BUCKET, Key=key)

    # Delete from DynamoDB
    table.delete_item(Key={"userId": user_id, "fileId": fileId})

    return {"message": "File deleted successfully"}


@app.get("/download")
def get_download_link(fileId: str, Authorization: str = Header(None)):
    if not Authorization:
        raise HTTPException(status_code=401, detail="Missing token")

    token = Authorization.split(" ")[1]
    claims = verify_token(token)
    user_id = claims["sub"]

    # Fetch the file from DynamoDB
    item = table.get_item(Key={"userId": user_id, "fileId": fileId}).get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="File not found")

    key = f"{user_id}/{fileId}/{item['filename']}"

    url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": BUCKET, "Key": key},
        ExpiresIn=600  
    )

    return {"downloadUrl": url}


# --- NEW ENDPOINT: /suggest-tags ---
# --- MODIFIED: get_ai_tags function ---
# This function now attempts to use a real LLM (Bedrock) and falls back to rules
def get_ai_tags(filename: str) -> List[str]:
    
    # --- NEW: Try calling Bedrock (e.g., Claude Haiku) ---
    try:
        # NOTE: This requires the Lambda's IAM role to have 'bedrock:InvokeModel' permissions
        # for the 'anthropic.claude-3-haiku-20240307-v1:0' model.
        # You must add this permission to your Lambda role in template.yaml or the AWS console.
        
        prompt = f"""
Human: You are an intelligent file organization assistant.
Suggest 2-3 short, relevant, lowercase tags for a file based on its name.
The file is named: "{filename}"
Provide only a comma-separated list of tags.
For example:
File: "Invoice_2025_Jan.pdf" -> finance, invoice
File: "Team_Photo_Vinhack.jpg" -> event, media, photo
File: "ProjectProposal_Ayush2025.docx" -> project, proposal

Assistant:"""

        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 50,
            "temperature": 0.1,
            "messages": [
                {
                    "role": "user",
                    "content": [{"type": "text", "text": prompt}]
                }
            ]
        })
        
        response = bedrock_runtime.invoke_model(
            body=body, 
            modelId="anthropic.claude-3-haiku-20240307-v1:0",
            contentType="application/json",
            accept="application/json"
        )
        
        response_body = json.loads(response.get("body").read())
        raw_tags = response_body.get("content", [{}])[0].get("text", "")
        
        # Clean up the LLM output
        tags = [tag.strip().lower() for tag in raw_tags.split(",") if tag.strip()]
        
        if tags:
            return list(set(tags))[:3] # Return unique, lowercase tags, max 3
            
    except Exception as e:
        # Fallback to rule-based logic if Bedrock fails (e.g., permissions, timeout)
        print(f"Bedrock call failed: {e}. Falling back to rule-based tags.")
    # --- END NEW ---

    # --- FALLBACK: Rule-based logic from previous version ---
    filename_lower = filename.lower()
    tags = set()
    
    # By extension
    if any(ext in filename_lower for ext in [".pdf"]):
        tags.add("pdf")
    if any(ext in filename_lower for ext in [".doc", ".docx"]):
        tags.add("document")
    if any(ext in filename_lower for ext in [".xls", ".xlsx"]):
        tags.add("spreadsheet")
    if any(ext in filename_lower for ext in [".jpg", ".jpeg", ".png", ".svg"]):
        tags.add("image")
    if any(ext in filename_lower for ext in [".zip", ".rar", ".7z"]):
        tags.add("archive")
    if any(ext in filename_lower for ext in [".py", ".js", ".html", ".css", ".java"]):
        tags.add("code")
    
    # By keyword (from user examples)
    if "invoice" in filename_lower:
        tags.add("finance")
        tags.add("invoice")
    if "proposal" in filename_lower:
        tags.add("project")
        tags.add("proposal")
    if "team" in filename_lower or "photo" in filename_lower:
        tags.add("media")
    if "vinhack" in filename_lower:
        tags.add("event")
    if "ayush" in filename_lower:
        tags.add("personal")
    
    return list(tags)[:3] # Limit to 3 tags

@app.get("/suggest-tags")
def suggest_tags(filename: str, Authorization: str = Header(None)):
    if not Authorization:
        raise HTTPException(status_code=401, detail="Missing token")
    
    # Verify token to ensure user is authenticated
    verify_token(Authorization.split(" ")[1]) 
    
    tags = get_ai_tags(filename)
    return {"tags": tags}
# --- END NEW ENDPOINT ---


# --- NEW ENDPOINT: /files/{fileId}/tags ---
@app.put("/files/{fileId}/tags")
def update_tags(fileId: str, tags_update: TagsUpdate, Authorization: str = Header(None)):
    if not Authorization:
        raise HTTPException(status_code=401, detail="Missing token")

    token = Authorization.split(" ")[1]
    claims = verify_token(token)
    user_id = claims["sub"]

    # 1. Check if file exists and belongs to user
    resp = table.get_item(Key={"userId": user_id, "fileId": fileId})
    item = resp.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="File not found")

    # 2. Update the item with new tags
    try:
        table.update_item(
            Key={"userId": user_id, "fileId": fileId},
            UpdateExpression="SET tags = :t",
            ExpressionAttributeValues={":t": tags_update.tags}
        )
        return {"message": "Tags updated successfully", "fileId": fileId, "tags": tags_update.tags}
    except Exception as e:
        print(f"Error updating tags: {e}")
        raise HTTPException(status_code=500, detail="Failed to update tags")
# --- END NEW ENDPOINT ---