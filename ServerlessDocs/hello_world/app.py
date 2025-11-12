from fastapi import FastAPI, Header, HTTPException
from mangum import Mangum
import boto3, uuid, time, json, requests
from jose import jwt, jwk
from jose.utils import base64url_decode
from fastapi.middleware.cors import CORSMiddleware

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


@app.post("/upload")
def create_upload(filename: str, Authorization: str = Header(None)):
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

    table.put_item(Item={
        "userId": user_id,
        "fileId": file_id,
        "filename": filename,
        "createdAt": str(int(time.time()))
    })

    return {"uploadUrl": url, "fileId": file_id}

@app.get("/files")
def list_files(Authorization: str = Header(None)):
    if not Authorization:
        raise HTTPException(status_code=401, detail="Missing token")

    token = Authorization.split(" ")[1]
    claims = verify_token(token)
    user_id = claims["sub"]

    # List user's objects directly from S3
    resp = s3.list_objects_v2(Bucket=BUCKET, Prefix=f"{user_id}/")
    contents = resp.get("Contents", [])
    
    files = []
    for obj in contents:
        filename = obj["Key"].split("/")[-1]
        if not filename:
            continue
        files.append({
            "fileId": obj["Key"].split("/")[1] if "/" in obj["Key"] else "unknown",
            "filename": filename,
            "createdAt": str(int(obj["LastModified"].timestamp())),
            "size": obj["Size"]
        })

    return files


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
