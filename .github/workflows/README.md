# GitHub Actions CI/CD

Three workflows deploy this project to AWS automatically on push to `main`.

## Workflows

| Workflow | Trigger | What it does |
|---|---|---|
| `deploy-frontend.yml` | `frontend/**` changed | Build Vite → S3 sync → CloudFront invalidate |
| `deploy-backend.yml` | `backend/**` changed | Docker build → ECR push → ECS force-deploy → wait stable |
| `deploy-infra.yml` | `infra/**` changed | CDK diff (always) → CDK deploy (production env gate) |

## One-time AWS setup

### 1 — Create an OIDC Identity Provider in AWS IAM

This lets GitHub Actions assume an IAM role without storing long-lived keys.

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### 2 — Create the deploy IAM role

Replace `YOUR_GITHUB_ORG` and `YOUR_REPO_NAME` before running.

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
GITHUB_ORG=YOUR_GITHUB_ORG
REPO_NAME=YOUR_REPO_NAME

cat > /tmp/trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringLike": {
        "token.actions.githubusercontent.com:sub": "repo:${GITHUB_ORG}/${REPO_NAME}:*"
      },
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
      }
    }
  }]
}
EOF

aws iam create-role \
  --role-name whiteboard-github-deploy \
  --assume-role-policy-document file:///tmp/trust-policy.json

# Attach policies (scope down for production)
aws iam attach-role-policy \
  --role-name whiteboard-github-deploy \
  --policy-arn arn:aws:iam::aws:policy/PowerUserAccess

echo "Role ARN: arn:aws:iam::${ACCOUNT_ID}:role/whiteboard-github-deploy"
```

> **Production tip:** Replace `PowerUserAccess` with a custom policy scoped to  
> S3, CloudFront, ECR, ECS, CloudFormation, and IAM PassRole only.

### 3 — Add GitHub repository secrets

Go to **Settings → Secrets and variables → Actions → New repository secret**:

| Secret name | Value |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::<account-id>:role/whiteboard-github-deploy` |
| `AWS_REGION` | e.g. `us-east-1` |

### 4 — Create the `production` environment (optional gate)

Go to **Settings → Environments → New environment** → name it `production`.  
Add required reviewers if you want manual approval before infra/backend deploys.

## Deployment flow

```
git push main
    │
    ├─ frontend/** changed? ──► deploy-frontend (auto, ~2 min)
    ├─ backend/**  changed? ──► deploy-backend  (auto, ~5 min)
    └─ infra/**    changed? ──► deploy-infra    (diff always, deploy needs env approval)
```

## Manual deploys (workflow_dispatch)

All three workflows support `workflow_dispatch` from the GitHub Actions UI  
(**Actions tab → select workflow → Run workflow**).
