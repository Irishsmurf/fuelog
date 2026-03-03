# Playbook: Firebase Project Setup

## 1. Create a Firebase Project
1.  Go to the [Firebase Console](https://console.firebase.google.com/).
2.  Click **Add project** and follow the prompts.
3.  Disable Google Analytics if not needed (Fuelog uses Vercel Analytics).

## 2. Register Your Web App
1.  In the Project Overview, click the **Web** icon (</>).
2.  Register the app with a nickname (e.g., "Fuelog").
3.  **DO NOT** copy the config yet; we will use it for the `.env` file.

## 3. Enable Authentication
1.  In the left menu, go to **Build** > **Authentication**.
2.  Click **Get started**.
3.  In **Sign-in method**, enable **Google**.
4.  Configure the support email and click **Save**.
5.  In **Settings** > **Authorized domains**, add your Vercel deployment domain (e.g., `fuelog.vercel.app`).

## 4. Enable Firestore Database
1.  Go to **Build** > **Firestore Database**.
2.  Click **Create database**.
3.  Select a location close to your users.
4.  Start in **Production mode**.
5.  **Configure Security Rules:**
    - Navigate to the **Rules** tab and paste the following:
      ```javascript
      rules_version = '2';
      service cloud.firestore {
        match /databases/{database}/documents {
          match /fuelLogs/{logId} {
            allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
            allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
          }
        }
      }
      ```
    - Click **Publish**.

## 5. Enable Remote Config
1.  Go to **Build** > **Remote Config**.
2.  Click **Create configuration**.
3.  Add the following parameters (all as **Boolean**):
    - `darkModeEnabled` (Default: `false`)
    - `costPerLitreGraphEnabled` (Default: `false`)
    - `totalSpentDisplayEnabled` (Default: `false`)
    - `exampleFeatureFlagEnabled` (Default: `false`)
4.  Click **Publish changes**.

## 6. Configure Environment Variables
1.  Go to **Project Settings** (gear icon) > **General**.
2.  Scroll down to **Your apps** and copy the values from the `firebaseConfig` object.
3.  Create or update your `.env` file with these values:
    ```env
    VITE_FIREBASE_API_KEY=your-api-key
    VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
    VITE_FIREBASE_PROJECT_ID=your-project-id
    VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
    VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
    VITE_FIREBASE_APP_ID=your-app-id
    ```
