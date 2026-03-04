# Kubernetes Deployment Runbook

## Prerequisites

- `kubectl` configured with EKS access (`aws eks update-kubeconfig --name pi-dev-cluster --region us-east-1`)
- `helm` v3.14+
- `aws` CLI with appropriate IAM permissions
- ECR repository: `prd-web-agent` in `us-east-1`

---

## Deployment Order

Deploy in this sequence — each layer depends on the previous.

### 1. Namespaces

```bash
helm upgrade --install namespaces ./helm/namespaces \
  --namespace default
```

Creates: `staging`, `production`, `monitoring` namespaces with ResourceQuotas and NetworkPolicies.

---

### 2. Infrastructure (PostgreSQL, Redis, OpenSearch)

```bash
# Update Helm dependencies first
helm dependency update ./helm/infrastructure

helm upgrade --install infrastructure ./helm/infrastructure \
  --namespace staging \
  --create-namespace \
  --set postgresql.auth.password=<secret> \
  --values ./helm/infrastructure/values.yaml \
  --wait --timeout 10m
```

Verify:
```bash
kubectl get pods -n staging
kubectl get pvc -n staging
```

---

### 3. SigNoz (OpenTelemetry Observability)

```bash
# Add SigNoz Helm repo
helm repo add signoz https://charts.signoz.io
helm repo update

helm upgrade --install signoz signoz/signoz \
  --namespace monitoring \
  --create-namespace \
  --values ./helm/signoz/values.yaml \
  --wait --timeout 15m
```

Verify:
```bash
kubectl get pods -n monitoring
kubectl get svc -n monitoring | grep otel-collector
```

Access the SigNoz UI via the internal ALB ingress at `https://signoz.internal.example.com` (requires VPN or internal network access).

---

### 4. prd-web-agent Application

**Staging** (auto-deployed via CI/CD on merge to `main`):
```bash
# Manual deploy if needed:
helm upgrade --install prd-web-agent ./helm/prd-web-agent \
  --namespace staging \
  --create-namespace \
  --set image.repository=<ecr-registry>/prd-web-agent \
  --set image.tag=sha-<commit-sha> \
  --values ./helm/prd-web-agent/values.yaml \
  --wait --timeout 5m
```

**Production** (triggered by pushing a `v*` tag via CI/CD):
```bash
# Tag a commit on main:
git tag v1.2.3
git push origin v1.2.3
# GitHub Actions will run the deploy-production job (requires manual approval in GitHub UI)
```

---

## CI/CD Flow

```
Push to main
  → lint + test
  → build Docker image → push to ECR (tagged sha-<sha> + latest)
  → Trivy security scan → upload SARIF to GitHub Security
  → deploy to staging

Push tag v*
  → lint + test
  → resolve existing ECR image by sha-<sha> (no rebuild)
  → deploy to production (requires GitHub environment approval)
```

---

## Verification

```bash
# Check app pods
kubectl get pods -n staging
kubectl get pods -n production

# Check rollout status
kubectl rollout status deployment/prd-web-agent -n staging

# Check OTel connectivity (from app pod)
kubectl exec -n staging deploy/prd-web-agent -- \
  curl -s http://signoz-otel-collector.monitoring.svc.cluster.local:4318/v1/traces

# Check SigNoz is receiving data
kubectl logs -n monitoring -l app.kubernetes.io/component=otel-collector --tail=50
```

---

## Rollback

```bash
# Rollback app to previous Helm revision
helm rollback prd-web-agent --namespace staging
helm rollback prd-web-agent --namespace production

# Or deploy a specific image tag
helm upgrade prd-web-agent ./helm/prd-web-agent \
  --namespace production \
  --reuse-values \
  --set image.tag=sha-<previous-commit-sha>
```

---

## Secrets Required

| Secret | Where | Description |
|--------|-------|-------------|
| `AWS_ROLE_ARN` | GitHub Actions | IAM role for ECR push + EKS deploy |
| `SLACK_WEBHOOK_URL` | GitHub Actions | Slack incoming webhook for failure alerts |
| `NEXTAUTH_SECRET` | Helm values / K8s Secret | NextAuth signing key |
| `NEXTAUTH_URL` | Helm values / K8s Secret | Public URL of the app |
| `GITHUB_CLIENT_ID` | Helm values / K8s Secret | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | Helm values / K8s Secret | GitHub OAuth app client secret |
| `postgresql.auth.password` | Helm `--set` | PostgreSQL password |

Populate K8s secrets via:
```bash
kubectl create secret generic prd-web-agent-secrets \
  --namespace staging \
  --from-literal=NEXTAUTH_SECRET=<value> \
  --from-literal=NEXTAUTH_URL=https://prd-web-agent.staging.example.com \
  --from-literal=GITHUB_CLIENT_ID=<value> \
  --from-literal=GITHUB_CLIENT_SECRET=<value>
```
