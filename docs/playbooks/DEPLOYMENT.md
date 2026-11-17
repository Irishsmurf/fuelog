# Playbook: Deployment

## Vercel Deployment (Recommended)
**Fuelog** is optimized for hosting on Vercel.

### 1. Prerequisite Environment Variables
Before deploying, ensure you have the following environment variables configured in Vercel:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_CARTO_API_KEY` — optional but recommended in production. Without it the
  log-card map thumbnails render CARTO's keyless raster tiles, which are stamped
  with an "API KEY REQUIRED" watermark. Get a free key (no CARTO account
  required) at <https://carto.com/basemaps/apikey>.

> The CARTO key is compiled into the client bundle by Vite, so it is publicly
> visible — that is expected. Tile requests are made by the browser, so the key
> is an identifier rather than a secret. It has no payment method attached, so
> the worst case if it is scraped is exhausting CARTO's 5M-requests/month fair
> use limit, which throttles rather than bills. Rotating it requires a redeploy.

### 2. Manual Vercel Deployment (CLI)
If you have the Vercel CLI installed:
1.  **Build locally (Optional):**
    ```bash
    npm run build
    ```
2.  **Deploy:**
    ```bash
    vercel
    ```

### 3. Automatic Deployment (GitHub)
1.  Connect your GitHub repository to a new Vercel project.
2.  Configure the build settings:
    - **Build Command:** `npm run build`
    - **Output Directory:** `dist`
    - **Install Command:** `npm install`
3.  Add the environment variables in the Vercel project settings.
4.  Every push to the `main` branch triggers a deployment once Main CI (including the emulator E2E tests) has passed for that commit.

### 4. Configuration Highlights
- **`vercel.json`:**
    - **Rewrites:** Redirects all paths to `index.html` for React Router support.
    - **Headers:** Includes `Cross-Origin-Opener-Policy: same-origin-allow-popups` to support Firebase Google Sign-in Popups correctly in modern browsers.

## Firebase Deployment (rules, indexes, Storage rules, Cloud Functions)

The **Firebase Deploy** workflow deploys on push to `main` after Main CI passes.
It authenticates in one of two ways:

| Repo setting | Used when |
| :--- | :--- |
| Variables `GCP_WORKLOAD_IDENTITY_PROVIDER` + `GCP_SERVICE_ACCOUNT` | **OIDC (recommended).** No long-lived secret; GitHub exchanges a short-lived token for Google credentials. |
| Secret `FIREBASE_TOKEN` | Legacy fallback, used only while the OIDC variables are unset. |

### Switching to OIDC (Workload Identity Federation)

Run once with the gcloud CLI as a project owner (`PROJECT_ID` is the Firebase
project, `REPO` is `owner/name` on GitHub):

```bash
PROJECT_ID=your-project-id
REPO=owner/fuelog
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')

# 1. A deploy service account
gcloud iam service-accounts create github-deployer --project "$PROJECT_ID" \
  --display-name "GitHub Actions deployer"
SA="github-deployer@${PROJECT_ID}.iam.gserviceaccount.com"

# 2. Roles it needs to deploy rules, indexes and Cloud Functions (v2)
for role in roles/firebase.admin roles/cloudfunctions.admin roles/run.admin \
            roles/artifactregistry.admin roles/cloudscheduler.admin \
            roles/eventarc.admin roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member "serviceAccount:${SA}" --role "$role" --condition None
done

# 3. A workload identity pool and GitHub provider, limited to this repository
gcloud iam workload-identity-pools create github --project "$PROJECT_ID" --location global
gcloud iam workload-identity-pools providers create-oidc github \
  --project "$PROJECT_ID" --location global --workload-identity-pool github \
  --issuer-uri https://token.actions.githubusercontent.com \
  --attribute-mapping 'google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref' \
  --attribute-condition "assertion.repository == '${REPO}' && assertion.ref == 'refs/heads/main'"

# 4. Let that repository (main branch only) act as the service account
gcloud iam service-accounts add-iam-policy-binding "$SA" --project "$PROJECT_ID" \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/${REPO}"

echo "GCP_WORKLOAD_IDENTITY_PROVIDER=projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/providers/github"
echo "GCP_SERVICE_ACCOUNT=${SA}"
```

Then, in GitHub: **Settings → Secrets and variables → Actions → Variables**, add
the two printed values as repository variables. The next deploy uses OIDC.
If it fails with a permission error, the log names the missing role; grant it
to the service account and re-run. Once an OIDC deploy has succeeded, delete
the `FIREBASE_TOKEN` secret (and revoke it with `firebase logout --token`).

## Building for Production Locally
1.  **Install:** `npm install`
2.  **Build:** `npm run build`
3.  **Preview:** `npm run preview`
    - This starts a local server to test the production build on port 4173.
