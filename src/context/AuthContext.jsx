// src/context/AuthContext.jsx
// This file remains the same as the Create React App version.
// It uses the imported auth instance and functions from firebase/config.js
import React, { createContext, useState, useEffect, useContext, useMemo } from 'react';
import { onAuthStateChanged } from "firebase/auth";
import { auth, signInWithGoogle, logout as firebaseLogout } from '../firebase/config'; // Ensure path is correct

// Create the context
const AuthContext = createContext(null);

// Create a provider component
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to user authentication state changes
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser); // Set user to null if logged out, or user object if logged in
      setLoading(false); // Auth state determined
      console.log("Auth State Changed:", currentUser ? `User: ${currentUser.uid}` : "No User");
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []); // Runs once on mount

  // Memoized value to prevent unnecessary re-renders of consumers
  const value = useMemo(() => ({
    user,
    loading,
    login: signInWithGoogle,
    logout: firebaseLogout
  }), [user, loading]);

  // Render children only after initial loading is complete
  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
      {/* Consider adding a global loading indicator here if preferred */}
      {/* {loading && <FullPageSpinner />} */}
    </AuthContext.Provider>
  );
}

// Custom hook to easily consume the AuthContext
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // Provides a helpful error message if used outside of the provider
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
