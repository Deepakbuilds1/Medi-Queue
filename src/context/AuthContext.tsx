import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { seedInitialDataIfEmpty, saveUserProfile, getUserProfile } from '../services/clinicService';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, pass: string) => Promise<void>;
  registerAdmin: (email: string, pass: string) => Promise<void>;
  signUpPatient: (email: string, pass: string, profile: Omit<UserProfile, 'uid' | 'email' | 'role' | 'createdAt'>) => Promise<void>;
  signInPatient: (email: string, pass: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Seed initial clinic settings & sample doctors on startup
    seedInitialDataIfEmpty();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const profile = await getUserProfile(currentUser.uid);
        if (profile) {
          setUserProfile(profile as UserProfile);
        } else {
          // Construct fallback basic profile
          setUserProfile({
            uid: currentUser.uid,
            email: currentUser.email || '',
            name: currentUser.displayName || currentUser.email?.split('@')[0] || 'Patient',
            phone: '',
            age: 30,
            gender: 'Male',
            role: 'patient',
            createdAt: new Date().toISOString()
          });
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const registerAdmin = async (email: string, pass: string) => {
    await createUserWithEmailAndPassword(auth, email, pass);
  };

  const signUpPatient = async (
    email: string, 
    pass: string, 
    profileData: Omit<UserProfile, 'uid' | 'email' | 'role' | 'createdAt'>
  ) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const fullProfile = {
      uid: cred.user.uid,
      email,
      name: profileData.name,
      phone: profileData.phone,
      age: profileData.age,
      gender: profileData.gender,
      role: 'patient' as const,
    };
    const saved = await saveUserProfile(fullProfile);
    setUserProfile(saved as UserProfile);
  };

  const signInPatient = async (email: string, pass: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const profile = await getUserProfile(cred.user.uid);
    if (profile) {
      setUserProfile(profile as UserProfile);
    }
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    await firebaseSignOut(auth);
    setUserProfile(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      userProfile,
      loading, 
      isAdmin: !!user, 
      login, 
      registerAdmin, 
      signUpPatient,
      signInPatient,
      resetPassword, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
