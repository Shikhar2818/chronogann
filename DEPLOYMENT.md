# ChronoGann Deployment Guide

Complete step-by-step instructions for deploying ChronoGann to production.

## Prerequisites

- GitHub account with repository access
- Vercel account (free tier available)
- AWS account (free tier or paid)
- Neon PostgreSQL account (free tier available)

## Part 1: Frontend Deployment (Vercel)

### Step 1: Push to GitHub

```bash
cd c:\Users\shikh\GANN PROJECT
git init
git add .
git commit -m "Initial ChronoGann commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/chronogann.git
git push -u origin main
```

### Step 2: Connect to Vercel

1. Go to https://vercel.com/dashboard
2. Click "Add New..." → "Project"
3. Import from GitHub → Select your `chronogann` repository
4. Configure project:
   - **Framework:** Next.js
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`

### Step 3: Set Environment Variables

In Vercel dashboard, under project Settings → Environment Variables:

```
NEXT_PUBLIC_API_URL=https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod
NEXT_PUBLIC_APP_NAME=ChronoGann
NEXT_PUBLIC_APP_SUBTITLE=Time-Cycle Market Intelligence
```

### Step 4: Deploy

Click "Deploy" button. Vercel automatically builds and deploys on push.

**Frontend URL:** `https://your-project-name.vercel.app`

---

## Part 2: Backend Deployment (AWS Lambda)

### Step 1: Create S3 Bucket for Lambda Code

```bash
aws s3 mb s3://chronogann-lambda-code --region us-east-1
```

### Step 2: Package FastAPI Application

```bash
cd c:\Users\shikh\GANN PROJECT\backend

# Remove unnecessary files
Remove-Item -Recurse -Force venv
Remove-Item -Recurse -Force .pytest_cache
Remove-Item .env

# Create package
$items = Get-ChildItem -Exclude .git, .gitignore, node_modules, __pycache__
Compress-Archive -Path $items -DestinationPath lambda-deployment.zip
```

### Step 3: Upload to S3

```bash
aws s3 cp lambda-deployment.zip s3://chronogann-lambda-code/
```

### Step 4: Create Lambda Function

```bash
aws lambda create-function \
  --function-name chronogann-api \
  --runtime python3.11 \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/lambda-execution-role \
  --handler handler.handler \
  --code S3Bucket=chronogann-lambda-code,S3Key=lambda-deployment.zip \
  --timeout 60 \
  --memory-size 512 \
  --environment Variables="{DATABASE_URL=postgresql://...,FRONTEND_URL=https://your-vercel-app.vercel.app}" \
  --region us-east-1
```

### Step 5: Create IAM Role (if not exists)

```bash
# Create trust policy JSON file: trust-policy.json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}

# Create role
aws iam create-role \
  --role-name lambda-execution-role \
  --assume-role-policy-document file://trust-policy.json

# Attach basic execution policy
aws iam attach-role-policy \
  --role-name lambda-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

### Step 6: Create API Gateway

```bash
# Create API
aws apigateway create-rest-api \
  --name chronogann-api \
  --description "ChronoGann Time-Cycle Analysis API"

# Get API ID (from output)
API_ID="abc123xyz"

# Create proxy resource and integration
aws apigateway get-resources --rest-api-id $API_ID
# Get root resource ID from output

ROOT_ID="abc123"

# Create proxy resource
aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_ID \
  --path-part "{proxy+}"

PROXY_ID="xyz789"

# Create ANY method
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $PROXY_ID \
  --http-method ANY \
  --authorization-type NONE

# Create Lambda integration
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $PROXY_ID \
  --http-method ANY \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:YOUR_ACCOUNT_ID:function:chronogann-api/invocations

# Deploy API
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod

# Get API URL (output will show: https://abc123.execute-api.us-east-1.amazonaws.com/prod)
```

### Step 7: Grant API Gateway Permission to Invoke Lambda

```bash
aws lambda add-permission \
  --function-name chronogann-api \
  --statement-id apigateway-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-east-1:YOUR_ACCOUNT_ID:YOUR_API_ID/*/*"
```

### Step 8: Test Backend

```bash
curl https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod/health
# Should return: {"status":"ok","service":"ChronoGann API"}
```

---

## Part 3: Database Setup (Neon PostgreSQL)

### Step 1: Create Database

1. Go to https://neon.tech and sign up (free tier)
2. Create a new project
3. Copy connection string: `postgresql://user:password@host/dbname?sslmode=require`

### Step 2: Create Schema

```bash
# Option 1: Using psql directly
psql "postgresql://user:password@host/dbname?sslmode=require" < schema.sql

# Option 2: Using Python
python -c "
from app.db import engine, Base
import asyncio
asyncio.run(Base.metadata.create_all(engine))
"
```

### Step 3: Set Environment Variable in Lambda

Update Lambda environment variable:
```
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
```

---

## Part 4: Connect Frontend to Backend

### Update Vercel Environment Variable

Set `NEXT_PUBLIC_API_URL` to your API Gateway URL:
```
https://your-api-id.execute-api.us-east-1.amazonaws.com/prod
```

Vercel automatically redeploys when environment variables change.

---

## Part 5: Custom Domain (Optional)

### Vercel Domain

1. In Vercel dashboard, go to **Settings** → **Domains**
2. Add your domain (e.g., `chronogann.com`)
3. Follow DNS configuration instructions
4. Vercel automatically manages SSL/TLS

### API Gateway Domain (Optional)

1. In AWS console, go to **API Gateway** → **Custom Domain Names**
2. Create domain mapping (e.g., `api.chronogann.com`)
3. Update DNS records in your registrar
4. Associate with your API deployment

---

## Part 6: Monitoring & Logging

### CloudWatch Logs (Lambda)

```bash
# View recent logs
aws logs tail /aws/lambda/chronogann-api --follow

# View specific time range
aws logs filter-log-events \
  --log-group-name /aws/lambda/chronogann-api \
  --start-time $(date -d "1 hour ago" +%s)000
```

### Vercel Analytics

- Vercel dashboard shows build status, deployment history, and error logs
- Performance metrics in **Analytics** section

### Database Monitoring (Neon)

- Neon console shows query performance, connection count, storage usage
- Set up alerts for high utilization

---

## Part 7: CI/CD Pipeline (Optional)

### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy ChronoGann

on:
  push:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Test Backend
        run: |
          cd backend
          python -m pip install -r requirements.txt
          # pytest app/tests/

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Vercel
        run: |
          npm install -g vercel
          vercel deploy --prod

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Lambda
        run: |
          cd backend
          zip -r lambda-deployment.zip .
          aws lambda update-function-code \
            --function-name chronogann-api \
            --zip-file fileb://lambda-deployment.zip
```

---

## Troubleshooting

### Frontend Not Loading

- Check browser console for errors
- Verify `NEXT_PUBLIC_API_URL` is set correctly
- Check Vercel build logs: https://vercel.com/dashboard

### Backend Not Responding

- Check Lambda function logs in CloudWatch
- Verify database connection string is correct
- Test API endpoint with `curl` or Postman
- Check API Gateway configuration

### Database Connection Errors

- Verify connection string in Lambda environment variables
- Check Neon firewall settings (allow all IPs if in free tier)
- Test connection locally: `psql postgresql://...`

### CORS Errors

- Verify frontend URL is in `CORS_ORIGINS` in `main.py`
- Redeploy backend after updating CORS origins

---

## Performance Optimization

### Frontend
- Vercel CDN automatically optimizes performance
- Next.js Image component optimizes images
- Code splitting reduces bundle size

### Backend
- AWS Lambda automatically scales based on demand
- Connection pooling in FastAPI
- Consider caching responses for frequently accessed data

### Database
- Add indexes to frequently queried columns
- Neon free tier has reasonable limits for testing
- Monitor slow queries with Neon console

---

## Cost Estimation

| Service | Free Tier | Cost After |
|---------|-----------|-----------|
| Vercel | Up to 100GB/month | $0.15/GB overage |
| AWS Lambda | 1 million requests/month | $0.20 per million requests |
| Neon PostgreSQL | 3 branches, 512MB | Pay-per-usage |
| API Gateway | 1 million requests/month | $3.50 per million requests |
| Total | $0 | ~$50/month if busy |

---

## Maintenance

### Update Dependencies

```bash
# Frontend
cd frontend
npm update

# Backend
cd backend
pip install --upgrade -r requirements.txt
```

### Database Backups (Neon)

- Neon automatically backs up daily (free tier)
- Manual backups: Use Neon console or `pg_dump`

### Monitor Alerts

- Set up CloudWatch alarms for Lambda errors
- Monitor database connections and storage
- Check Vercel analytics for 4xx/5xx errors

---

## Support & Resources

- **Vercel Docs:** https://vercel.com/docs
- **AWS Lambda:** https://docs.aws.amazon.com/lambda/
- **API Gateway:** https://docs.aws.amazon.com/apigateway/
- **Neon Docs:** https://neon.tech/docs
- **FastAPI:** https://fastapi.tiangolo.com
- **Next.js:** https://nextjs.org/docs

---

**Last Updated:** June 2026
**Version:** 1.0.0
