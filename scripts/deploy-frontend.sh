#!/usr/bin/env bash
# Build and deploy the React frontend to S3 + CloudFront.
# Prerequisites: AWS CLI configured, Node.js installed.
# Usage: bash scripts/deploy-frontend.sh [--region us-east-1]
set -euo pipefail

REGION="${AWS_DEFAULT_REGION:-us-east-1}"

while [[ $# -gt 0 ]]; do
  case $1 in
    --region) REGION="$2"; shift 2 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

echo "==> Fetching stack outputs (region: $REGION)..."

BUCKET=$(aws cloudformation describe-stacks \
  --stack-name WhiteboardFrontend \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='S3BucketName'].OutputValue" \
  --output text)

DIST_ID=$(aws cloudformation describe-stacks \
  --stack-name WhiteboardFrontend \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
  --output text)

CF_URL=$(aws cloudformation describe-stacks \
  --stack-name WhiteboardFrontend \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontUrl'].OutputValue" \
  --output text)

echo "Bucket: $BUCKET"
echo "CF Dist: $DIST_ID"

echo ""
echo "==> Building frontend..."
cd frontend
# VITE_WS_URL must be set in frontend/.env before building
if [[ -f .env ]]; then
  echo "    Using frontend/.env (VITE_WS_URL=$(grep VITE_WS_URL .env | cut -d= -f2-))"
else
  echo "    WARNING: frontend/.env not found — VITE_WS_URL will be empty (local-only mode)"
fi
npm run build
cd ..

echo ""
echo "==> Syncing frontend/dist/ to s3://$BUCKET ..."
aws s3 sync frontend/dist/ "s3://${BUCKET}/" \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html"

# index.html must not be cached so users always get the latest shell
aws s3 cp frontend/dist/index.html "s3://${BUCKET}/index.html" \
  --cache-control "public, max-age=0, must-revalidate" \
  --content-type "text/html"

echo ""
echo "==> Creating CloudFront cache invalidation..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$DIST_ID" \
  --paths "/*" \
  --query "Invalidation.Id" \
  --output text)
echo "    Invalidation ID: $INVALIDATION_ID (takes ~1 min to propagate)"

echo ""
echo "==> Deployed! Visit: $CF_URL"
