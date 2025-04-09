// src/firebase/config.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Load variables using import.meta.env for Vite
// Ensure your .env file variables start with VITE_
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// --- Input Validation ---
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error(
        "Firebase configuration is missing or incomplete. " +
        "Ensure your .env file is set up correctly in the project root, " +
        "variables start with VITE_, and the Vite server was restarted after changes."
    );
    // Handle error appropriately in a real app
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Services
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// --- Authentication Functions --- (Logic is the same as before)

/**
 * Initiates Google Sign-In using a popup window.
 */
const signInWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        console.log("Google Sign-In Successful:", result.user.displayName);
        return result;
    } catch (error) {
        console.error("Google Sign-In Error:", error);
        // Handle specific errors if needed (e.g., popup closed)
        // const errorCode = error.code;
        // const errorMessage = error.message;
        throw error; // Re-throw for handling in UI component
    }
};

/**
 * Signs the current user out.
 */
const logout = async () => {
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
    googleProvider, // Optional export if needed elsewhere
    signInWithGoogle,
    logout
};