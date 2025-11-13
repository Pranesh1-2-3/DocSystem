# pranesh1-2-3/docsystem/DocSystem-ayush/ServerlessDocs/hello_world/app.py

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

# --- !! NEW MODEL FOR FILENAME UPDATE !! ---
class FilenameUpdate(BaseModel):
    new_filename: str
# --- !! END NEW MODEL !! ---


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
# (No change needed here, the frontend will send the user-defined name)
@app.post("/upload")
def create_upload(filename: str, tags: str = '[]', Authorization: str = Header(None)):
    if not Authorization:
        raise HTTPException(status_code=401, detail="Missing token")

    token = Authorization.split(" ")[1]
    claims = verify_token(token)
    user_id = claims["sub"]

    # --- !! NEW: Sanitize filename !! ---
    # Ensure filename is not empty and strip whitespace
    clean_filename = filename.strip()
    if not clean_filename:
        raise HTTPException(status_code=400, detail="Filename cannot be empty")
    # --- !! END NEW !! ---

    file_id = str(uuid.uuid4())
    key = f"{user_id}/{file_id}/{clean_filename}" # Use the clean filename

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
        "filename": clean_filename, # Store the clean filename
        "createdAt": str(int(time.time())),
        "tags": tag_list  # Store the tags
    })

    return {"uploadUrl": url, "fileId": file_id}
# --- END MODIFIED /upload ---


# --- MODIFIED /files ENDPOINT ---
# (No changes needed)
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
    # (No changes needed)
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
    # (No changes needed)
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
# (No changes needed)
# --- MODIFIED: get_ai_tags function ---
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

@app.get("/suggest-tags")
def suggest_tags(filename: str, Authorization: str = Header(None)):
    if not Authorization:
        raise HTTPException(status_code=401, detail="Missing token")
    
    # Verify token to ensure user is authenticated
    verify_token(Authorization.split(" ")[1]) 
    
    tags = get_ai_tags(filename)
    return {"tags": tags}
# --- END NEW ENDPOINT ---


# --- !! NEW: HELPER FUNCTION get_ai_name !! ---
def get_ai_name(original_filename: str) -> str:
    try:
        # Get the file extension, if it exists
        parts = original_filename.rsplit('.', 1)
        if len(parts) == 2:
            base_name = parts[0]
            extension = parts[1]
        else:
            base_name = original_filename
            extension = ""

        prompt = f"""
Human: You are an expert file naming assistant. Your job is to clean up and rename a messy file name into a clean, human-readable one.
- Keep the file extension unchanged.
- Use underscores (_) instead of spaces or hyphens.
- Convert to lowercase with underscores (e.g., "my_document").
- Remove special characters, timestamps, or junk.
- The new name should be descriptive.

Here are some examples:
- Original: "IMG_8821_v2 (copy).jpg" -> "img_8821.jpg"
- Original: "final_presentation_v3_draft-Ayush.pptx" -> "final_presentation.pptx"
- Original: "2025-01-20_Invoice-CLIENT.pdf" -> "invoice_client_2025.pdf"
- Original: "Student Report card 2024.docx" -> "student_report_card_2024.docx"
- Original: "screenshot 2025-11-12 at 11.30.45 AM.png" -> "screenshot.png"

Now, rename this file (keep the extension '{extension}'):
Original: "{original_filename}"

Assistant:"""

        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 100,
            "temperature": 0.2,
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
        suggested_name = response_body.get("content", [{}])[0].get("text", "").strip()

        # Final check: ensure the extension is still there if it's supposed to be
        if extension and not suggested_name.endswith(f".{extension}"):
            # If the model forgot the extension, add it back.
            # Clean up the model output first (remove extra quotes, etc.)
            clean_base = suggested_name.rsplit('.', 1)[0].strip().replace('"', '')
            return f"{clean_base}.{extension}"

        if suggested_name:
            return suggested_name.replace('"', '') # Clean up quotes
            
    except Exception as e:
        print(f"Bedrock name suggestion failed: {e}. Falling back to original name.")
    
    # Fallback to the original name if AI fails
    return original_filename
# --- !! END HELPER FUNCTION !! ---


# --- !! NEW ENDPOINT: /suggest-name !! ---
@app.get("/suggest-name")
def suggest_name(filename: str, Authorization: str = Header(None)):
    if not Authorization:
        raise HTTPException(status_code=401, detail="Missing token")
    
    # Verify token to ensure user is authenticated
    verify_token(Authorization.split(" ")[1]) 
    
    # Get the AI-suggested name
    suggested_name = get_ai_name(filename)
    
    return {"suggested_name": suggested_name}
# --- !! END NEW ENDPOINT !! ---


# --- NEW ENDPOINT: /files/{fileId}/tags ---
@app.put("/files/{fileId}/tags")
def update_tags(fileId: str, tags_update: TagsUpdate, Authorization: str = Header(None)):
    # (No changes needed)
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


# --- !! NEW ENDPOINT: /files/{fileId}/rename !! ---
@app.put("/files/{fileId}/rename")
def rename_file(fileId: str, update: FilenameUpdate, Authorization: str = Header(None)):
    if not Authorization:
        raise HTTPException(status_code=401, detail="Missing token")

    token = Authorization.split(" ")[1]
    claims = verify_token(token)
    user_id = claims["sub"]

    # 1. Get current file data from DDB
    resp = table.get_item(Key={"userId": user_id, "fileId": fileId})
    item = resp.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="File not found")

    old_filename = item.get("filename", "unknown")
    new_filename = update.new_filename.strip()

    if not new_filename:
         raise HTTPException(status_code=400, detail="New filename cannot be empty")

    if old_filename == new_filename:
        # No change needed
        return {"message": "Filename is unchanged", "fileId": fileId, "filename": new_filename}

    # 2. Rename in S3 (Copy + Delete)
    old_key = f"{user_id}/{fileId}/{old_filename}"
    new_key = f"{user_id}/{fileId}/{new_filename}"

    try:
        s3.copy_object(
            Bucket=BUCKET,
            CopySource={'Bucket': BUCKET, 'Key': old_key},
            Key=new_key
        )
        s3.delete_object(Bucket=BUCKET, Key=old_key)
    except Exception as e:
        print(f"Error renaming in S3: {e}")
        # If S3 fails, we should NOT update DynamoDB.
        raise HTTPException(status_code=500, detail=f"Failed to rename file in S3: {e}")

    # 3. Update filename in DynamoDB
    try:
        table.update_item(
            Key={"userId": user_id, "fileId": fileId},
            UpdateExpression="SET filename = :f",
            ExpressionAttributeValues={":f": new_filename}
        )
        return {"message": "File renamed successfully", "fileId": fileId, "filename": new_filename}
    except Exception as e:
        print(f"Error updating DynamoDB: {e}")
        # This is an inconsistent state, but we must report the error.
        raise HTTPException(status_code=500, detail="S3 rename OK, but failed to update database.")
# --- !! END NEW ENDPOINT !! ---