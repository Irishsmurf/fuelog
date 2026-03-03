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
4.  Every push to the `main` branch will trigger a deployment.

### 4. Configuration Highlights
- **`vercel.json`:**
    - **Rewrites:** Redirects all paths to `index.html` for React Router support.
    - **Headers:** Includes `Cross-Origin-Opener-Policy: same-origin-allow-popups` to support Firebase Google Sign-in Popups correctly in modern browsers.

## Building for Production Locally
1.  **Install:** `npm install`
2.  **Build:** `npm run build`
3.  **Preview:** `npm run preview`
    - This starts a local server to test the production build on port 4173.
