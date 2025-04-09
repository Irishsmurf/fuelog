// src/context/AuthContext.tsx
import { createContext, JSX, useState, useEffect, useContext, useMemo, ReactNode } from 'react';
// Import User type from firebase/auth
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, signInWithGoogle, logout as firebaseLogout } from '../firebase/config'; // Ensure path is correct

// Define the shape of the context value
interface AuthContextType {
  user: User | null; // Firebase User object or null
  loading: boolean;
  login: () => Promise<any>; // Adjust return type if needed based on signInWithGoogle
  logout: () => Promise<void>;
}

// Create the context with an initial value of null or a default shape
// Using null is common when the provider guarantees a value
const AuthContext = createContext<AuthContextType | null>(null);
export default AuthContext

// Define props for the provider component
interface AuthProviderProps {
  children: ReactNode; // Type for children prop
}

// Create a provider component
export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  // Specify types for state variables
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // onAuthStateChanged provides User | null
    const unsubscribe = onAuthStateChanged(auth, (currentUser: User | null) => {
      setUser(currentUser);
      setLoading(false);
      console.log("Auth State Changed:", currentUser ? `User: ${currentUser.uid}` : "No User");
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []); // Empty dependency array ensures this runs only once on mount

  // Memoized context value with the defined type
  const value: AuthContextType = useMemo(() => ({
    user,
    loading,
    login: signInWithGoogle,
    logout: firebaseLogout
  }), [user, loading]); // Dependencies for useMemo

  // Render children only after initial loading is complete
  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
      {/* You could show a loading spinner here if needed while loading is true */}
    </AuthContext.Provider>
  );
}

// Custom hook to consume the AuthContext
// Ensures the context is used within a provider and returns the defined type
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === null) {
    // Provides a helpful error message if used outside of the provider
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
