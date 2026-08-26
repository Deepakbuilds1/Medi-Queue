import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInAnonymously
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { 
  saveUserProfile, 
  getUserProfile, 
  logAuditEvent, 
  DEFAULT_CLINIC_ID, 
  INITIAL_CLINICS 
} from '../services/clinicService';
import { UserProfile, UserRole } from '../types';
import { formatFirestoreError } from '../utils/errorUtils';

const SUPER_ADMIN_SESSION_KEY = 'mediqueue_super_admin_session';

const ensureSuperAdminFirebaseAuth = async (
  email: string = 'superadmin@mediqueue.internal', 
  name: string = 'Super Administrator'
): Promise<User | null> => {
  const adminEmail = email || 'superadmin@mediqueue.internal';
  const adminPass = 'SuperAdminSecure2026!';
  let fbUser = auth.currentUser;

  if (!fbUser) {
    try {
      const cred = await signInWithEmailAndPassword(auth, adminEmail, adminPass);
      fbUser = cred.user;
    } catch {
      try {
        const cred = await createUserWithEmailAndPassword(auth, adminEmail, adminPass);
        fbUser = cred.user;
      } catch {
        try {
          const cred = await signInAnonymously(auth);
          fbUser = cred.user;
        } catch (_) {}
      }
    }
  }

  if (fbUser) {
    try {
      const userDocRef = doc(db, 'users', fbUser.uid);
      const superProfileData: UserProfile = {
        uid: fbUser.uid,
        email: adminEmail,
        name: name || 'Super Administrator',
        displayName: name || 'Super Administrator',
        phone: '+1 (800) 555-0100',
        age: 40,
        gender: 'Other',
        role: 'SUPER_ADMIN',
        clinicId: DEFAULT_CLINIC_ID,
        clinicIds: INITIAL_CLINICS.map(c => c.id),
        accessibleClinicIds: INITIAL_CLINICS.map(c => c.id),
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(userDocRef, superProfileData, { merge: true });
    } catch (e) {
      console.warn('Super admin profile sync notice:', e);
    }
  }

  return fbUser;
};

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  authReady: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isClinicAdmin: boolean;
  userRole: UserRole;
  superAdminSessionToken: string | null;
  verifySuperAdminPin: (token: string, userMeta?: any) => Promise<void>;
  login: (email: string, pass: string) => Promise<void>;
  registerAdmin: (email: string, pass: string, clinicId?: string, role?: UserRole) => Promise<void>;
  signUpPatient: (
    email: string, 
    pass: string, 
    profile: {
      name: string;
      phone: string;
      age?: number;
      gender?: 'Male' | 'Female' | 'Other';
      clinicId: string;
      clinicName: string;
    }
  ) => Promise<UserProfile>;
  signInPatient: (email: string, pass: string) => Promise<UserProfile | null>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [superAdminSessionToken, setSuperAdminSessionToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(SUPER_ADMIN_SESSION_KEY);
    } catch {
      return null;
    }
  });

  // Verify Super Admin server session on initial load
  useEffect(() => {
    let isCancelled = false;

    const initSuperAdminSession = async () => {
      const storedToken = sessionStorage.getItem(SUPER_ADMIN_SESSION_KEY);
      if (storedToken) {
        try {
          const res = await fetch('/api/super-admin/verify-session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${storedToken}`
            }
          });
          const data = await res.json();
          if (res.ok && data.valid && !isCancelled) {
            setSuperAdminSessionToken(storedToken);
            const email = data.user?.email || 'superadmin@mediqueue.internal';
            const name = data.user?.name || 'Super Administrator';
            const fbUser = await ensureSuperAdminFirebaseAuth(email, name);
            if (!isCancelled) {
              if (fbUser) {
                setUser(fbUser);
              }
              setUserProfile({
                uid: fbUser?.uid || 'super_admin_root',
                email,
                name,
                displayName: name,
                phone: '+1 (800) 555-0100',
                age: 40,
                gender: 'Other',
                role: 'SUPER_ADMIN',
                clinicId: DEFAULT_CLINIC_ID,
                clinicIds: INITIAL_CLINICS.map(c => c.id),
                accessibleClinicIds: INITIAL_CLINICS.map(c => c.id),
                status: 'active',
                createdAt: new Date().toISOString()
              });
              setLoading(false);
              setAuthReady(true);
            }
            return;
          } else if (!isCancelled) {
            sessionStorage.removeItem(SUPER_ADMIN_SESSION_KEY);
            setSuperAdminSessionToken(null);
          }
        } catch {
          if (!isCancelled) {
            sessionStorage.removeItem(SUPER_ADMIN_SESSION_KEY);
            setSuperAdminSessionToken(null);
          }
        }
      }

      // If no valid super admin session, fallback to Firebase auth listener state
      if (!isCancelled && !storedToken) {
        if (!auth.currentUser) {
          setLoading(false);
          setAuthReady(true);
        }
      }
    };

    initSuperAdminSession();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Firebase Auth State Listener (for Clinic Admins & Staff)
  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      const activeSuperToken = sessionStorage.getItem(SUPER_ADMIN_SESSION_KEY);
      
      if (currentUser && !activeSuperToken) {
        setUser(currentUser);
        try {
          let profile = await getUserProfile(currentUser.uid);
          
          if (!profile) {
            // For existing auth user without profile, check email domain or default safely
            const isDefaultSuper = currentUser.email === 'gdeepak4689@gmail.com' || currentUser.email === 'superadmin@mediqueue.internal';
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              name: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
              phone: '',
              age: 30,
              gender: 'Other',
              role: isDefaultSuper ? 'SUPER_ADMIN' : 'PATIENT',
              clinicId: DEFAULT_CLINIC_ID,
              clinicName: 'City Care Clinic',
              clinicIds: [DEFAULT_CLINIC_ID],
              accessibleClinicIds: [DEFAULT_CLINIC_ID],
              status: 'active',
              createdAt: new Date().toISOString()
            };
            profile = await saveUserProfile(newProfile) as UserProfile;
          }
          
          // If profile is disabled/inactive, force logout
          if (profile && (profile.status === 'inactive' || profile.status === 'INACTIVE')) {
            await firebaseSignOut(auth);
            if (isMounted) {
              setUser(null);
              setUserProfile(null);
              setLoading(false);
              setAuthReady(true);
            }
            return;
          }

          if (isMounted) {
            setUserProfile(profile as UserProfile);
            setLoading(false);
            setAuthReady(true);
          }

          // Audit log successful login for staff/admins
          if (profile?.role !== 'PATIENT' && profile?.role !== 'patient') {
            const resolvedClinicId = profile?.clinicId || DEFAULT_CLINIC_ID;
            const clinicObj = INITIAL_CLINICS.find(c => c.id === resolvedClinicId);
            logAuditEvent({
              action: 'CLINIC_ADMIN_LOGIN',
              clinicId: resolvedClinicId,
              clinicName: clinicObj?.name,
              details: { email: currentUser.email }
            });
          }
        } catch (err) {
          console.warn('Auth profile initialization notice:', formatFirestoreError(err, 'Failed to fetch user profile'));
          if (isMounted) {
            setLoading(false);
            setAuthReady(true);
          }
        }
      } else if (!currentUser && !activeSuperToken) {
        if (isMounted) {
          setUser(null);
          setUserProfile(null);
          setLoading(false);
          setAuthReady(true);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [superAdminSessionToken]);

  // Authenticate Super Admin via Verified Server Session Token
  const verifySuperAdminPin = async (token: string, userMeta?: any) => {
    setLoading(true);
    setAuthReady(false);
    sessionStorage.setItem(SUPER_ADMIN_SESSION_KEY, token);
    setSuperAdminSessionToken(token);

    const email = userMeta?.email || 'superadmin@mediqueue.internal';
    const name = userMeta?.name || 'Super Administrator';
    const fbUser = await ensureSuperAdminFirebaseAuth(email, name);
    if (fbUser) {
      setUser(fbUser);
    }

    const superProfile: UserProfile = {
      uid: fbUser?.uid || 'super_admin_root',
      email,
      name,
      displayName: name,
      phone: '+1 (800) 555-0100',
      age: 40,
      gender: 'Other',
      role: 'SUPER_ADMIN',
      clinicId: DEFAULT_CLINIC_ID,
      clinicIds: INITIAL_CLINICS.map(c => c.id),
      accessibleClinicIds: INITIAL_CLINICS.map(c => c.id),
      status: 'active',
      createdAt: new Date().toISOString()
    };

    setUserProfile(superProfile);
    setLoading(false);
    setAuthReady(true);

    // Audit log successful Super Admin authentication (No secrets or PIN logged)
    logAuditEvent({
      action: 'SUPER_ADMIN_LOGIN',
      clinicId: DEFAULT_CLINIC_ID,
      clinicName: 'MediQueue System Global',
      actorRole: 'SUPER_ADMIN',
      details: {
        method: 'SERVER_PIN_VERIFIED',
        timestamp: new Date().toISOString()
      }
    });
  };

  // Clinic Admin / Staff Email & Password Login
  const login = async (email: string, pass: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const profile = await getUserProfile(cred.user.uid);
    if (profile && (profile.status === 'inactive' || profile.status === 'INACTIVE')) {
      await firebaseSignOut(auth);
      throw new Error('This account has been disabled. Please contact the Super Admin.');
    }
  };

  // Register Clinic Staff / Admin
  const registerAdmin = async (
    email: string, 
    pass: string, 
    clinicId?: string,
    role: UserRole = 'CLINIC_ADMIN'
  ) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const targetClinicId = clinicId || DEFAULT_CLINIC_ID;

    // Staff accounts cannot register as Super Admin from client
    const assignedRole: UserRole = role === 'SUPER_ADMIN' ? 'CLINIC_ADMIN' : role;

    const profileData: UserProfile = {
      uid: cred.user.uid,
      email,
      name: email.split('@')[0].toUpperCase(),
      phone: '',
      age: 35,
      gender: 'Male',
      role: assignedRole,
      clinicId: targetClinicId,
      clinicIds: [targetClinicId],
      accessibleClinicIds: [targetClinicId],
      status: 'active',
      createdAt: new Date().toISOString()
    };
    const saved = await saveUserProfile(profileData);
    setUserProfile(saved as UserProfile);
  };

  const signUpPatient = async (
    email: string, 
    pass: string, 
    profileData: {
      name: string;
      phone: string;
      age?: number;
      gender?: 'Male' | 'Female' | 'Other';
      clinicId: string;
      clinicName: string;
    }
  ): Promise<UserProfile> => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    const fullProfile: UserProfile = {
      uid: cred.user.uid,
      email: email.trim(),
      name: profileData.name.trim(),
      phone: profileData.phone.trim(),
      age: profileData.age ? Number(profileData.age) : 30,
      gender: profileData.gender || 'Male',
      role: 'PATIENT',
      clinicId: profileData.clinicId,
      clinicName: profileData.clinicName,
      clinicIds: [profileData.clinicId],
      accessibleClinicIds: [profileData.clinicId],
      activeClinicId: profileData.clinicId,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const saved = await saveUserProfile(fullProfile);
    setUserProfile(saved as UserProfile);
    return saved as UserProfile;
  };

  const signInPatient = async (email: string, pass: string): Promise<UserProfile | null> => {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
    const profile = await getUserProfile(cred.user.uid);
    if (profile) {
      if (profile.status === 'inactive' || profile.status === 'INACTIVE') {
        await firebaseSignOut(auth);
        throw new Error('This account has been deactivated. Please contact clinic support.');
      }
      setUserProfile(profile as UserProfile);
      return profile as UserProfile;
    }
    return null;
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    if (superAdminSessionToken) {
      try {
        await fetch('/api/super-admin/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${superAdminSessionToken}`
          }
        });
      } catch (_) {}
      
      logAuditEvent({
        action: 'SUPER_ADMIN_LOGOUT',
        clinicId: DEFAULT_CLINIC_ID,
        clinicName: 'MediQueue System Global',
        actorRole: 'SUPER_ADMIN',
        details: { timestamp: new Date().toISOString() }
      });

      sessionStorage.removeItem(SUPER_ADMIN_SESSION_KEY);
      setSuperAdminSessionToken(null);
    } else if (user) {
      const activeClinicId = userProfile?.clinicId;
      const clinicObj = activeClinicId ? INITIAL_CLINICS.find(c => c.id === activeClinicId) : undefined;
      logAuditEvent({
        action: 'ADMIN_LOGOUT',
        clinicId: activeClinicId,
        clinicName: clinicObj?.name,
        details: { email: user.email }
      });
    }

    try {
      await firebaseSignOut(auth);
    } catch (_) {}

    setUser(null);
    setUserProfile(null);
  };

  // Authorization checks
  const isSuperAdmin = !!superAdminSessionToken || userProfile?.role === 'SUPER_ADMIN';
  const isClinicAdmin = isSuperAdmin || userProfile?.role === 'CLINIC_ADMIN' || userProfile?.role === 'admin';
  const isAdmin = isSuperAdmin || !!user;
  const userRole: UserRole = isSuperAdmin ? 'SUPER_ADMIN' : (userProfile?.role || (user ? 'CLINIC_ADMIN' : 'patient'));

  return (
    <AuthContext.Provider value={{ 
      user, 
      userProfile, 
      loading, 
      authReady,
      isAdmin,
      isSuperAdmin,
      isClinicAdmin,
      userRole,
      superAdminSessionToken,
      verifySuperAdminPin,
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
