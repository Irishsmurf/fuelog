// src/firebase/config.ts
import { initializeApp, FirebaseApp } from "firebase/app"; // Import FirebaseApp type
// Import types for Auth and Firestore services and specific functions/providers
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  Auth, // Type for auth instance
  UserCredential // Type for signInWithPopup result
} from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore"; // Import Firestore type

// Define an interface for the config object for clarity (optional but good practice)
interface FirebaseConfig {
  apiKey: string | undefined;
  authDomain: string | undefined;
  projectId: string | undefined;
  storageBucket: string | undefined;
  messagingSenderId: string | undefined;
  appId: string | undefined;
}

// Load variables using import.meta.env for Vite
const firebaseConfig: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// --- Input Validation ---
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error(
    "Firebase configuration is missing or incomplete. " +
    "Ensure your .env file is set up correctly in the project root, " +
    "variables start with VITE_, and the Vite server was restarted after changes."
  );
  // Handle error appropriately in a real app, maybe throw an error
}

// Initialize Firebase
// Type the app instance
const app: FirebaseApp = initializeApp(firebaseConfig as any); // Use 'as any' or ensure all keys are defined before init if strict

// Initialize Firebase Services and type them
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);
const googleProvider: GoogleAuthProvider = new GoogleAuthProvider();

// --- Authentication Functions --- (Add explicit types)

/**
 * Initiates Google Sign-In using a popup window.
 * @returns {Promise<UserCredential>} A promise that resolves with the user credential upon successful sign-in.
 */
const signInWithGoogle = async (): Promise<UserCredential> => {
  try {
    const result: UserCredential = await signInWithPopup(auth, googleProvider);
    console.log("Google Sign-In Successful:", result.user.displayName);
    return result;
  } catch (error) {
    console.error("Google Sign-In Error:", error);
    throw error; // Re-throw for handling in UI component
  }
};

/**
 * Signs the current user out.
 * @returns {Promise<void>} A promise that resolves when sign-out is complete.
 */
const logout = async (): Promise<void> => {
  try {
    await signOut(auth);
    console.log("User signed out successfully.");
  } catch (error) {
    console.error("Sign Out Error:", error);
    throw error;
  }
};

// Export the necessary instances and functions
export {
  auth,
  db,
  googleProvider,
  signInWithGoogle,
  logout
};
