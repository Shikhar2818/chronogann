"""
AWS Lambda handler for ChronoGann API using Mangum
Run: python handler.py for local testing with AWS SAM
"""
from mangum import Mangum
from main import app

# AWS Lambda handler
handler = Mangum(app)

if __name__ == "__main__":
    # For local development with SAM CLI
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=3001)
