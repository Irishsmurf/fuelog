// src/firebase/config.ts
import { initializeApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  Auth,
  UserCredential
} from "firebase/auth";
// Import updated Firestore functions and types for persistence
import {
    initializeFirestore, // Use initializeFirestore instead of getFirestore
    Firestore,
    persistentLocalCache, // Factory for persistent cache settings
    persistentSingleTabManager, // Use single tab manager (most common for web)
    // persistentMultipleTabManager // Alternative if multi-tab support needed
    FirestoreSettings // Type for settings object
} from "firebase/firestore";

// Config interface (remains the same)
interface FirebaseConfig {
  apiKey: string | undefined;
  authDomain: string | undefined;
  projectId: string | undefined;
  storageBucket: string | undefined;
  messagingSenderId: string | undefined;
  appId: string | undefined;
}

// Load environment variables (remains the same)
const firebaseConfig: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Input Validation (remains the same)
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error("Firebase configuration is missing or incomplete.");
  // Handle error appropriately
}

// Initialize Firebase App (remains the same)
const app: FirebaseApp = initializeApp(firebaseConfig as any);

// Initialize Firebase Auth (remains the same)
const auth: Auth = getAuth(app);

// --- Initialize Firestore with Offline Persistence Settings ---
let db: Firestore; // Declare db variable

try {
  // Define the settings for Firestore, enabling offline persistence
  const firestoreSettings: FirestoreSettings = {
    // Use persistentLocalCache with persistentSingleTabManager
    // This enables IndexedDB persistence for the current browser tab.
    localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) })
    // If you needed multi-tab offline sync (more complex), you might use:
    // localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  };

  // Initialize Firestore WITH the settings object
  db = initializeFirestore(app, firestoreSettings);
  console.log("Firestore initialized with offline persistence enabled.");

} catch (error: any) {
  // Catch potential errors during initialization (e.g., persistence unavailable)
  console.error("Firestore initialization with persistence failed:", error);
  // Fallback: Initialize Firestore without persistence if enabling fails
  // This allows the app to continue working online.
  console.warn("Falling back to initializing Firestore without offline persistence.");
  db = initializeFirestore(app, {}); // Initialize with default settings
}
// --- End Firestore Initialization ---


// Google Auth Provider (remains the same)
const googleProvider: GoogleAuthProvider = new GoogleAuthProvider();


// --- Authentication Functions (remain the same) ---
const signInWithGoogle = async (): Promise<UserCredential> => { try { const result: UserCredential = await signInWithPopup(auth, googleProvider); console.log("Google Sign-In Successful:", result.user.displayName); return result; } catch (error) { console.error("Google Sign-In Error:", error); throw error; } };
const logout = async (): Promise<void> => { try { await signOut(auth); console.log("User signed out successfully."); } catch (error) { console.error("Sign Out Error:", error); throw error; } };


// Export the necessary instances and functions (db is now initialized above)
export {
  app,
  auth,
  db, // Export the initialized db instance
  googleProvider,
  signInWithGoogle,
  logout
};