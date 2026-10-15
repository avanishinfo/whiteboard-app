#!/usr/bin/env bash
# Deploy the WebSocket backend to ECS Fargate via ECR.
# Prerequisites: AWS CLI configured, Docker running, jq installed.
# Usage: bash scripts/deploy-backend.sh [--region us-east-1]
set -euo pipefail

REGION="${AWS_DEFAULT_REGION:-us-east-1}"

# Parse optional --region flag
while [[ $# -gt 0 ]]; do
  case $1 in
    --region) REGION="$2"; shift 2 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

echo "==> Fetching stack outputs (region: $REGION)..."

ECR_URI=$(aws cloudformation describe-stacks \
  --stack-name WhiteboardBackend \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='EcrRepositoryUri'].OutputValue" \
  --output text)

CLUSTER=$(aws cloudformation describe-stacks \
  --stack-name WhiteboardBackend \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='EcsClusterName'].OutputValue" \
  --output text)

SERVICE=$(aws cloudformation describe-stacks \
  --stack-name WhiteboardBackend \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='EcsServiceName'].OutputValue" \
  --output text)

AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
ECR_REGISTRY="${AWS_ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com"

echo "ECR:     $ECR_URI"
echo "Cluster: $CLUSTER  /  Service: $SERVICE"

echo ""
echo "==> Authenticating Docker with ECR..."
aws ecr get-login-password --region "$REGION" | \
  docker login --username AWS --password-stdin "$ECR_REGISTRY"

echo ""
echo "==> Building Docker image..."
docker build \
  --platform linux/amd64 \
  -t "${ECR_URI}:latest" \
  backend/

echo ""
echo "==> Pushing image to ECR..."
docker push "${ECR_URI}:latest"

echo ""
echo "==> Forcing new ECS deployment..."
aws ecs update-service \
  --cluster "$CLUSTER" \
  --service "$SERVICE" \
  --force-new-deployment \
  --region "$REGION" \
  --output json | jq '.service.deployments[0] | {status, desiredCount, runningCount}'

echo ""
echo "==> Done! The new task will start in ~1 minute."
echo "    Monitor progress:"
echo "    aws ecs describe-services --cluster $CLUSTER --services $SERVICE --region $REGION"
