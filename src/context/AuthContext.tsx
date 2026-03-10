// src/context/AuthContext.tsx
import { createContext, JSX, useState, useEffect, useContext, useMemo, useCallback, ReactNode } from 'react';
// Import User type from firebase/auth
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { setUserProperties } from "firebase/analytics";
import { auth, db, analytics, signInWithGoogle, logout as firebaseLogout } from '../firebase/config'; // Ensure path is correct

/** User preferences and profile data stored in Firestore */
interface UserProfile {
  homeCurrency: string;
  tester_group: boolean;
}

// Define the shape of the context value
interface AuthContextType {
  user: User | null; // Firebase User object or null
  profile: UserProfile | null; // Custom profile data
  loading: boolean;
  login: () => Promise<unknown>; // Adjust return type if needed based on signInWithGoogle
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

// Create the context with an initial value of null or a default shape
const AuthContext = createContext<AuthContextType | null>(null);
export default AuthContext

// Define props for the provider component
interface AuthProviderProps {
  children: ReactNode; // Type for children prop
}

const DEFAULT_PROFILE: UserProfile = {
  homeCurrency: 'EUR',
  tester_group: false,
};

// Create a provider component
export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser: User | null) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Fetch or Initialize Profile
        const profileRef = doc(db, "userProfiles", currentUser.uid);
        
        // Use onSnapshot for real-time profile updates
        unsubscribeProfile = onSnapshot(profileRef, async (docSnap) => {
          const profileData: UserProfile = docSnap.exists()
            ? (docSnap.data() as UserProfile)
            : DEFAULT_PROFILE;

          if (!docSnap.exists()) {
            setDoc(profileRef, DEFAULT_PROFILE);
          }

          setProfile(profileData);

          const analyticsInstance = await analytics;
          if (analyticsInstance) {
            setUserProperties(analyticsInstance, { tester_group: String(profileData.tester_group) });
          }
          setLoading(false);
        }, (error) => {
          console.error("Profile Snapshot Error:", error);
          if (error.code === 'permission-denied') {
            console.warn("Firestore rules might be missing for userProfiles collection.");
          }
          setLoading(false);
        });
      } else {
        setProfile(null);
        if (unsubscribeProfile) unsubscribeProfile();
        setLoading(false);
      }
      
      console.log("Auth State Changed:", currentUser ? `User: ${currentUser.uid}` : "No User");
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) return;
    const profileRef = doc(db, "userProfiles", user.uid);
    await setDoc(profileRef, { ...profile, ...updates }, { merge: true });
  }, [user, profile]);

  // Memoized context value with the defined type
  const value: AuthContextType = useMemo(() => ({
    user,
    profile,
    loading,
    login: signInWithGoogle,
    logout: firebaseLogout,
    updateProfile
  }), [user, profile, loading, updateProfile]);

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
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === null) {
    // Provides a helpful error message if used outside of the provider
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
