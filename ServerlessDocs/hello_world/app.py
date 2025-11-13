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
bedrock_runtime = boto3.client("bedrock-runtime", region_name="ap-south-1")
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

class ClaudeRequest(BaseModel):
    messages: list
    model: str = "anthropic.claude-3-haiku-20240307-v1:0"
    max_tokens: int = 1000
    temperature: float = 1.0
    top_p: float = 0.999
# --- MODIFIED /upload ENDPOINT ---
# (No change needed here, the frontend will send the user-defined name)
    
@app.post("/api/claude")
def call_claude_bedrock(request: ClaudeRequest, Authorization: str = Header(None)):
    """
    Proxy endpoint for Claude via AWS Bedrock
    """
    if not Authorization:
        raise HTTPException(status_code=401, detail="Missing token")

    # Verify user is authenticated
    token = Authorization.split(" ")[1]
    claims = verify_token(token)
    user_id = claims["sub"]
    
    try:
        # Prepare the request body for Bedrock
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": request.max_tokens,
            "messages": request.messages,
            "temperature": request.temperature,
            "top_p": request.top_p
        }
        
        # Call Bedrock
        response = bedrock_runtime.invoke_model(
            modelId=request.model,
            body=json.dumps(body)
        )
        
        # Parse response
        response_body = json.loads(response['body'].read())
        
        return response_body
        
    except Exception as e:
        print(f"Bedrock error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to call Bedrock: {str(e)}")
# ===== END BEDROCK ENDPOINT =====
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
    """
    Use Claude via Bedrock to suggest relevant tags for a file based on its name.
    Falls back to rule-based logic if Bedrock fails.
    """
    try:
        prompt = f"""You are an intelligent file organization assistant.
Suggest 2-3 short, relevant, lowercase tags for a file based on its name.
The file is named: "{filename}"

Provide ONLY a comma-separated list of tags with no extra text or explanation.

Examples:
- "Invoice_2025_Jan.pdf" -> finance, invoice, document
- "Team_Photo_Vinhack.jpg" -> event, photo, media
- "ProjectProposal_Ayush2025.docx" -> project, proposal, document
- "Budget_Spreadsheet_Q4.xlsx" -> finance, budget, spreadsheet
- "Meeting_Notes_Nov.txt" -> notes, meeting, document

Now suggest tags for: "{filename}" """

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
        
        print(f"Claude response for tags: {raw_tags}")
        
        # Clean up the LLM output
        # Remove any extra whitespace, quotes, or newlines
        raw_tags = raw_tags.strip().strip('"').strip("'")
        tags = [tag.strip().lower() for tag in raw_tags.split(",") if tag.strip()]
        
        if tags:
            # Return unique tags, max 3
            unique_tags = []
            for tag in tags:
                if tag not in unique_tags:
                    unique_tags.append(tag)
                if len(unique_tags) >= 3:
                    break
            return unique_tags
            
    except Exception as e:
        print(f"Bedrock call failed: {e}. Falling back to rule-based tags.")



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
    """
    Use Claude via Bedrock to suggest a cleaned-up filename.
    Falls back to the original name if Bedrock fails.
    """
    try:
        # Get the file extension, if it exists
        parts = original_filename.rsplit('.', 1)
        if len(parts) == 2:
            base_name = parts[0]
            extension = parts[1]
        else:
            base_name = original_filename
            extension = ""

        prompt = f"""You are an expert file naming assistant. Clean up this messy filename into a readable one.

Rules:
- Use underscores (_) instead of spaces
- Use lowercase
- Remove special characters, timestamps, version numbers, or junk
- Keep it descriptive and concise
- MUST keep the file extension: .{extension}

Examples:
- "IMG_8821_v2 (copy).jpg" -> "img_8821.jpg"
- "final_presentation_v3_draft-Ayush.pptx" -> "final_presentation.pptx"
- "2025-01-20_Invoice-CLIENT.pdf" -> "invoice_client.pdf"
- "Student Report card 2024.docx" -> "student_report_2024.docx"
- "screenshot 2025-11-12 at 11.30.45 AM.png" -> "screenshot.png"

Original filename: "{original_filename}"

Provide ONLY the cleaned filename with extension, nothing else."""

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
        
        print(f"Claude response for name: {suggested_name}")
        
        # Clean up the response - remove quotes, extra whitespace, newlines
        suggested_name = suggested_name.strip().strip('"').strip("'").strip()
        
        # If response has multiple lines, take the first one
        if '\n' in suggested_name:
            suggested_name = suggested_name.split('\n')[0].strip()

        # Validate the suggestion
        if suggested_name and len(suggested_name) > 0:
            # Ensure the extension is still there if it's supposed to be
            if extension and not suggested_name.lower().endswith(f".{extension.lower()}"):
                # If the model forgot the extension, add it back
                clean_base = suggested_name.rsplit('.', 1)[0].strip()
                return f"{clean_base}.{extension}"
            
            return suggested_name
            
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